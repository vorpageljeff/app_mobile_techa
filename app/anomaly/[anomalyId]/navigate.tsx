// app/anomaly/[anomalyId]/navigate.tsx
// ─────────────────────────────────────────────────────────────────
// Tela "Pé no Barro" — Navegação GPS offline até a anomalia
//
// FUNCIONA SEM INTERNET:
//  - GPS do celular não precisa de dados móveis
//  - Mapa satellite via react-native-maps (cache do sistema)
//  - Câmera segue o usuário com heading em tempo real
//  - Seta de direção + distância sempre visíveis
// ─────────────────────────────────────────────────────────────────

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Vibration, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import MapView, { Marker, Polygon } from '@/components/map/MapView';
import { fieldCacheDB, anomalyCacheDB } from '@/services/database';
import { useI18nStore } from '@/store/i18n';

// ── Cálculos de geolocalização ────────────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function formatDistance(meters: number): string {
  if (meters < 50) return `${Math.round(meters)} m`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// ── Componente principal ──────────────────────────────────────────
export default function NavigateScreen() {
  const { anomalyId, lat, lon } = useLocalSearchParams<{
    anomalyId: string; lat: string; lon: string;
  }>();
  const router = useRouter();
  const t = useI18nStore(s => s.t);

  const targetLat = parseFloat(lat ?? '0');
  const targetLon = parseFloat(lon ?? '0');

  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [distance, setDistance] = useState<number | null>(null);
  const [bearing, setBearing] = useState<number>(0);
  const [arrived, setArrived] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [anomalyInfo, setAnomalyInfo] = useState<any>(null);
  const [anomalyPolygon, setAnomalyPolygon] = useState<{ latitude: number; longitude: number }[] | null>(null);

  const mapRef = useRef<MapView>(null);
  const locSub = useRef<Location.LocationSubscription | null>(null);
  const headSub = useRef<{ remove: () => void } | null>(null);
  const arrivedRef = useRef(false);

  // Carrega info da anomalia do SQLite (offline-safe)
  useEffect(() => {
    anomalyCacheDB.getById(anomalyId).then(a => {
      if (!a) return;
      setAnomalyInfo(a);
      // Converte geometry_json (MultiPolygon) → primeiro anel do primeiro polígono
      if (a.geometry_json) {
        try {
          const geo = JSON.parse(a.geometry_json);
          if (geo.type === 'MultiPolygon' && geo.coordinates[0]?.[0]?.length) {
            setAnomalyPolygon(
              geo.coordinates[0][0].map(([lo, la]: number[]) => ({ latitude: la, longitude: lo }))
            );
          }
        } catch {}
      }
    });
  }, [anomalyId]);

  // Inicia GPS de alta precisão
  useEffect(() => {
    let mounted = true;

    const startGPS = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('anomaly.gpsRequired'), t('anomaly.enableGps'));
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (mounted) {
        setUserLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setGpsReady(true);
      }

      // Atualização contínua — a cada 2m de deslocamento
      locSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2 },
        (loc) => {
          if (!mounted) return;
          const { latitude, longitude } = loc.coords;
          setUserLoc({ latitude, longitude });

          const dist = haversineDistance(latitude, longitude, targetLat, targetLon);
          const bear = bearingDegrees(latitude, longitude, targetLat, targetLon);
          setDistance(dist);
          setBearing(bear);

          // Câmera segue o usuário com rotação em direção ao alvo
          mapRef.current?.animateCamera(
            { center: { latitude, longitude }, zoom: 17, heading: bear, pitch: 0 },
            { duration: 800 }
          );

          // Chegou! (raio de 10m)
          if (dist < 10 && !arrivedRef.current) {
            arrivedRef.current = true;
            setArrived(true);
            Vibration.vibrate(Platform.OS === 'ios' ? [0, 400, 200, 400] : [400, 200, 400]);
          }
        }
      );

      // Sensor de bússola para girar a seta
      headSub.current = await Location.watchHeadingAsync((h) => {
        if (mounted) setHeading(h.trueHeading ?? h.magHeading ?? 0);
      }) as any;
    };

    startGPS();
    return () => {
      mounted = false;
      locSub.current?.remove();
      (headSub.current as any)?.remove?.();
    };
  }, []);

  // Rotação da seta: azimute para o alvo, corrigido pelo heading do celular
  const arrowRotation = bearing - heading;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('anomaly.navigating')}</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* ── Mapa satellite real ── */}
      <View style={styles.mapArea}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          mapType="satellite"
          showsUserLocation={true}
          showsMyLocationButton={false}
          showsCompass={false}
          initialRegion={{
            latitude: targetLat || -25.397,
            longitude: targetLon || -54.611,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
        >
          {/* Marker vermelho no alvo (anomalia) */}
          {targetLat !== 0 && (
            <Marker
              coordinate={{ latitude: targetLat, longitude: targetLon }}
              title={t('nav.anomaly')}
              pinColor="#DC2626"
            />
          )}

          {/* Polígono da anomalia se disponível */}
          {anomalyPolygon && (
            <Polygon
              coordinates={anomalyPolygon}
              strokeColor="rgba(220,38,38,0.9)"
              fillColor="rgba(220,38,38,0.25)"
              strokeWidth={2}
            />
          )}
        </MapView>

        {/* Coordenadas sobrepostas */}
        {userLoc && (
          <View style={styles.coordsOverlay}>
            <Text style={styles.coordsText}>
              📍 {userLoc.latitude.toFixed(5)}, {userLoc.longitude.toFixed(5)}
            </Text>
          </View>
        )}

        {/* Indicador de GPS aguardando */}
        {!gpsReady && (
          <View style={styles.gpsWaiting}>
            <Text style={styles.gpsWaitingText}>⟳ {t('anomaly.waitingGps')}</Text>
          </View>
        )}
      </View>

      {/* ── Painel de navegação ── */}
      {arrived ? (
        <View style={styles.arrivedPanel}>
          <Text style={styles.arrivedEmoji}>🎯</Text>
          <Text style={styles.arrivedTitle}>{t('anomaly.arrivedTitle')}</Text>
          <Text style={styles.arrivedSub}>{t('anomaly.arrivedSub')}</Text>
          <TouchableOpacity
            style={styles.btnInspect}
            onPress={() => router.push({ pathname: '/anomaly/[anomalyId]/inspect', params: { anomalyId } })}
          >
            <Text style={styles.btnInspectText}>{t('anomaly.inspect')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.navPanel}>
          {/* Seta de direção */}
          <View style={styles.arrowContainer}>
            {gpsReady ? (
              <Text style={[styles.arrow, { transform: [{ rotate: `${arrowRotation}deg` }] }]}>
                ↑
              </Text>
            ) : (
              <Text style={styles.arrowLoading}>⟳</Text>
            )}
          </View>

          {/* Distância */}
          <View style={styles.distanceInfo}>
            <Text style={styles.distanceValue}>
              {distance != null ? formatDistance(distance) : '—'}
            </Text>
            <Text style={styles.distanceLabel}>{t('anomaly.distanceTo')}</Text>
          </View>

          {/* Info da anomalia */}
          {anomalyInfo && (
            <View style={styles.anomalyInfo}>
              <Text style={styles.anomalyInfoText}>
                {anomalyInfo.ndvi_drop_pct?.toFixed(0)}% NDVI  ·  {anomalyInfo.affected_area_ha?.toFixed(1)} {t('anomaly.affectedHa')}
              </Text>
            </View>
          )}

          {/* Status GPS */}
          <View style={styles.gpsStatus}>
            <View style={[styles.gpsDot, gpsReady ? styles.gpsDotGreen : styles.gpsDotYellow]} />
            <Text style={styles.gpsStatusText}>
              {gpsReady ? t('anomaly.gpsActiveOffline') : t('anomaly.waitingGps')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1f14' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    backgroundColor: '#0f1f14', zIndex: 10,
  },
  backBtn: { padding: 4 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 15 },
  headerTitle: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  mapArea: { flex: 1 },
  coordsOverlay: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  coordsText: { color: '#FFF', fontSize: 10, fontFamily: 'monospace' },
  gpsWaiting: {
    position: 'absolute', top: 12, alignSelf: 'center',
    backgroundColor: 'rgba(245,158,11,0.9)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  gpsWaitingText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  navPanel: {
    backgroundColor: '#1a2e1a',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 24, paddingVertical: 20, alignItems: 'center', gap: 10,
  },
  arrowContainer: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(22,163,74,0.2)', borderWidth: 2, borderColor: '#16A34A',
    justifyContent: 'center', alignItems: 'center',
  },
  arrow: { fontSize: 56, color: '#16A34A' },
  arrowLoading: { fontSize: 48, color: '#F59E0B' },
  distanceInfo: { alignItems: 'center' },
  distanceValue: { fontSize: 42, fontWeight: '800', color: '#FFF', letterSpacing: -1 },
  distanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)' },
  anomalyInfo: {
    backgroundColor: 'rgba(220,38,38,0.2)', paddingHorizontal: 16, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(220,38,38,0.4)',
  },
  anomalyInfoText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600' },
  gpsStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsDotGreen: { backgroundColor: '#16A34A' },
  gpsDotYellow: { backgroundColor: '#F59E0B' },
  gpsStatusText: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  arrivedPanel: {
    backgroundColor: '#1a4731', padding: 32, alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: '#16A34A',
  },
  arrivedEmoji: { fontSize: 56 },
  arrivedTitle: { fontSize: 26, fontWeight: '800', color: '#FFF' },
  arrivedSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  btnInspect: {
    marginTop: 8, backgroundColor: '#16A34A', borderRadius: 14,
    paddingHorizontal: 28, paddingVertical: 14,
  },
  btnInspectText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
