// src/components/common/OfflineIndicator.tsx
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useOfflineStore } from '@/store/offline';

export function OfflineIndicator() {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const pending = useOfflineStore((s) => s.pendingSyncCount);

  if (isOnline && pending === 0) return null;

  return (
    <View style={[styles.bar, isOnline ? styles.syncing : styles.offline]}>
      <Text style={styles.text}>
        {!isOnline
          ? '📡 Modo Offline — dados salvos localmente'
          : `🔄 Sincronizando ${pending} registro(s)...`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  offline: { backgroundColor: '#F59E0B' },
  syncing: { backgroundColor: '#3B82F6' },
  text: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});
