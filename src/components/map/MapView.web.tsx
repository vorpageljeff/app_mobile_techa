import React, { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import GoogleMapView, { GoogleMarker, GoogleOverlay, GooglePolygon } from './GoogleMapView.web';
import { googleMapsWebKey } from './googleMaps.web';

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
type Coordinate = { latitude: number; longitude: number };

export const PROVIDER_GOOGLE = 'google';
const MapContext = createContext<L.Map | null>(null);

function fitRegion(map: L.Map, region: Region) {
  map.fitBounds([
    [region.latitude - region.latitudeDelta / 2, region.longitude - region.longitudeDelta / 2],
    [region.latitude + region.latitudeDelta / 2, region.longitude + region.longitudeDelta / 2],
  ], { animate: false });
}

function OpenStreetMapMarker({ coordinate, pinColor = '#DC2626', onPress }: {
  coordinate: Coordinate; pinColor?: string; onPress?: () => void;
}) {
  const map = useContext(MapContext);
  useEffect(() => {
    if (!map) return;
    const marker = L.circleMarker([coordinate.latitude, coordinate.longitude], {
      radius: 9, color: '#FFF', weight: 2, fillColor: pinColor, fillOpacity: 1,
    }).addTo(map);
    if (onPress) marker.on('click', onPress);
    return () => { marker.remove(); };
  }, [map, coordinate.latitude, coordinate.longitude, pinColor, onPress]);
  return null;
}

function OpenStreetMapPolygon({ coordinates, strokeColor = '#16A34A', fillColor = 'rgba(22,163,74,0.2)', strokeWidth = 2 }: {
  coordinates: Coordinate[]; strokeColor?: string; fillColor?: string; strokeWidth?: number;
}) {
  const map = useContext(MapContext);
  useEffect(() => {
    if (!map || coordinates.length < 3) return;
    const polygon = L.polygon(coordinates.map(point => [point.latitude, point.longitude]), {
      color: strokeColor, fillColor, fillOpacity: 0.3, weight: strokeWidth,
    }).addTo(map);
    return () => { polygon.remove(); };
  }, [map, coordinates, strokeColor, fillColor, strokeWidth]);
  return null;
}

function OpenStreetMapOverlay({ image, bounds, opacity = 0.82 }: {
  image: string | { uri?: string }; bounds: [[number, number], [number, number]]; opacity?: number;
}) {
  const map = useContext(MapContext);
  const uri = typeof image === 'string' ? image : image?.uri;
  useEffect(() => {
    if (!map || !uri) return;
    const overlay = L.imageOverlay(uri, bounds, { opacity }).addTo(map);
    return () => { overlay.remove(); };
  }, [map, uri, bounds, opacity]);
  return null;
}

const OpenStreetMapMapView = forwardRef<any, any>(function WebMapView({ style, initialRegion, region, children, scrollEnabled = true, zoomEnabled = true }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion(next: Region) { if (mapRef.current) fitRegion(mapRef.current, next); },
  }), []);

  useEffect(() => {
    if (!containerRef.current) return;
    const instance = L.map(containerRef.current, { zoomControl: zoomEnabled, scrollWheelZoom: scrollEnabled })
      .setView([-25.397, -54.611], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(instance);
    const firstRegion = region ?? initialRegion;
    if (firstRegion) fitRegion(instance, firstRegion);
    mapRef.current = instance;
    setMap(instance);
    setTimeout(() => instance.invalidateSize(), 0);
    return () => {
      setMap(null);
      mapRef.current = null;
      instance.remove();
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && region) fitRegion(mapRef.current, region);
  }, [region?.latitude, region?.longitude, region?.latitudeDelta, region?.longitudeDelta]);

  return (
    <View style={[style, styles.container]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 200 }} />
      <MapContext.Provider value={map}>{map ? children : null}</MapContext.Provider>
    </View>
  );
});

const styles = StyleSheet.create({ container: { minHeight: 200, overflow: 'hidden', backgroundColor: '#E8F5E9' } });
export const Marker = googleMapsWebKey ? GoogleMarker : OpenStreetMapMarker;
export const Polygon = googleMapsWebKey ? GooglePolygon : OpenStreetMapPolygon;
export const Overlay = googleMapsWebKey ? GoogleOverlay : OpenStreetMapOverlay;
const MapView = googleMapsWebKey ? GoogleMapView : OpenStreetMapMapView;
export default MapView;
