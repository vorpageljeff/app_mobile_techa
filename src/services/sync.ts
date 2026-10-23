// ─────────────────────────────────────────────────────────────────
// src/services/sync.ts
// Sprint 4: Motor de sincronização offline → online
//
// Quando o app detecta que voltou ao sinal:
//  1. Envia inspeções pendentes ao servidor
//  2. Atualiza cache de anomalias e análises NDVI
//  3. Baixa tiles de novos talhões em Wi-Fi
// ─────────────────────────────────────────────────────────────────

import * as FileSystem from 'expo-file-system/legacy';
import * as Network from 'expo-network';
import { API_URL, anomaliesAPI, fieldsAPI } from '@/services/api';
import { pendingInspDB, fieldCacheDB, anomalyCacheDB } from '@/services/database';
import { useOfflineStore } from '@/store/offline';
import { showLocalNotification } from '@/services/notifications';

const TILES_DIR = `${FileSystem.documentDirectory}techa_tiles/`;

// ── Sincronização principal ───────────────────────────────────────
export async function syncAll(): Promise<{
  inspectionsSynced: number;
  inspectionsFailed: number;
  tilesDownloaded: number;
}> {
  const results = { inspectionsSynced: 0, inspectionsFailed: 0, tilesDownloaded: 0 };

  // 1. Sincroniza inspeções pendentes
  const pending = await pendingInspDB.getPending();
  for (const insp of pending) {
    try {
      // Upload de foto se tiver arquivo local
      let photoUrl: string | null = null;
      if (insp.photo_local_uri) {
        try {
          photoUrl = await _uploadPhoto(insp.photo_local_uri);
        } catch {
          // Foto falhou mas envia inspeção sem ela
        }
      }

      await anomaliesAPI.registerInspection(insp.anomaly_id, {
        photo_url: photoUrl,
        notes: insp.notes ?? null,
        confirmed_issue: insp.confirmed_issue,
        location_lat: insp.latitude ?? null,
        location_lon: insp.longitude ?? null,
      });
      await pendingInspDB.markSynced(insp.local_id);
      results.inspectionsSynced++;
    } catch {
      await pendingInspDB.incrementAttempt(insp.local_id);
      results.inspectionsFailed++;
    }
  }

  // 2. Atualiza contagem no store global
  const remaining = await pendingInspDB.count();
  useOfflineStore.getState().setPendingSyncCount(remaining);

  // 3. Notificação de conclusão do sync
  if (results.inspectionsSynced > 0) {
    await showLocalNotification(
      '✅ Inspeções sincronizadas',
      `${results.inspectionsSynced} inspeção(ões) enviada(s) ao servidor com sucesso.`,
      { type: 'sync_complete' }
    );
  }

  // 3. Baixa tiles de campos ainda sem cache (somente em Wi-Fi)
  const netState = await Network.getNetworkStateAsync();
  const isWifi = netState.type === Network.NetworkStateType.WIFI;

  if (isWifi) {
    const fields = await fieldCacheDB.getAll();
    for (const field of fields) {
      if (!field.tiles_ready && field.tiles_url) {
        try {
          await downloadFieldTiles(field.field_id, field.tiles_url);
          results.tilesDownloaded++;
        } catch {
          // silencia — tentará novamente no próximo ciclo
        }
      }
    }
  }

  return results;
}

// ── Download de tiles PMTiles ─────────────────────────────────────
export async function downloadFieldTiles(
  fieldId: string,
  tilesUrl: string,
  onProgress?: (pct: number) => void
): Promise<void> {
  const { setCacheStatus, setDownloadProgress } = useOfflineStore.getState();
  setCacheStatus(fieldId, 'downloading');

  const dir = `${TILES_DIR}${fieldId}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const destPath = `${dir}tiles.pmtiles`;

  try {
    const downloadResumable = FileSystem.createDownloadResumable(
      tilesUrl,
      destPath,
      {},
      (evt: FileSystem.DownloadProgressData) => {
        const pct = Math.round(
          (evt.totalBytesWritten / evt.totalBytesExpectedToWrite) * 100
        );
        setDownloadProgress(fieldId, pct);
        onProgress?.(pct);
      }
    );

    await downloadResumable.downloadAsync();

    // Calcula tamanho em KB
    const info = await FileSystem.getInfoAsync(destPath);
    const sizeKb = Math.round(('size' in info ? (info.size ?? 0) : 0) / 1024);

    await fieldCacheDB.setTilesReady(fieldId, destPath, sizeKb);
    setCacheStatus(fieldId, 'ready');
    setDownloadProgress(fieldId, 100);
  } catch (err) {
    setCacheStatus(fieldId, 'error');
    throw err;
  }
}

// ── Upload de foto de inspeção ────────────────────────────────────
async function _uploadPhoto(localUri: string): Promise<string> {
  const { getToken } = await import('@/services/api');
  const token = await getToken();

  const formData = new FormData();
  const filename = localUri.split('/').pop() ?? 'photo.jpg';
  formData.append('file', { uri: localUri, name: filename, type: 'image/jpeg' } as any);

  const res = await fetch(`${API_URL}/upload/inspection-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) throw new Error(`Upload falhou: ${res.status}`);
  const data = await res.json();
  return data.url as string;
}

// ── Caching de dados de campo na abertura ─────────────────────────
export async function cacheFieldData(fieldId: string, fieldName: string, farmName: string): Promise<void> {
  try {
    // Busca análise mais recente e anomalias para salvar offline
    const [analysis, anomalies] = await Promise.all([
      fieldsAPI.getLatestAnalysis(fieldId),
      fieldsAPI.getAnomalies(fieldId),
    ]);

    await fieldCacheDB.upsert({
      field_id: fieldId,
      field_name: fieldName,
      farm_name: farmName,
      tiles_url: analysis?.tiles_path
        ? `${API_URL}/tiles/${fieldId}/tiles.pmtiles`
        : undefined,
      ndvi_mean: analysis?.ndvi_mean ?? undefined,
      last_analysis_date: analysis?.image_date ?? undefined,
    });

    if (anomalies.length > 0) {
      await anomalyCacheDB.upsertMany(anomalies);
    }

    // Verifica se já tem tiles em cache local
    const cached = await fieldCacheDB.get(fieldId);
    if (cached?.tiles_ready) {
      useOfflineStore.getState().setCacheStatus(fieldId, 'ready');
    } else if (cached?.tiles_url) {
      useOfflineStore.getState().setCacheStatus(fieldId, 'pending');
    }
  } catch {
    // Não crítico — app funciona mesmo sem cache atualizado
  }
}
