// src/hooks/useNetwork.ts
// Monitora conectividade real com a API e dispara sincronizacao pendente.

import { useEffect, useRef } from 'react';
import * as Network from 'expo-network';
import { AppState, AppStateStatus } from 'react-native';
import { useOfflineStore } from '@/store/offline';
import { syncAll } from '@/services/sync';
import { pendingInspDB } from '@/services/database';
import { checkApiHealth } from '@/services/api';

const SYNC_RETRY_INTERVAL_MS = 2 * 60 * 1000;

export function useNetworkMonitor() {
  const setOnline = useOfflineStore(s => s.setOnline);
  const wasOffline = useRef(false);
  const isSyncing = useRef(false);
  const lastSyncAttemptAt = useRef(0);

  const refreshPendingCount = async () => {
    try {
      const count = await pendingInspDB.count();
      useOfflineStore.getState().setPendingSyncCount(count);
      return count;
    } catch {
      return useOfflineStore.getState().pendingSyncCount;
    }
  };

  const checkAndSync = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const hasNetwork = state.isConnected === true && state.isInternetReachable !== false;
      const online = hasNetwork ? await checkApiHealth() : false;
      setOnline(online);

      const pendingCount = await refreshPendingCount();
      const now = Date.now();
      const canTrySync = now - lastSyncAttemptAt.current > SYNC_RETRY_INTERVAL_MS;

      if (online && !isSyncing.current && canTrySync && (wasOffline.current || pendingCount > 0)) {
        wasOffline.current = false;
        isSyncing.current = true;
        lastSyncAttemptAt.current = now;

        try {
          const result = await syncAll();
          if (result.inspectionsSynced > 0) {
            console.log(`[Sync] ${result.inspectionsSynced} inspecao(oes) sincronizada(s)`);
          }
        } catch (err) {
          console.warn('[Sync] Falha na sincronizacao:', err);
        } finally {
          isSyncing.current = false;
          await refreshPendingCount();
        }
      } else if (!online) {
        wasOffline.current = true;
      }
    } catch (err) {
      setOnline(false);
      wasOffline.current = true;
      console.warn('[Network] Erro ao verificar conectividade:', err);
    }
  };

  useEffect(() => {
    checkAndSync();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkAndSync();
    });

    const interval = setInterval(checkAndSync, 30_000);

    return () => {
      sub.remove();
      clearInterval(interval);
    };
  }, []);
}
