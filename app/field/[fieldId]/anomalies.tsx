// app/field/[fieldId]/anomalies.tsx
// Lista de anomalias de um talhão específico
import React from 'react';
import {
  View, FlatList, Text, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fieldsAPI } from '@/services/api';
import { AnomalyCard } from '@/components/common/AnomalyCard';
import { useI18nStore } from '@/store/i18n';

export default function FieldAnomaliesScreen() {
  const { fieldId } = useLocalSearchParams<{ fieldId: string }>();
  const router = useRouter();
  const t = useI18nStore(s => s.t);

  const { data: anomalies = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['field-anomalies', fieldId],
    queryFn: () => fieldsAPI.getAnomalies(fieldId),
    enabled: !!fieldId,
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        style={styles.listFrame}
        data={anomalies}
        keyExtractor={a => a.id}
        renderItem={({ item }) => (
          <AnomalyCard
            anomaly={item}
            onPress={() => router.push(`/anomaly/${item.id}`)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#16A34A" />
        }
        contentContainerStyle={anomalies.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>{t('field.noAnomaly')}</Text>
            <Text style={styles.emptySub}>{t('field.noActiveAnomaly')}</Text>
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
  emptyContainer: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 60, gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A202C' },
  emptySub: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
});
