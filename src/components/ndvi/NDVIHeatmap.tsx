// src/components/ndvi/NDVIHeatmap.tsx
/**
 * NDVIHeatmap — Overlay NDVI colorizado sobre o mapa do talhão.
 *
 * Fluxo agronômico (análogo ao sistema de irrigação — cada etapa move o dado
 * até o destino certo, na "pressão" certa):
 *
 *  1. Busca /fields/{id}/analyses/latest → tile_url + bounds (bbox do polígono + 15% buffer)
 *  2. Verifica cache local (offline-first — "silo" de dados, disponível sem rede)
 *  3. Baixa PNG NDVI com auth Bearer via expo-file-system → salva em cache
 *  4. Exibe como Overlay georeferenciado dentro dos bounds do talhão
 *  5. Sobrepõe marcadores de anomalias ativas
 *  6. Fallback gracioso se tile_url = null (sem imagem processada ainda)
 *  7. Fallback de emergência offline (usa cache desatualizado se existir)
 *
 * O PNG vem pré-mascarado pelo backend (pixels fora do polígono = transparentes).
 * Não re-mascaramos no front — o que chega, renderizamos.
 *
 * Cache TTL: 30 min. Tile novo é baixado apenas se o cache expirou ou não existe.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Overlay, Region } from '@/components/map/MapView';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from '@/services/secureStorage';
import { Anomaly, GeoJSONGeometry } from '@/types';
import { API_URL, fieldsAPI } from '@/services/api';
import { useI18nStore } from '@/store/i18n';

// ── Constantes ────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'techa_auth_token';

/** Opacidade do overlay NDVI. 0.82 = visível mas deixa textura do satélite aparecer. */
const NDVI_OVERLAY_OPACITY = 0.82;

/** Cache válido por 30 minutos (em segundos). */
const CACHE_TTL_SECONDS = 1800;
const REQUEST_TIMEOUT_MS = 12_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;

const SCREEN_H = Dimensions.get('window').height;

// ── Tipos internos ────────────────────────────────────────────────────────────

/** Shape do response de /analyses/latest — inclui campos além do tipo TypeScript base */
interface AnalysisResponse {
  tile_url: string | null;
  /** [west, south, east, north] em graus decimais WGS84 */
  bounds: [number, number, number, number] | null;
  ndvi_mean: number | null;
  image_date: string | null;
  status: string | null;
}

interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface Props {
  fieldId: string;
  /** tiles_path do SatelliteAnalysis — mantido para compatibilidade, não usado diretamente */
  tilesPath: string | null;
  anomalies: Anomaly[];
  onAnomalyPress: (a: Anomaly) => void;
  height?: number;
}

// ── Utilitários ───────────────────────────────────────────────────────────────

function bboxToRegion(b: BBox): Region {
  const latMid = (b.north + b.south) / 2;
  const lonMid = (b.east + b.west) / 2;
  // Margem pequena para abrir mais proximo sem cortar o talhao.
  const latDelta = Math.max((b.north - b.south) * 1.12, 0.003);
  const lonDelta = Math.max((b.east - b.west) * 1.12, 0.003);
  return { latitude: latMid, longitude: lonMid, latitudeDelta: latDelta, longitudeDelta: lonDelta };
}

/** Estima bbox a partir dos centroides das anomalias — fallback quando API falha */
function bboxFromAnomalies(anomalies: Anomaly[]): BBox | null {
  const pts = anomalies
    .map(a => a.centroid)
    .filter((c): c is { latitude: number; longitude: number } => !!c);
  if (!pts.length) return null;
  const lats = pts.map(c => c.latitude);
  const lons = pts.map(c => c.longitude);
  return {
    south: Math.min(...lats) - 0.008,
    north: Math.max(...lats) + 0.008,
    west: Math.min(...lons) - 0.008,
    east: Math.max(...lons) + 0.008,
  };
}

function bboxFromGeometry(geometry: GeoJSONGeometry, bufferPct = 0.15): BBox | null {
  const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
  const points = rings.flat();
  if (!points.length) return null;

  const lons = points.map(([lon]) => lon);
  const lats = points.map(([, lat]) => lat);
  const west = Math.min(...lons);
  const east = Math.max(...lons);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const dx = Math.max((east - west) * bufferPct, 0.01);
  const dy = Math.max((north - south) * bufferPct, 0.01);

  return { west: west - dx, east: east + dx, south: south - dy, north: north + dy };
}

async function loadFieldBounds(fieldId: string): Promise<BBox | null> {
  const field = await fieldsAPI.get(fieldId);
  const geometry = field.geometry_geojson ?? field.geometry;
  return geometry ? bboxFromGeometry(geometry) : null;
}

/** Caminho do cache local para o tile PNG do talhão */
function tileCachePath(fieldId: string): string {
  return `${FileSystem.cacheDirectory}ndvi_tile_${fieldId}.png`;
}

/** Cor do marcador de anomalia baseada na queda percentual de NDVI */
function anomalyMarkerColor(ndviDropPct: number): string {
  // Limiar: 40%+ = crítico (vermelho), 25-40% = alerta (laranja), <25% = atenção (amarelo)
  if (ndviDropPct >= 40) return '#DC2626';
  if (ndviDropPct >= 25) return '#F59E0B';
  return '#EAB308';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      value => {
        clearTimeout(timeout);
        resolve(value);
      },
      error => {
        clearTimeout(timeout);
        reject(error);
      }
    );
  });
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ── Componente ────────────────────────────────────────────────────────────────

export function NDVIHeatmap({
  fieldId,
  anomalies,
  onAnomalyPress,
  height = SCREEN_H * 0.38,
}: Props) {
  const t = useI18nStore(s => s.t);
  // URI do PNG local (file:// ou null enquanto carrega)
  const [localTileUri, setLocalTileUri] = useState<string | null>(null);
  // Bounds do polígono retornados pela API
  const [bbox, setBbox] = useState<BBox | null>(null);
  // Região inicial do mapa
  const [region, setRegion] = useState<Region | null>(null);

  // Estados de carregamento
  const [loading, setLoading] = useState(true);
  const [tileAvailable, setTileAvailable] = useState(false);
  const [usingStaleCache, setUsingStaleCache] = useState(false);
  const [noAnalysis, setNoAnalysis] = useState(false);

  const mapRef = useRef<MapView>(null);
  // Previne setState em componente desmontado
  const mountedRef = useRef(true);

  // ── Lógica de carga do tile ────────────────────────────────────────────────
  const loadTile = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setTileAvailable(false);
    setUsingStaleCache(false);
    setNoAnalysis(false);

    const cachePath = tileCachePath(fieldId);

    try {
      // 1. Recuperar token de autenticação
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const authHeader: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // 2. Buscar análise mais recente (tile_url + bounds)
      const resp = await fetchWithTimeout(
        `${API_URL}/fields/${fieldId}/analyses/latest`,
        { headers: authHeader }
      );

      if (!resp.ok) {
        // 404 = talhão sem análise ainda — não é erro de rede
        if (resp.status === 404) {
          if (mountedRef.current) setNoAnalysis(true);
          const fieldBounds = await loadFieldBounds(fieldId).catch(() => null);
          const fb = fieldBounds ?? bboxFromAnomalies(anomalies);
          if (fb && mountedRef.current) {
            setBbox(fb);
            setRegion(bboxToRegion(fb));
          }
          return;
        }
        throw new Error(`HTTP ${resp.status}`);
      }

      const analysis: AnalysisResponse = await resp.json();

      // 3. Configurar bounds e região do mapa a partir do bbox do talhão
      if (analysis.bounds) {
        const [west, south, east, north] = analysis.bounds;
        const b: BBox = { west, south, east, north };
        if (mountedRef.current) {
          setBbox(b);
          setRegion(bboxToRegion(b));
        }
      }

      // 4. Sem tile disponível ainda → exibir mapa base sem overlay
      if (!analysis.tile_url) {
        if (mountedRef.current) setNoAnalysis(true);
        return;
      }

      // 5. Offline-first: verificar se cache local ainda é fresco (< 30 min)
      const cacheInfo = await FileSystem.getInfoAsync(cachePath);
      const nowSec = Date.now() / 1000;
      const isFresh =
        cacheInfo.exists &&
        'modificationTime' in cacheInfo &&
        cacheInfo.modificationTime != null &&
        nowSec - cacheInfo.modificationTime < CACHE_TTL_SECONDS;

      if (isFresh) {
        // Cache fresco → usar direto (economia de banda no campo)
        if (mountedRef.current) {
          setLocalTileUri(cachePath);
          setTileAvailable(true);
        }
        return;
      }

      // 6. Baixar tile com autenticação
      // tile_url pode ser URL completa ou path relativo — normalizar
      const tileUrl = analysis.tile_url.startsWith('http')
        ? analysis.tile_url
        : `${API_URL}/fields/${fieldId}/ndvi-tile`;

      const dlResult = await withTimeout(
        FileSystem.downloadAsync(tileUrl, cachePath, { headers: authHeader }),
        DOWNLOAD_TIMEOUT_MS,
        'Timeout ao baixar tile NDVI'
      );

      if (dlResult.status === 200) {
        if (mountedRef.current) {
          setLocalTileUri(dlResult.uri);
          setTileAvailable(true);
        }
        return;
      }

      // 7. tile_url falhou → tentar endpoint canônico /ndvi-tile como fallback
      const fallbackResult = await withTimeout(
        FileSystem.downloadAsync(
          `${API_URL}/fields/${fieldId}/ndvi-tile`,
          cachePath,
          { headers: authHeader }
        ),
        DOWNLOAD_TIMEOUT_MS,
        'Timeout ao baixar fallback NDVI'
      );

      if (mountedRef.current) {
        if (fallbackResult.status === 200) {
          setLocalTileUri(fallbackResult.uri);
          setTileAvailable(true);
        } else {
          setNoAnalysis(true);
        }
      }
    } catch {
      // ── Fallback de emergência offline ──────────────────────────────────
      // "Plano de replantio" — se o download falha, usar cache mesmo velho.
      const cacheInfo = await FileSystem.getInfoAsync(cachePath);
      if (cacheInfo.exists && mountedRef.current) {
        setLocalTileUri(cachePath);
        setTileAvailable(true);
        setUsingStaleCache(true);
      } else if (mountedRef.current) {
        setNoAnalysis(true);
      }

      // Fallback de região via anomalias quando API não respondeu
      if (!region && mountedRef.current) {
        const fieldBounds = await loadFieldBounds(fieldId).catch(() => null);
        const fb = fieldBounds ?? bboxFromAnomalies(anomalies);
        if (fb) {
          setBbox(fb);
          setRegion(bboxToRegion(fb));
        }
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fieldId, anomalies]);

  useEffect(() => {
    mountedRef.current = true;
    loadTile();
    return () => {
      mountedRef.current = false;
    };
  }, [loadTile]);

  // ── Render: carregando ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.container, { height }, styles.centered]}>
        <ActivityIndicator size="large" color="#16A34A" />
        <Text style={styles.loadingText}>{t('ndvi.loadingMap')}</Text>
      </View>
    );
  }

  // ── Render: sem coordenadas suficientes ────────────────────────────────────
  if (!region) {
    return (
      <View style={[styles.container, { height }, styles.centered]}>
        <Text style={styles.fallbackEmoji}>🌱</Text>
        <Text style={styles.fallbackTitle}>{t('ndvi.noLocation')}</Text>
        <Text style={styles.fallbackSub}>{t('ndvi.waitingProcessing')}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadTile}>
          <Text style={styles.retryText}>↺ {t('common.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: mapa com (ou sem) overlay NDVI ─────────────────────────────────
  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        mapType="satellite"
        initialRegion={region}
        scrollEnabled
        zoomEnabled
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {/* ── Overlay PNG NDVI georeferenciado ──
            O PNG já tem a máscara do polígono aplicada pelo backend.
            Pixels fora do talhão = transparentes → sem re-mascarar no front. */}
        {tileAvailable && localTileUri && bbox && (
          <Overlay
            image={{ uri: localTileUri }}
            bounds={[
              [bbox.south, bbox.west], // canto SW
              [bbox.north, bbox.east], // canto NE
            ]}
            opacity={NDVI_OVERLAY_OPACITY}
          />
        )}

        {/* ── Marcadores de anomalias ativas ── */}
        {anomalies.map(anomaly => {
          if (!anomaly.centroid) return null;
          const markerColor = anomalyMarkerColor(anomaly.ndvi_drop_pct);
          return (
            <Marker
              key={anomaly.id}
              coordinate={anomaly.centroid}
              onPress={() => onAnomalyPress(anomaly)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              zIndex={20}
            >
              <View style={[styles.anomalyMarker, { borderColor: markerColor }]}>
                <View style={[styles.anomalyDot, { backgroundColor: markerColor }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Badge: sem tile NDVI (fallback = mapa satélite + anomalias apenas) */}
      {noAnalysis && (
        <View style={styles.badgeTop}>
          <Text style={styles.badgeTopText}>{t('ndvi.unavailable')}</Text>
        </View>
      )}

      {/* Badge: usando cache desatualizado por falta de rede */}
      {usingStaleCache && (
        <View style={styles.badgeOffline}>
          <Text style={styles.badgeOfflineText}>{t('ndvi.offlineCached')}</Text>
        </View>
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#0d1f0d',
    position: 'relative',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
  },
  fallbackEmoji: {
    fontSize: 40,
  },
  fallbackTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  fallbackSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: '#16A34A',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  anomalyMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  anomalyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badgeTop: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(20,20,20,0.82)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeTopText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
  badgeOffline: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(217,119,6,0.88)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeOfflineText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
