import React, { RefObject, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GoogleFieldPolygonMap } from './GoogleFieldPolygonMap.web';
import { googleMapsWebKey } from './googleMaps.web';

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

const POINT_STYLE = 'width:22px;height:22px;border:2px solid white;border-radius:50%;background:#16A34A;color:white;text-align:center;line-height:18px;font-size:12px;font-weight:700;box-shadow:0 1px 5px #333';

function fitRegion(map: L.Map, region: Region) {
  map.fitBounds([
    [region.latitude - region.latitudeDelta / 2, region.longitude - region.longitudeDelta / 2],
    [region.latitude + region.latitudeDelta / 2, region.longitude + region.longitudeDelta / 2],
  ], { animate: false });
}

function OpenStreetMapFieldPolygonMap({
  mapRef, region, coordinates, onAddCoordinate, onMoveCoordinate, onInsertCoordinate,
  pointLabel, midpointLabel,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const onAddRef = useRef(onAddCoordinate);
  const [mapError, setMapError] = useState<string | null>(null);

  onAddRef.current = onAddCoordinate;

  useEffect(() => {
    if (!containerRef.current) return;
    let map: L.Map;
    try {
      map = L.map(containerRef.current, { zoomControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      markersRef.current = L.layerGroup().addTo(map);
      leafletRef.current = map;
      fitRegion(map, region);
      map.on('click', event => onAddRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng }));
      mapRef.current = { animateToRegion: (next: Region) => fitRegion(map, next) };
      setTimeout(() => map.invalidateSize(), 0);
    } catch {
      setMapError('Não foi possível abrir o mapa. Verifique sua conexão e tente novamente.');
      return;
    }
    return () => {
      mapRef.current = null;
      leafletRef.current = null;
      markersRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    if (leafletRef.current) fitRegion(leafletRef.current, region);
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  useEffect(() => {
    const layers = markersRef.current;
    if (!layers) return;
    layers.clearLayers();
    if (coordinates.length >= 2) {
      L.polyline(coordinates.map(point => [point.latitude, point.longitude]), { color: '#16A34A', weight: 3 }).addTo(layers);
    }
    if (coordinates.length >= 3) {
      L.polygon(coordinates.map(point => [point.latitude, point.longitude]), {
        color: '#16A34A', fillColor: '#16A34A', fillOpacity: 0.18, weight: 3,
      }).addTo(layers);
    }
    coordinates.forEach((point, index) => {
      const marker = L.marker([point.latitude, point.longitude], {
        draggable: Boolean(onMoveCoordinate),
        icon: L.divIcon({ className: '', html: `<div style="${POINT_STYLE}">${index + 1}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] }),
        title: `${pointLabel} ${index + 1}`,
      }).addTo(layers);
      marker.on('click', event => L.DomEvent.stopPropagation(event));
      marker.on('dragend', () => {
        const position = marker.getLatLng();
        onMoveCoordinate?.(index, { latitude: position.lat, longitude: position.lng });
      });
      if (onInsertCoordinate && coordinates.length > 1) {
        const next = coordinates[(index + 1) % coordinates.length];
        if (index === coordinates.length - 1 && coordinates.length < 3) return;
        const midpoint = L.circleMarker([(point.latitude + next.latitude) / 2, (point.longitude + next.longitude) / 2], {
          radius: 7, color: '#fff', weight: 2, fillColor: '#F59E0B', fillOpacity: 1,
        }).addTo(layers);
        midpoint.bindTooltip(midpointLabel ?? 'Adicionar ponto');
        midpoint.on('click', event => {
          L.DomEvent.stopPropagation(event);
          onInsertCoordinate(index + 1, { latitude: event.latlng.lat, longitude: event.latlng.lng });
        });
      }
    });
  }, [coordinates, onMoveCoordinate, onInsertCoordinate, pointLabel, midpointLabel]);

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 300, width: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
      <div style={{ position: 'absolute', left: 8, top: 8, zIndex: 1000, background: 'white', borderRadius: 4, padding: '4px 7px', fontSize: 11 }}>
        Mapa OpenStreetMap · toque para marcar o talhão
      </div>
      {mapError && <div role="alert" style={{ position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 1000, background: 'white', padding: 8 }}>{mapError}</div>}
    </div>
  );
}

export const FieldPolygonMap = googleMapsWebKey ? GoogleFieldPolygonMap : OpenStreetMapFieldPolygonMap;
