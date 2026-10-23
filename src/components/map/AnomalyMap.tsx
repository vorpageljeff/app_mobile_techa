// src/components/map/AnomalyMap.tsx
// Mapa compacto mostrando a geometria da anomalia com react-native-maps
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Polygon, Marker } from '@/components/map/MapView';
import { Anomaly } from '@/types';

interface Props { anomaly: Anomaly; height?: number; }

// Calcula região inicial com margem a partir de um array de coordenadas
function boundsFromCoords(coords: { latitude: number; longitude: number }[]) {
  const lats = coords.map(c => c.latitude);
  const lons = coords.map(c => c.longitude);
  const latDelta = Math.max((Math.max(...lats) - Math.min(...lats)) * 1.8, 0.002);
  const lonDelta = Math.max((Math.max(...lons) - Math.min(...lons)) * 1.8, 0.002);
  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lons) + Math.max(...lons)) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta,
  };
}

export function AnomalyMap({ anomaly, height = 200 }: Props) {
  // Converte MultiPolygon GeoJSON → arrays de {latitude, longitude}
  const polygons = useMemo(() => {
    const geo = anomaly.geometry_geojson;
    if (!geo || geo.type !== 'MultiPolygon') return [];
    return geo.coordinates
      .map(poly => poly[0]?.map(([lon, lat]) => ({ latitude: lat, longitude: lon })))
      .filter((ring): ring is { latitude: number; longitude: number }[] => !!ring?.length);
  }, [anomaly.geometry_geojson]);

  const region = useMemo(() => {
    if (anomaly.centroid) {
      return {
        latitude: anomaly.centroid.latitude,
        longitude: anomaly.centroid.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
    }
    if (polygons[0]?.length) return boundsFromCoords(polygons[0]);
    return null;
  }, [anomaly.centroid, polygons]);

  return (
    <View style={[styles.container, { height }]}>
      {region ? (
        <MapView
          style={StyleSheet.absoluteFillObject}
          mapType="satellite"
          initialRegion={region}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {/* Polígonos da zona afetada */}
          {polygons.map((coords, i) => (
            <Polygon
              key={i}
              coordinates={coords}
              strokeColor="rgba(220,38,38,0.95)"
              fillColor="rgba(220,38,38,0.3)"
              strokeWidth={2}
            />
          ))}
          {/* Marker no centróide */}
          {anomaly.centroid && (
            <Marker coordinate={anomaly.centroid} pinColor="#DC2626" />
          )}
        </MapView>
      ) : (
        <View style={styles.fallback}>
          <Text style={styles.fallbackEmoji}>📍</Text>
          <Text style={styles.fallbackText}>Coordenadas calculando...</Text>
        </View>
      )}

      {/* Badge de área afetada sobreposto ao mapa */}
      <View style={styles.areaBadge}>
        <Text style={styles.areaBadgeText}>
          ⚠ {anomaly.affected_area_ha.toFixed(1)} ha afetados
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: '#1a2e1a' },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  fallbackEmoji: { fontSize: 36 },
  fallbackText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  areaBadge: {
    position: 'absolute', bottom: 8, left: 8,
    backgroundColor: 'rgba(220,38,38,0.8)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  areaBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
