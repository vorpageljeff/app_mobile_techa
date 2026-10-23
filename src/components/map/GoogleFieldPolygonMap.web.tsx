import React, { RefObject, useEffect, useRef, useState } from 'react';
import { Coordinate, fitGoogleRegion, GOOGLE_MAPS_AUTH_ERROR, loadGoogleMaps, Region } from './googleMaps.web';

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

export function GoogleFieldPolygonMap({
  mapRef, region, coordinates, onAddCoordinate, onMoveCoordinate, onInsertCoordinate,
  pointLabel, midpointLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<{ maps: any; map: any } | null>(null);
  const onAddRef = useRef(onAddCoordinate);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  onAddRef.current = onAddCoordinate;

  useEffect(() => {
    const showAuthError = () => setError('Google Maps recusou a chave. Confira Maps JavaScript API, faturamento e domínio autorizado.');
    window.addEventListener(GOOGLE_MAPS_AUTH_ERROR, showAuthError);
    return () => window.removeEventListener(GOOGLE_MAPS_AUTH_ERROR, showAuthError);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let listener: any;
    loadGoogleMaps().then(maps => {
      if (cancelled || !containerRef.current) return;
      const map = new maps.Map(containerRef.current, {
        center: { lat: region.latitude, lng: region.longitude }, zoom: 13,
        mapTypeId: 'satellite', streetViewControl: false, fullscreenControl: false,
      });
      instanceRef.current = { maps, map };
      fitGoogleRegion(maps, map, region);
      listener = map.addListener('click', (event: any) => {
        if (event.latLng) onAddRef.current({ latitude: event.latLng.lat(), longitude: event.latLng.lng() });
      });
      mapRef.current = { animateToRegion: (next: Region) => fitGoogleRegion(maps, map, next) };
      setReady(true);
    }).catch(() => {
      if (!cancelled) setError('Não foi possível abrir o Google Maps. Confira a chave, o domínio autorizado e sua conexão.');
    });
    return () => {
      cancelled = true;
      listener?.remove();
      mapRef.current = null;
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = instanceRef.current;
    if (instance) fitGoogleRegion(instance.maps, instance.map, region);
  }, [ready, region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const { maps, map } = instance;
    const layers: any[] = [];
    if (coordinates.length >= 2) {
      const shape = coordinates.length >= 3
        ? new maps.Polygon({ paths: coordinates.map(p => ({ lat: p.latitude, lng: p.longitude })), strokeColor: '#16A34A', strokeWeight: 3, fillColor: '#16A34A', fillOpacity: 0.18, map })
        : new maps.Polyline({ path: coordinates.map(p => ({ lat: p.latitude, lng: p.longitude })), strokeColor: '#16A34A', strokeWeight: 3, map });
      layers.push(shape);
    }
    coordinates.forEach((point, index) => {
      const marker = new maps.Marker({
        map, position: { lat: point.latitude, lng: point.longitude },
        draggable: Boolean(onMoveCoordinate), title: `${pointLabel} ${index + 1}`,
        label: { text: String(index + 1), color: '#FFFFFF', fontWeight: 'bold' },
        icon: { path: maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#16A34A', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
      });
      layers.push(marker);
      marker.addListener('dragend', (event: any) => {
        if (event.latLng) onMoveCoordinate?.(index, { latitude: event.latLng.lat(), longitude: event.latLng.lng() });
      });
      if (onInsertCoordinate && coordinates.length > 1 && (index < coordinates.length - 1 || coordinates.length >= 3)) {
        const next = coordinates[(index + 1) % coordinates.length];
        const midpoint = new maps.Marker({
          map, position: { lat: (point.latitude + next.latitude) / 2, lng: (point.longitude + next.longitude) / 2 },
          title: midpointLabel ?? 'Adicionar ponto',
          icon: { path: maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#F59E0B', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 2 },
        });
        layers.push(midpoint);
        midpoint.addListener('click', () => onInsertCoordinate(index + 1, {
          latitude: (point.latitude + next.latitude) / 2,
          longitude: (point.longitude + next.longitude) / 2,
        }));
      }
    });
    return () => layers.forEach(layer => layer.setMap(null));
  }, [ready, coordinates, onMoveCoordinate, onInsertCoordinate, pointLabel, midpointLabel]);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 300, width: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
      <div style={{ position: 'absolute', left: 8, top: 8, zIndex: 1, background: 'white', borderRadius: 4, padding: '4px 7px', fontSize: 11 }}>
        Google Maps · toque para marcar o talhão
      </div>
      {error && <div role="alert" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 1, background: 'white', padding: 8 }}>{error}</div>}
    </div>
  );
}
