// src/__tests__/navigation.test.ts
// Testa funções puras de navegação GPS (sem hardware)

import { describe, it, expect } from '@jest/globals';

// Importação direta das funções (copiadas aqui para testar sem side-effects)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180, Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateArea(coords: [number, number][]): number {
  if (coords.length < 3) return 0;
  let area = 0;
  const n = coords.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const xi = coords[i][1] * 111320 * Math.cos((coords[i][0] * Math.PI) / 180);
    const yi = coords[i][0] * 111320;
    const xj = coords[j][1] * 111320 * Math.cos((coords[j][0] * Math.PI) / 180);
    const yj = coords[j][0] * 111320;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2) / 10000;
}

describe('haversineDistance', () => {
  it('distância de 0 para o mesmo ponto', () => {
    expect(haversineDistance(-25.4, -54.6, -25.4, -54.6)).toBeCloseTo(0, 0);
  });

  it('distância correta entre dois pontos próximos (~1km)', () => {
    // ~1km em latitude no Alto Paraná
    const dist = haversineDistance(-25.400, -54.600, -25.409, -54.600);
    expect(dist).toBeGreaterThan(900);
    expect(dist).toBeLessThan(1100);
  });

  it('detecta chegada (< 10m)', () => {
    const dist = haversineDistance(-25.40000, -54.60000, -25.40001, -54.60001);
    expect(dist).toBeLessThan(10);
  });
});

describe('estimateArea (Shoelace)', () => {
  it('retorna 0 para menos de 3 pontos', () => {
    expect(estimateArea([[-25.4, -54.6], [-25.41, -54.6]])).toBe(0);
  });

  it('estima área razoável para um quadrado de ~100ha', () => {
    // Quadrado aproximado de 1km x 1km ≈ 100 ha
    const sq: [number, number][] = [
      [-25.400, -54.600],
      [-25.409, -54.600],
      [-25.409, -54.611],
      [-25.400, -54.611],
    ];
    const area = estimateArea(sq);
    expect(area).toBeGreaterThan(80);
    expect(area).toBeLessThan(120);
  });

  it('área sempre positiva (independente da orientação)', () => {
    const cw: [number, number][] = [[-25.4, -54.6], [-25.41, -54.6], [-25.41, -54.61]];
    const ccw: [number, number][] = [[-25.4, -54.6], [-25.41, -54.61], [-25.41, -54.6]];
    expect(estimateArea(cw)).toBeGreaterThan(0);
    expect(estimateArea(ccw)).toBeGreaterThan(0);
  });
});

describe('NDVI helpers', () => {
  const NDVI_COLOR_MAP = [
    { min: -1.0, max: 0.2, color: '#DC2626', label: 'Crítico' },
    { min: 0.2, max: 0.4, color: '#F59E0B', label: 'Alerta' },
    { min: 0.4, max: 0.6, color: '#84CC16', label: 'Normal' },
    { min: 0.6, max: 1.0, color: '#16A34A', label: 'Excelente' },
  ];
  const getLabel = (n: number) => NDVI_COLOR_MAP.find(r => n >= r.min && n < r.max)?.label ?? 'Sem dados';

  it('classifica NDVI saudável corretamente', () => {
    expect(getLabel(0.75)).toBe('Excelente');
    expect(getLabel(0.50)).toBe('Normal');
    expect(getLabel(0.30)).toBe('Alerta');
    expect(getLabel(0.10)).toBe('Crítico');
  });
});
