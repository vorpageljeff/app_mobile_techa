type Row = Record<string, any>;

const fields = new Map<string, Row>();
const pending = new Map<string, Row>();
const anomalies = new Map<string, Row>();

export async function getDB(): Promise<null> {
  return null;
}

export const fieldCacheDB = {
  upsert: async (data: Row) => {
    fields.set(data.field_id, { ...fields.get(data.field_id), ...data, cached_at: new Date().toISOString() });
  },
  setTilesReady: async (fieldId: string, localPath: string, sizeKb: number) => {
    fields.set(fieldId, { ...fields.get(fieldId), tiles_local_path: localPath, tiles_ready: 1, tiles_size_kb: sizeKb });
  },
  get: async (fieldId: string) => fields.get(fieldId) ?? null,
  getAll: async () => Array.from(fields.values()),
  getTotalSizeKB: async () => 0,
};

export const pendingInspDB = {
  save: async (inspection: Row) => {
    const localId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pending.set(localId, { ...inspection, local_id: localId, sync_attempts: 0 });
    return localId;
  },
  getAll: async () => Array.from(pending.values()),
  getPending: async () => Array.from(pending.values()),
  markSynced: async (localId: string) => { pending.delete(localId); },
  incrementAttempt: async (localId: string) => {
    const item = pending.get(localId);
    if (item) pending.set(localId, { ...item, sync_attempts: (item.sync_attempts ?? 0) + 1 });
  },
  count: async () => pending.size,
};

export const anomalyCacheDB = {
  upsertMany: async (items: Row[]) => {
    items.forEach((item) => anomalies.set(item.id, item));
  },
  getForField: async (fieldId: string) => Array.from(anomalies.values()).filter((item) => item.field_id === fieldId),
  getById: async (id: string) => anomalies.get(id) ?? null,
};
