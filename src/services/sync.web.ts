import { fieldsAPI } from '@/services/api';
import { anomalyCacheDB, fieldCacheDB } from '@/services/database';

export async function syncAll() {
  return { inspectionsSynced: 0, inspectionsFailed: 0, tilesDownloaded: 0 };
}

export async function downloadFieldTiles(
  _fieldId: string,
  _tilesUrl: string,
  _onProgress?: (pct: number) => void
): Promise<void> {
  // A contingência web é online e não mantém PMTiles offline.
}

export async function cacheFieldData(fieldId: string, fieldName: string, farmName: string): Promise<void> {
  try {
    const [analysis, anomalies] = await Promise.all([
      fieldsAPI.getLatestAnalysis(fieldId),
      fieldsAPI.getAnomalies(fieldId),
    ]);
    await fieldCacheDB.upsert({
      field_id: fieldId,
      field_name: fieldName,
      farm_name: farmName,
      ndvi_mean: analysis?.ndvi_mean ?? undefined,
      last_analysis_date: analysis?.image_date ?? undefined,
    });
    await anomalyCacheDB.upsertMany(anomalies);
  } catch {
    // Cache em memória é opcional na contingência web.
  }
}
