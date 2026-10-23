// src/store/offline.ts — Estado offline do app
import { create } from '@/store/zustand';
import { OfflineStatus } from '@/types';

interface OfflineStore {
  isOnline: boolean;
  fieldCacheStatus: Record<string, OfflineStatus>; // field_id → status
  downloadProgress: Record<string, number>;         // field_id → 0-100%
  pendingSyncCount: number;
  setOnline: (v: boolean) => void;
  setCacheStatus: (fieldId: string, status: OfflineStatus) => void;
  setDownloadProgress: (fieldId: string, pct: number) => void;
  setPendingSyncCount: (n: number) => void;
}

export const useOfflineStore = create<OfflineStore>((set) => ({
  isOnline: true,
  fieldCacheStatus: {},
  downloadProgress: {},
  pendingSyncCount: 0,
  setOnline: (isOnline) => set({ isOnline }),
  setCacheStatus: (fieldId, status) =>
    set((s) => ({ fieldCacheStatus: { ...s.fieldCacheStatus, [fieldId]: status } })),
  setDownloadProgress: (fieldId, pct) =>
    set((s) => ({ downloadProgress: { ...s.downloadProgress, [fieldId]: pct } })),
  setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
}));
