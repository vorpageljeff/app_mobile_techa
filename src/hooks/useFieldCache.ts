// src/hooks/useFieldCache.ts
// Cache automático do talhão ao abrir o dashboard

import { useEffect } from 'react';
import { cacheFieldData, downloadFieldTiles } from '@/services/sync';
import { fieldCacheDB } from '@/services/database';
import { useOfflineStore } from '@/store/offline';
import * as Network from 'expo-network';

export function useFieldCache(fieldId: string, fieldName: string, farmName: string) {
  const setCacheStatus = useOfflineStore(s => s.setCacheStatus);

  useEffect(() => {
    if (!fieldId) return;

    const init = async () => {
      // 1. Atualiza dados do campo no SQLite
      await cacheFieldData(fieldId, fieldName, farmName);

      // 2. Se Wi-Fi disponível e tiles ainda não baixados, baixa agora
      const netState = await Network.getNetworkStateAsync();
      const cached = await fieldCacheDB.get(fieldId);

      if (netState.isConnected && cached?.tiles_url && !cached.tiles_ready) {
        downloadFieldTiles(fieldId, cached.tiles_url).catch(() => {});
      } else if (cached?.tiles_ready) {
        setCacheStatus(fieldId, 'ready');
      }
    };

    init();
  }, [fieldId]);
}
