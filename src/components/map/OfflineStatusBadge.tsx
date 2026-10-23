import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOfflineStore } from '@/store/offline';

interface Props {
  fieldId: string;
}

export function OfflineStatusBadge({ fieldId }: Props) {
  const status = useOfflineStore(s => s.fieldCacheStatus[fieldId]);

  if (!status || status === 'pending') return null;

  if (status === 'downloading') {
    return (
      <View style={[styles.badge, styles.downloading]}>
        <Text style={styles.text}>Salvando offline...</Text>
      </View>
    );
  }

  if (status === 'ready') {
    return (
      <View style={[styles.badge, styles.ready]}>
        <Text style={styles.text}>Offline salvo</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={[styles.badge, styles.error]}>
        <Text style={styles.text}>Cache offline falhou</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  text: { fontSize: 11, fontWeight: '600', color: '#FFF' },
  downloading: { backgroundColor: '#3B82F6' },
  ready: { backgroundColor: '#16A34A' },
  error: { backgroundColor: '#DC2626' },
});
