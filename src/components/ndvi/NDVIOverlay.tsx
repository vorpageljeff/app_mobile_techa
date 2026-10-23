// src/components/ndvi/NDVIOverlay.tsx
// Exibe o tile PNG NDVI colorimétrico sobre o mapa do talhão.
//
// Fluxo:
//  1. Busca geometria via GET /fields/{fieldId} → calcula bbox + 15% buffer
//  2. Verifica cache local (offline-first, TTL 30 min)
//  3. Baixa PNG de GET /fields/{fieldId}/tile com Bearer auth
//  4. Renderiza como Overlay georeferenciado no MapView
//  5. Exibe marcadores de anomalias ativas
//  6. Fallback offline: usa último tile cacheado se existir
//  7. Fallback sem dado: exibe mensagem com data da última tentativa

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
import { Anomaly, Field, GeoJSONPolygon } from '@/types';
import { API_URL } from '@/services/api';

const TOKEN_KEY = 'techa_auth_token';
const NDVI_OVERLAY_OPACITY = 0.82;
const CACHE_TTL_SECONDS = 1800;
const REQUEST_TIMEOUT_MS = 12_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;
const SCREEN_H = Dimensions.get('window').height;

interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

interface Props {
  fieldId: string;
  anomalies: Anomaly[];
  onAnomalyPress: (a: Anomaly) => void;
  height?: number;
}

// Calcula bbox do polígono GeoJSON + buffer de contexto visual (15% por lado).
// REGRA INEGOCIÁVEL: usar sempre o bbox do talhão, nunca do raster Sentinel-2.
function bboxFromGeoJSON(geometry: GeoJSONPolygon, bufferPct = 0.15): BBox {
  const coords = geometry.coordinates[0];
  const lons = coords.map(([lon]) => lon);
  const lats = coords.map(([, lat]) => lat);
  const west = Math.min(...lons);
  const east = Math.max(...lons);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const dx = Math.max((east - west) * bufferPct, 0.01);
  const dy = Math.max((north - south) * bufferPct, 0.01);
  return { west: west - dx, east: east + dx, south: south - dy, north: north + dy };
}

function bboxToRegion(b: BBox): Region {
  const latMid = (b.north + b.south) / 2;
  const lonMid = (b.east + b.west) / 2;
  const latDelta = Math.max((b.north - b.south) * 1.12, 0.003);
  const lonDelta = Math.max((b.east - b.west) * 1.12, 0.003);
  return { latitude: latMid, longitude: lonMid, latitudeDelta: latDelta, longitudeDelta: lonDelta };
}

function anomalyMarkerColor(pct: number): string {
  if (pct >= 40) return '#DC2626';
  if (pct >= 25) return '#F59E0B';
  return '#EAB308';
}

function tileCachePath(fieldId: string): string {
  return `${FileSystem.cacheDirectory}ndvi_overlay_${fieldId}.png`;
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

export function NDVIOverlay({
  fieldId,
  anomalies,
  onAnomalyPress,
  height = SCREEN_H * 0.38,
}: Props) {
  const [localTileUri, setLocalTileUri] = useState<string | null>(null);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
  const [tileAvailable, setTileAvailable] = useState(false);
  const [usingStaleCache, setUsingStaleCache] = useState(false);
  const [noTile, setNoTile] = useState(false);
  const [noData, setNoData] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const mapRef = useRef<MapView>(null);

  const loadTile = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    setTileAvailable(false);
    setUsingStaleCache(false);
    setNoTile(false);
    setNoData(false);

    const cachePath = tileCachePath(fieldId);

    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const authHeader: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // 1. Buscar bounds via /analyses/latest (bbox+15% calculado pelo backend)
      const analysisResp = await fetchWithTimeout(`${API_URL}/fields/${fieldId}/analyses/latest`, {
        headers: authHeader,
      });
      if (!analysisResp.ok) {
        if (analysisResp.status === 404 && mountedRef.current) setNoData(true);
        throw new Error(`analysis HTTP ${analysisResp.status}`);
      }
      const analysis = await analysisResp.json();
      if (analysis.bounds && mountedRef.current) {
        const [west, south, east, north] = analysis.bounds;
        const b: BBox = { west, south, east, north };
        setBbox(b);
        setRegion(bboxToRegion(b));
      }
      if (!analysis.tile_url && mountedRef.current) { setNoTile(true); return; }

      // 2. Verificar cache fresco (< 30 min) — offline-first
      const cacheInfo = await FileSystem.getInfoAsync(cachePath);
      const nowSec = Date.now() / 1000;
      const isFresh =
        cacheInfo.exists &&
        'modificationTime' in cacheInfo &&
        cacheInfo.modificationTime != null &&
        nowSec - cacheInfo.modificationTime < CACHE_TTL_SECONDS;

      if (isFresh) {
        if (mountedRef.current) {
          setLocalTileUri(cachePath);
          setTileAvailable(true);
        }
        return;
      }

      // 3. Baixar tile PNG usando tile_url retornada pela API.
      // tile_url é um path absoluto (/api/v1/...), então usa só a origem do host.
      const apiOrigin = API_URL.replace(/\/api\/v1\/?$/, '');
      const tileUrl = analysis.tile_url.startsWith('http')
        ? analysis.tile_url
        : `${apiOrigin}${analysis.tile_url}`;

      setLastAttempt(new Date().toLocaleDateString('es'));
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

      // 4. Backend retornou status != 200 → ainda sem tile processado
      if (mountedRef.current) setNoTile(true);
    } catch {
      // Fallback offline: usar cache mesmo velho se existir
      const cacheInfo = await FileSystem.getInfoAsync(cachePath);
      if (cacheInfo.exists && mountedRef.current) {
        setLocalTileUri(cachePath);
        setTileAvailable(true);
        setUsingStaleCache(true);
      } else if (mountedRef.current) {
        setNoData(true);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fieldId]);

  useEffect(() => {
    mountedRef.current = true;
    loadTile();
    return () => {
      mountedRef.current = false;
    };
  }, [loadTile]);

  // Carregando
  if (loading) {
    return (
      <View style={[styles.container, { height }, styles.centered]}>
        <ActivityIndicator size="large" color="#16A34A" />
        <Text style={styles.loadingText}>Carregando mapa NDVI...</Text>
      </View>
    );
  }

  // Sem geometria / sem rede na primeira carga
  if (noData || !region) {
    return (
      <View style={[styles.container, { height }, styles.centered]}>
        <Text style={styles.fallbackEmoji}>🌱</Text>
        <Text style={styles.fallbackTitle}>Sem dados de localizacao</Text>
        <Text style={styles.fallbackSub}>
          Aguardando primeiro processamento de imagem Sentinel-2.
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadTile}>
          <Text style={styles.retryText}>↺ Tentar novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
        {/* Overlay PNG NDVI georeferenciado nos bounds do talhão + 15% buffer */}
        {tileAvailable && localTileUri && bbox && (
          <Overlay
            image={{ uri: localTileUri }}
            bounds={[
              [bbox.south, bbox.west],
              [bbox.north, bbox.east],
            ]}
            opacity={NDVI_OVERLAY_OPACITY}
          />
        )}

        {/* Marcadores de anomalias ativas */}
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

      {/* Badge: sem tile NDVI processado */}
      {noTile && (
        <View style={styles.badgeTop}>
          <Text style={styles.badgeTopText}>
            📡 Sin dato disponible{lastAttempt ? ` · ${lastAttempt}` : ''}
          </Text>
        </View>
      )}

      {/* Badge: usando cache desatualizado por falta de rede */}
      {usingStaleCache && (
        <View style={styles.badgeOffline}>
          <Text style={styles.badgeOfflineText}>⚡ Offline — último tile guardado</Text>
        </View>
      )}
    </View>
  );
}

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
