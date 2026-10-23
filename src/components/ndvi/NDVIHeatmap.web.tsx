import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { API_URL, fieldsAPI } from '@/services/api';
import { getItemAsync } from '@/services/secureStorage';
import { Anomaly, GeoJSONGeometry } from '@/types';
import { googleBounds, googleMapsWebKey, GOOGLE_MAPS_AUTH_ERROR, loadGoogleMaps } from '@/components/map/googleMaps.web';

type Props = {
  fieldId: string;
  tilesPath: string | null;
  anomalies: Anomaly[];
  onAnomalyPress: (anomaly: Anomaly) => void;
  height?: number;
};
type Bounds = [number, number, number, number];
const DEFAULT_HEIGHT = Dimensions.get('window').height * 0.38;

function anomalyMarkerColor(ndviDropPct: number): string {
  if (ndviDropPct >= 40) return '#DC2626';
  if (ndviDropPct >= 25) return '#F59E0B';
  return '#EAB308';
}

function boundsFromGeometry(geometry: GeoJSONGeometry): L.LatLngBounds | null {
  const layer = L.geoJSON(geometry as any);
  const bounds = layer.getBounds();
  return bounds.isValid() ? bounds : null;
}

export function NDVIHeatmap({ fieldId, anomalies, onAnomalyPress, height = DEFAULT_HEIGHT }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const dataLayerRef = useRef<L.LayerGroup | null>(null);
  const googleRef = useRef<{ maps: any; map: any } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const showAuthError = () => setMapError('Google Maps recusou a chave. Confira Maps JavaScript API, faturamento e domínio autorizado.');
    window.addEventListener(GOOGLE_MAPS_AUTH_ERROR, showAuthError);
    return () => window.removeEventListener(GOOGLE_MAPS_AUTH_ERROR, showAuthError);
  }, []);
  const [tileUri, setTileUri] = useState<string | null>(null);
  const [tileBounds, setTileBounds] = useState<Bounds | null>(null);
  const [geometry, setGeometry] = useState<GeoJSONGeometry | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (googleMapsWebKey) {
      let cancelled = false;
      loadGoogleMaps().then(maps => {
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: { lat: -25.397, lng: -54.611 }, zoom: 12,
          mapTypeId: 'satellite', streetViewControl: false, fullscreenControl: false, scrollwheel: false,
        });
        googleRef.current = { maps, map };
        setMapReady(true);
      }).catch(() => {
        if (!cancelled) setMapError('Não foi possível abrir o Google Maps. Confira a chave e o domínio autorizado.');
      });
      return () => { cancelled = true; googleRef.current = null; };
    }
    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false })
      .setView([-25.397, -54.611], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    dataLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setMapReady(true);
    setTimeout(() => map.invalidateSize(), 0);
    return () => {
      mapRef.current = null;
      dataLayerRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fieldsAPI.get(fieldId).then(field => {
      if (!cancelled) setGeometry(field.geometry_geojson ?? field.geometry ?? null);
    }).catch(() => {
      if (!cancelled) setGeometry(null);
    });
    return () => { cancelled = true; };
  }, [fieldId]);

  const loadTile = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const token = await getItemAsync('techa_auth_token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const latestResponse = await fetch(`${API_URL}/fields/${fieldId}/analyses/latest`, { headers });
      if (!latestResponse.ok) throw new Error('Imagem NDVI ainda não disponível.');
      const analysis = await latestResponse.json() as { tile_url?: string | null; bounds?: Bounds | null };
      setTileBounds(analysis.bounds ?? null);
      if (!analysis.tile_url) throw new Error('Imagem NDVI ainda não disponível.');
      const tileResponse = await fetch(`${API_URL}/fields/${fieldId}/ndvi-tile`, { headers });
      if (!tileResponse.ok) throw new Error('Não foi possível carregar a imagem NDVI.');
      const nextUrl = URL.createObjectURL(await tileResponse.blob());
      setTileUri(previous => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Imagem NDVI indisponível.');
    } finally {
      setLoading(false);
    }
  }, [fieldId]);

  useEffect(() => { loadTile(); }, [loadTile]);
  useEffect(() => () => { if (tileUri) URL.revokeObjectURL(tileUri); }, [tileUri]);

  useEffect(() => {
    const google = googleRef.current;
    if (google) {
      const { maps, map } = google;
      const layers: any[] = [];
      const geometryPoints: { latitude: number; longitude: number }[] = [];
      if (geometry && !tileUri) {
        const data = new maps.Data({ map });
        data.addGeoJson({ type: 'Feature', geometry, properties: {} });
        data.setStyle({ strokeColor: '#16A34A', strokeWeight: 3, fillColor: '#16A34A', fillOpacity: 0.12 });
        layers.push(data);
        const rings = geometry.type === 'Polygon' ? geometry.coordinates : geometry.coordinates.flat();
        rings.flat().forEach(([longitude, latitude]) => geometryPoints.push({ latitude, longitude }));
      }
      if (tileUri && tileBounds) {
        const [west, south, east, north] = tileBounds;
        const overlay = new maps.GroundOverlay(tileUri, { west, south, east, north }, { opacity: 0.82 });
        overlay.setMap(map);
        layers.push(overlay);
      }
      anomalies.forEach(anomaly => {
        if (!anomaly.centroid) return;
        const marker = new maps.Marker({
          map, position: { lat: anomaly.centroid.latitude, lng: anomaly.centroid.longitude },
          icon: { path: maps.SymbolPath.CIRCLE, scale: 9, fillColor: anomalyMarkerColor(anomaly.ndvi_drop_pct), fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
        });
        marker.addListener('click', () => onAnomalyPress(anomaly));
        layers.push(marker);
      });
      if (tileBounds) {
        const [west, south, east, north] = tileBounds;
        map.fitBounds({ west, south, east, north }, 12);
      } else if (geometryPoints.length) {
        map.fitBounds(googleBounds(maps, geometryPoints), 12);
      }
      return () => layers.forEach(layer => layer.setMap(null));
    }
    const map = mapRef.current;
    const layers = dataLayerRef.current;
    if (!map || !layers) return;
    layers.clearLayers();
    let visibleBounds: L.LatLngBounds | null = null;
    if (geometry && !tileUri) {
      const fieldLayer = L.geoJSON(geometry as any, {
        style: { color: '#16A34A', weight: 3, fillColor: '#16A34A', fillOpacity: 0.12 },
      }).addTo(layers);
      visibleBounds = fieldLayer.getBounds();
    }
    if (tileBounds) {
      const [west, south, east, north] = tileBounds;
      const bounds = L.latLngBounds([south, west], [north, east]);
      if (tileUri) L.imageOverlay(tileUri, bounds, { opacity: 0.82 }).addTo(layers);
      visibleBounds = bounds;
    }
    anomalies.forEach(anomaly => {
      if (!anomaly.centroid) return;
      L.circleMarker([anomaly.centroid.latitude, anomaly.centroid.longitude], {
        radius: 9, color: '#FFF', weight: 2, fillColor: anomalyMarkerColor(anomaly.ndvi_drop_pct), fillOpacity: 1,
      }).addTo(layers).on('click', () => onAnomalyPress(anomaly));
    });
    if (!visibleBounds?.isValid() && geometry) visibleBounds = boundsFromGeometry(geometry);
    if (visibleBounds?.isValid()) map.fitBounds(visibleBounds.pad(0.06), { maxZoom: 19 });
    setTimeout(() => map.invalidateSize(), 0);
  }, [mapReady, geometry, tileUri, tileBounds, anomalies, onAnomalyPress]);

  return (
    <View style={[styles.container, { height }]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {mapError && <View style={styles.status}><Text style={styles.statusText}>{mapError}</Text></View>}
      {loading && <View style={styles.status}><ActivityIndicator color="#16A34A" /></View>}
      {!loading && message && (
        <View style={styles.status}>
          <Text style={styles.statusText}>{message}</Text>
          <TouchableOpacity onPress={loadTile}><Text style={styles.retryText}>Tentar novamente</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#E8F5E9' },
  status: { position: 'absolute', bottom: 18, alignSelf: 'center', zIndex: 1000, borderRadius: 8, backgroundColor: '#FFF', padding: 8, alignItems: 'center', gap: 4 },
  statusText: { fontSize: 12, color: '#1A202C', textAlign: 'center' },
  retryText: { fontSize: 12, color: '#16A34A', fontWeight: '700' },
});
