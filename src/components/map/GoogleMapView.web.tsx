import React, { createContext, forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Coordinate, fitGoogleRegion, GOOGLE_MAPS_AUTH_ERROR, loadGoogleMaps, Region } from './googleMaps.web';

type Instance = { maps: any; map: any };
const MapContext = createContext<Instance | null>(null);

export function GoogleMarker({ coordinate, pinColor = '#DC2626', onPress }: {
  coordinate: Coordinate; pinColor?: string; onPress?: () => void;
}) {
  const instance = useContext(MapContext);
  useEffect(() => {
    if (!instance) return;
    const marker = new instance.maps.Marker({
      map: instance.map, position: { lat: coordinate.latitude, lng: coordinate.longitude },
      icon: { path: instance.maps.SymbolPath.CIRCLE, scale: 9, fillColor: pinColor, fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
    });
    const listener = onPress ? marker.addListener('click', onPress) : null;
    return () => { listener?.remove(); marker.setMap(null); };
  }, [instance, coordinate.latitude, coordinate.longitude, pinColor, onPress]);
  return null;
}

export function GooglePolygon({ coordinates, strokeColor = '#16A34A', fillColor = '#16A34A', strokeWidth = 2 }: {
  coordinates: Coordinate[]; strokeColor?: string; fillColor?: string; strokeWidth?: number;
}) {
  const instance = useContext(MapContext);
  useEffect(() => {
    if (!instance || coordinates.length < 3) return;
    const polygon = new instance.maps.Polygon({
      map: instance.map, paths: coordinates.map(p => ({ lat: p.latitude, lng: p.longitude })),
      strokeColor, fillColor, fillOpacity: 0.3, strokeWeight: strokeWidth,
    });
    return () => polygon.setMap(null);
  }, [instance, coordinates, strokeColor, fillColor, strokeWidth]);
  return null;
}

export function GoogleOverlay({ image, bounds, opacity = 0.82 }: {
  image: string | { uri?: string }; bounds: [[number, number], [number, number]]; opacity?: number;
}) {
  const instance = useContext(MapContext);
  const uri = typeof image === 'string' ? image : image?.uri;
  useEffect(() => {
    if (!instance || !uri) return;
    const overlay = new instance.maps.GroundOverlay(uri, {
      south: bounds[0][0], west: bounds[0][1], north: bounds[1][0], east: bounds[1][1],
    }, { opacity });
    overlay.setMap(instance.map);
    return () => overlay.setMap(null);
  }, [instance, uri, bounds, opacity]);
  return null;
}

const GoogleMapView = forwardRef<any, any>(function GoogleMapView({ style, initialRegion, region, children, scrollEnabled = true, zoomEnabled = true }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<Instance | null>(null);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const showAuthError = () => setError('Google Maps recusou a chave. Confira Maps JavaScript API, faturamento e domínio autorizado.');
    window.addEventListener(GOOGLE_MAPS_AUTH_ERROR, showAuthError);
    return () => window.removeEventListener(GOOGLE_MAPS_AUTH_ERROR, showAuthError);
  }, []);

  useImperativeHandle(ref, () => ({
    animateToRegion(next: Region) {
      if (instanceRef.current) fitGoogleRegion(instanceRef.current.maps, instanceRef.current.map, next);
    },
  }), []);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then(maps => {
      if (cancelled || !containerRef.current) return;
      const first = region ?? initialRegion;
      const map = new maps.Map(containerRef.current, {
        center: { lat: first?.latitude ?? -25.397, lng: first?.longitude ?? -54.611 },
        zoom: 12, mapTypeId: 'satellite', streetViewControl: false, fullscreenControl: false,
        scrollwheel: scrollEnabled, zoomControl: zoomEnabled,
      });
      if (first) fitGoogleRegion(maps, map, first);
      const next = { maps, map };
      instanceRef.current = next;
      setInstance(next);
    }).catch(() => { if (!cancelled) setError('Não foi possível abrir o Google Maps. Confira a chave e o domínio autorizado.'); });
    return () => { cancelled = true; instanceRef.current = null; };
  }, []);

  useEffect(() => {
    if (instanceRef.current && region) fitGoogleRegion(instanceRef.current.maps, instanceRef.current.map, region);
  }, [region?.latitude, region?.longitude, region?.latitudeDelta, region?.longitudeDelta]);

  return (
    <View style={[style, styles.container]}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 200 }} />
      {error && <div role="alert" style={{ position: 'absolute', bottom: 8, left: 8, right: 8, background: '#FFF', padding: 8 }}>{error}</div>}
      <MapContext.Provider value={instance}>{instance ? children : null}</MapContext.Provider>
    </View>
  );
});

const styles = StyleSheet.create({ container: { minHeight: 200, overflow: 'hidden', backgroundColor: '#E8F5E9' } });
export default GoogleMapView;
