import React, { RefObject, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { hasGoogleMapsAndroidKey } from '@/config/maps';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type Coordinate = { latitude: number; longitude: number };

type Props = {
  mapRef: RefObject<any>;
  region: Region;
  coordinates: Coordinate[];
  onAddCoordinate: (coordinate: Coordinate) => void;
  onMoveCoordinate?: (index: number, coordinate: Coordinate) => void;
  onInsertCoordinate?: (index: number, coordinate: Coordinate) => void;
  pointLabel: string;
  midpointLabel?: string;
};

export function FieldPolygonMap({
  mapRef,
  region,
  coordinates,
  onAddCoordinate,
  onMoveCoordinate,
  onInsertCoordinate,
  pointLabel,
  midpointLabel = '+',
}: Props) {
  const [fallbackSize, setFallbackSize] = useState({ width: 1, height: 1 });
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const shouldUseNativeMap = useMemo(() => hasGoogleMapsAndroidKey(), []);

  if (shouldUseNativeMap) {
    const Maps = require('react-native-maps') as typeof import('react-native-maps');
    const NativeMapView = Maps.default;
    const { Marker, Polygon } = Maps;
    const midpointMarkers = buildMidpoints(coordinates);

    return (
      <NativeMapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? Maps.PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onPress={(event) => onAddCoordinate(event.nativeEvent.coordinate)}
        mapType="satellite"
        showsUserLocation
        showsMyLocationButton
      >
        {coordinates.map((coord, index) => (
          <Marker
            key={index}
            coordinate={coord}
            title={`${pointLabel} ${index + 1}`}
            pinColor={selectedIndex === index ? '#F59E0B' : '#16A34A'}
            draggable={Boolean(onMoveCoordinate)}
            onPress={(event) => {
              event.stopPropagation?.();
              setSelectedIndex(index);
            }}
            onDragEnd={(event) => onMoveCoordinate?.(index, event.nativeEvent.coordinate)}
          />
        ))}
        {onInsertCoordinate && midpointMarkers.map((midpoint) => (
          <Marker
            key={`mid-${midpoint.index}`}
            coordinate={midpoint.coordinate}
            title={midpointLabel}
            pinColor="#2563EB"
            opacity={0.9}
            onPress={(event) => {
              event.stopPropagation?.();
              onInsertCoordinate(midpoint.insertAt, midpoint.coordinate);
            }}
          />
        ))}
        {coordinates.length >= 3 && (
          <Polygon
            coordinates={coordinates}
            strokeColor="#16A34A"
            fillColor="rgba(22,163,74,0.25)"
            strokeWidth={2}
          />
        )}
      </NativeMapView>
    );
  }

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFallbackSize({ width: Math.max(width, 1), height: Math.max(height, 1) });
  };

  return (
    <Pressable
      style={styles.fallbackMap}
      onLayout={onLayout}
      onPress={(event) => {
        const { locationX, locationY } = event.nativeEvent;
        const coordinate = {
          latitude: region.latitude - (locationY / fallbackSize.height - 0.5) * region.latitudeDelta,
          longitude: region.longitude + (locationX / fallbackSize.width - 0.5) * region.longitudeDelta,
        };

        if (selectedIndex !== null && onMoveCoordinate) {
          onMoveCoordinate(selectedIndex, coordinate);
          setSelectedIndex(null);
          return;
        }

        onAddCoordinate(coordinate);
      }}
    >
      <View style={styles.gridLineVertical} />
      <View style={styles.gridLineHorizontal} />
      <Text style={styles.fallbackTitle}>Mapa indisponivel neste APK</Text>
      <Text style={styles.fallbackText}>
        Toque nesta area para marcar os vertices. Para mapa satelite no APK, configure a chave do Google Maps.
      </Text>
      {onInsertCoordinate && buildMidpoints(coordinates).map((midpoint) => {
        const left = ((midpoint.coordinate.longitude - region.longitude) / region.longitudeDelta + 0.5) * fallbackSize.width;
        const top = ((region.latitude - midpoint.coordinate.latitude) / region.latitudeDelta + 0.5) * fallbackSize.height;

        return (
          <Pressable
            key={`fallback-mid-${midpoint.index}`}
            style={[
              styles.fallbackMidpoint,
              {
                left: Math.max(8, Math.min(fallbackSize.width - 22, left)),
                top: Math.max(8, Math.min(fallbackSize.height - 22, top)),
              },
            ]}
            onPress={(event) => {
              event.stopPropagation?.();
              onInsertCoordinate(midpoint.insertAt, midpoint.coordinate);
            }}
            hitSlop={8}
          >
            <Text style={styles.fallbackMidpointText}>+</Text>
          </Pressable>
        );
      })}
      {coordinates.map((coord, index) => {
        const left = ((coord.longitude - region.longitude) / region.longitudeDelta + 0.5) * fallbackSize.width;
        const top = ((region.latitude - coord.latitude) / region.latitudeDelta + 0.5) * fallbackSize.height;

        return (
          <View
            key={`${coord.latitude}-${coord.longitude}-${index}`}
            style={[
              styles.fallbackPoint,
              selectedIndex === index && styles.fallbackPointSelected,
              {
                left: Math.max(8, Math.min(fallbackSize.width - 24, left)),
                top: Math.max(8, Math.min(fallbackSize.height - 24, top)),
              },
            ]}
          >
            <Pressable onPress={() => setSelectedIndex(index)} hitSlop={10}>
              <Text style={styles.fallbackPointText}>{index + 1}</Text>
            </Pressable>
          </View>
        );
      })}
    </Pressable>
  );
}

function buildMidpoints(coordinates: Coordinate[]) {
  if (coordinates.length < 2) return [];

  const edgeCount = coordinates.length >= 3 ? coordinates.length : coordinates.length - 1;
  return Array.from({ length: edgeCount }, (_, index) => {
    const current = coordinates[index];
    const nextIndex = (index + 1) % coordinates.length;
    const next = coordinates[nextIndex];

    return {
      index,
      insertAt: index + 1,
      coordinate: {
        latitude: (current.latitude + next.latitude) / 2,
        longitude: (current.longitude + next.longitude) / 2,
      },
    };
  });
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  fallbackMap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  gridLineVertical: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(26,71,49,0.12)',
  },
  gridLineHorizontal: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(26,71,49,0.12)',
  },
  fallbackTitle: {
    color: '#1A4731',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackText: {
    color: '#2F4F3F',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  fallbackPoint: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  fallbackPointSelected: {
    backgroundColor: '#F59E0B',
  },
  fallbackMidpoint: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  fallbackMidpointText: {
    color: '#FFF',
    fontSize: 13,
    lineHeight: 14,
    fontWeight: '800',
  },
  fallbackPointText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
});
