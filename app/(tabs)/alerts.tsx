// app/(tabs)/alerts.tsx — Lista de todas las anomalías activas
import React from 'react';
import { View, FlatList, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { anomaliesAPI } from '@/services/api';
import { AnomalyCard } from '@/components/common/AnomalyCard';
import { Ionicons } from '@expo/vector-icons';
import { useI18nStore } from '@/store/i18n';

export default function AlertsScreen() {
  const router = useRouter();
  const t = useI18nStore(s => s.t);
  const { data: anomalies = [], isLoading } = useQuery({
    queryKey: ['all-anomalies'],
    queryFn: anomaliesAPI.listActive,
    refetchInterval: 60_000,
  });

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#16A34A" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.listFrame}
        data={anomalies}
        keyExtractor={a => a.id}
        renderItem={({ item }) => (
          <AnomalyCard
            anomaly={item}
            fieldName={item.field_name ?? undefined}
            onPress={() => router.push(`/anomaly/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={56} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>{t('alerts.emptyTitle')}</Text>
            <Text style={styles.emptySub}>{t('alerts.emptySub')}</Text>
          </View>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  listFrame: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  list: { paddingVertical: 8, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 60, gap: 10 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A202C' },
  emptySub: { fontSize: 14, color: '#6B7280' },
});
