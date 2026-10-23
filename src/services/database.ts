// ─────────────────────────────────────────────────────────────────
// src/services/database.ts
// Sprint 4: SQLite local — armazena tudo que precisa funcionar offline
//
// Tabelas:
//   field_cache      → metadados dos tiles baixados por talhão
//   pending_inspections → inspeções registradas sem internet
//   anomaly_cache    → anomalias ativas para exibir offline
//   field_geometry   → polígonos dos talhões para o mapa offline
// ─────────────────────────────────────────────────────────────────

import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('techa.db');
  await initSchema(_db);
  return _db;
}

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS field_cache (
      field_id        TEXT PRIMARY KEY,
      field_name      TEXT NOT NULL,
      farm_name       TEXT NOT NULL,
      tiles_local_path TEXT,
      tiles_url       TEXT,
      geometry_json   TEXT,
      area_ha         REAL,
      ndvi_mean       REAL,
      last_analysis_date TEXT,
      cached_at       TEXT NOT NULL,
      tiles_ready     INTEGER DEFAULT 0,
      tiles_size_kb   INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS pending_inspections (
      local_id        TEXT PRIMARY KEY,
      anomaly_id      TEXT NOT NULL,
      photo_local_uri TEXT,
      notes           TEXT,
      confirmed_issue TEXT,
      latitude        REAL,
      longitude       REAL,
      recorded_at     TEXT NOT NULL,
      sync_attempts   INTEGER DEFAULT 0,
      last_attempt_at TEXT
    );

    CREATE TABLE IF NOT EXISTS anomaly_cache (
      id              TEXT PRIMARY KEY,
      field_id        TEXT NOT NULL,
      detected_at     TEXT NOT NULL,
      ndvi_drop_pct   REAL NOT NULL,
      affected_area_ha REAL NOT NULL,
      suspected_type  TEXT NOT NULL,
      status          TEXT NOT NULL,
      centroid_lat    REAL,
      centroid_lon    REAL,
      geometry_json   TEXT,
      cached_at       TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_anomaly_field
      ON anomaly_cache(field_id);
    CREATE INDEX IF NOT EXISTS idx_pending_anomaly
      ON pending_inspections(anomaly_id);
  `);
}

// ── Field Cache ───────────────────────────────────────────────────
export const fieldCacheDB = {
  upsert: async (data: {
    field_id: string; field_name: string; farm_name: string;
    tiles_url?: string; geometry_json?: string; area_ha?: number;
    ndvi_mean?: number; last_analysis_date?: string;
  }): Promise<void> => {
    const db = await getDB();
    await db.runAsync(
      `INSERT INTO field_cache
         (field_id, field_name, farm_name, tiles_url, geometry_json,
          area_ha, ndvi_mean, last_analysis_date, cached_at)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(field_id) DO UPDATE SET
         tiles_url=excluded.tiles_url,
         geometry_json=excluded.geometry_json,
         area_ha=excluded.area_ha,
         ndvi_mean=excluded.ndvi_mean,
         last_analysis_date=excluded.last_analysis_date,
         cached_at=excluded.cached_at`,
      [
        data.field_id, data.field_name, data.farm_name,
        data.tiles_url ?? null, data.geometry_json ?? null,
        data.area_ha ?? null, data.ndvi_mean ?? null,
        data.last_analysis_date ?? null,
        new Date().toISOString(),
      ]
    );
  },

  setTilesReady: async (field_id: string, local_path: string, size_kb: number): Promise<void> => {
    const db = await getDB();
    await db.runAsync(
      `UPDATE field_cache SET tiles_local_path=?, tiles_ready=1, tiles_size_kb=? WHERE field_id=?`,
      [local_path, size_kb, field_id]
    );
  },

  get: async (field_id: string) => {
    const db = await getDB();
    return db.getFirstAsync<any>(
      `SELECT * FROM field_cache WHERE field_id=?`, [field_id]
    );
  },

  getAll: async () => {
    const db = await getDB();
    return db.getAllAsync<any>(`SELECT * FROM field_cache ORDER BY cached_at DESC`);
  },

  getTotalSizeKB: async (): Promise<number> => {
    const db = await getDB();
    const row = await db.getFirstAsync<{ total: number }>(
      `SELECT COALESCE(SUM(tiles_size_kb),0) as total FROM field_cache WHERE tiles_ready=1`
    );
    return row?.total ?? 0;
  },
};

// ── Pending Inspections ───────────────────────────────────────────
export const pendingInspDB = {
  save: async (inspection: {
    anomaly_id: string; photo_local_uri?: string; notes?: string;
    confirmed_issue: string; latitude?: number; longitude?: number;
  }): Promise<string> => {
    const db = await getDB();
    const local_id = `insp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await db.runAsync(
      `INSERT INTO pending_inspections
         (local_id, anomaly_id, photo_local_uri, notes, confirmed_issue,
          latitude, longitude, recorded_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        local_id, inspection.anomaly_id,
        inspection.photo_local_uri ?? null, inspection.notes ?? null,
        inspection.confirmed_issue,
        inspection.latitude ?? null, inspection.longitude ?? null,
        new Date().toISOString(),
      ]
    );
    return local_id;
  },

  getAll: async () => {
    const db = await getDB();
    return db.getAllAsync<any>(
      `SELECT * FROM pending_inspections ORDER BY recorded_at DESC`
    );
  },

  getPending: async () => {
    const db = await getDB();
    return db.getAllAsync<any>(
      `SELECT * FROM pending_inspections WHERE sync_attempts < 5 ORDER BY recorded_at ASC`
    );
  },

  markSynced: async (local_id: string): Promise<void> => {
    const db = await getDB();
    await db.runAsync(`DELETE FROM pending_inspections WHERE local_id=?`, [local_id]);
  },

  incrementAttempt: async (local_id: string): Promise<void> => {
    const db = await getDB();
    await db.runAsync(
      `UPDATE pending_inspections SET sync_attempts=sync_attempts+1, last_attempt_at=? WHERE local_id=?`,
      [new Date().toISOString(), local_id]
    );
  },

  count: async (): Promise<number> => {
    const db = await getDB();
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) as n FROM pending_inspections`
    );
    return row?.n ?? 0;
  },
};

// ── Anomaly Cache ─────────────────────────────────────────────────
export const anomalyCacheDB = {
  upsertMany: async (anomalies: any[]): Promise<void> => {
    const db = await getDB();
    const now = new Date().toISOString();
    await db.withTransactionAsync(async () => {
      for (const a of anomalies) {
        const lat = a.centroid?.latitude ?? null;
        const lon = a.centroid?.longitude ?? null;
        await db.runAsync(
          `INSERT INTO anomaly_cache
             (id, field_id, detected_at, ndvi_drop_pct, affected_area_ha,
              suspected_type, status, centroid_lat, centroid_lon, geometry_json, cached_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET status=excluded.status, cached_at=excluded.cached_at`,
          [
            a.id, a.field_id, a.detected_at, a.ndvi_drop_pct, a.affected_area_ha,
            a.suspected_type, a.status, lat, lon,
            a.geometry_geojson ? JSON.stringify(a.geometry_geojson) : null,
            now,
          ]
        );
      }
    });
  },

  getForField: async (field_id: string) => {
    const db = await getDB();
    return db.getAllAsync<any>(
      `SELECT * FROM anomaly_cache WHERE field_id=? AND status='active' ORDER BY detected_at DESC`,
      [field_id]
    );
  },

  getById: async (id: string) => {
    const db = await getDB();
    return db.getFirstAsync<any>(`SELECT * FROM anomaly_cache WHERE id=?`, [id]);
  },
};
