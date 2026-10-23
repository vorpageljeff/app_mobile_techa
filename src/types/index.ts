// src/types/index.ts — Tipos centrais do Techá Mobile

export interface User {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise' | 'admin';
  is_active?: boolean;
  must_change_password?: boolean;
  last_login_at?: string | null;
}

export interface Farm {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  fields_count?: number;
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJSONMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export type GeoJSONGeometry = GeoJSONPolygon | GeoJSONMultiPolygon;

export interface Field {
  id: string;
  farm_id: string;
  name: string;
  crop: string | null;
  planting_date: string | null;
  area_ha: number | null;
  geometry_geojson: GeoJSONGeometry | null;
  geometry?: GeoJSONGeometry | null;
}

export interface SatelliteAnalysis {
  id: string;
  field_id: string;
  image_date: string;
  source: string;
  cloud_cover_pct: number | null;
  ndvi_mean: number | null;
  ndvi_min: number | null;
  ndvi_max: number | null;
  tiles_path: string | null;
  /**
   * URL completa do PNG NDVI já mascarado pelo polígono (pixels fora = transparentes).
   * Retornado pelo backend em /analyses/latest. Requer Authorization: Bearer <token>.
   */
  tile_url: string | null;
  /**
   * Bounding box do talhão com 15% de buffer aplicado pelo backend.
   * Formato GeoJSON: [west, south, east, north] (graus decimais WGS84).
   */
  bounds: [number, number, number, number] | null;
  status: 'valid' | 'discarded_cloud' | 'processing' | 'error';
  processed_at: string;
}

export type AnomalyStatus = 'active' | 'inspected' | 'resolved';
export type SuspectedType = 'hidrico' | 'praga' | 'nutricional' | 'low_ndvi' | 'unknown';

export interface Anomaly {
  id: string;
  field_id: string;
  analysis_id: string;
  detected_at: string;
  ndvi_drop_pct: number;
  affected_area_ha: number;
  suspected_type: SuspectedType;
  status: AnomalyStatus;
  push_sent: boolean;
  field_name?: string | null;
  geometry_geojson: { type: 'MultiPolygon'; coordinates: number[][][][] } | null;
  centroid?: { latitude: number; longitude: number } | null;
}

export interface FieldInspection {
  id?: string;
  anomaly_id: string;
  photo_url: string | null;
  notes: string | null;
  confirmed_issue: string | null;
  latitude: number | null;
  longitude: number | null;
  recorded_at: string;
  pending_sync?: boolean;
}

export type OfflineStatus = 'ready' | 'downloading' | 'pending' | 'error';

export const NDVI_COLOR_MAP = [
  { min: -1.0, max: 0.2,  color: '#DC2626', label: 'Crítico'   },
  { min: 0.2,  max: 0.4,  color: '#F59E0B', label: 'Alerta'    },
  { min: 0.4,  max: 0.6,  color: '#84CC16', label: 'Normal'    },
  { min: 0.6,  max: 1.0,  color: '#16A34A', label: 'Excelente' },
];

export function getNDVIColor(ndvi: number): string {
  return NDVI_COLOR_MAP.find(r => ndvi >= r.min && ndvi < r.max)?.color ?? '#6B7280';
}
export function getNDVILabel(ndvi: number): string {
  return NDVI_COLOR_MAP.find(r => ndvi >= r.min && ndvi < r.max)?.label ?? 'Sem dados';
}
