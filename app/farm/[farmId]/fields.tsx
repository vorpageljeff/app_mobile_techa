// app/farm/[farmId]/fields.tsx
// Lista de parcelas de una estancia
import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { fieldsAPI, farmsAPI } from '@/services/api';
import { Field } from '@/types';
import { getNDVIColor, getNDVILabel } from '@/types';
import { OfflineIndicator } from '@/components/common/OfflineIndicator';
import { Ionicons } from '@expo/vector-icons';
import { useI18nStore } from '@/store/i18n';

export default function FarmFieldsScreen() {
  const router = useRouter();
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const t = useI18nStore(s => s.t);
  const { width } = useWindowDimensions();
  const fabRight = Math.max(20, (width - 960) / 2 + 20);

  const { data: farms = [] } = useQuery({
    queryKey: ['farms'],
    queryFn: farmsAPI.list,
    staleTime: 5 * 60 * 1000,
  });

  const { data: fields = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['fields', farmId],
    queryFn: () => fieldsAPI.list(farmId),
    enabled: !!farmId,
    staleTime: 3 * 60 * 1000,
  });

  const farm = farms.find(f => f.id === farmId);

  const renderField = ({ item }: { item: Field }) => {
    return (
      <TouchableOpacity
        style={styles.fieldCard}
        onPress={() => router.push(`/field/${item.id}/dashboard?fieldName=${encodeURIComponent(item.name)}`)}
        activeOpacity={0.7}
      >
        <View style={styles.fieldIcon}>
          <Ionicons name="leaf" size={22} color="#16A34A" />
        </View>
        <View style={styles.fieldInfo}>
          <Text style={styles.fieldName}>{item.name}</Text>
          <Text style={styles.fieldMeta}>
            {item.crop ?? t('field.crop')}
            {item.area_ha != null ? `  ·  ${item.area_ha.toFixed(1)} ha` : ''}
          </Text>
          {item.planting_date && (
            <Text style={styles.fieldDate}>{t('field.plantingDate')}: {item.planting_date}</Text>
          )}
        </View>
        <View style={styles.fieldRight}>
          <View style={styles.ndviDot} />
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <OfflineIndicator />

      {farm && (
        <View style={styles.farmHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="home" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.farmHeaderText}>{farm.name}</Text>
          </View>
          {farm.city && <Text style={styles.farmHeaderSub}>{farm.city}</Text>}
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.loadingText}>{t('farms.loading')}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listFrame}
          data={fields}
          keyExtractor={(f) => f.id}
          renderItem={renderField}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#16A34A" />
          }
          contentContainerStyle={fields.length === 0 ? styles.emptyContainer : styles.list}
          ListHeaderComponent={() => (
            <Text style={styles.sectionHeader}>
              {fields.length > 0 ? `${fields.length} ${fields.length !== 1 ? t('farms.fieldPlural') : t('farms.fieldSingular')}` : ''}
            </Text>
          )}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Ionicons name="layers-outline" size={56} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>{t('farms.fieldPlural')}</Text>
              <Text style={styles.emptyDesc}>
                {t('field.registeredMsg')}
              </Text>
            </View>
          )}
        />
      )}

      {/* FAB — agregar parcela */}
      <TouchableOpacity
        style={[styles.fab, { right: fabRight }]}
        onPress={() => router.push(`/farm/${farmId}/new-field`)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const G = '#16A34A';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  listFrame: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  farmHeader: {
    backgroundColor: '#1a4731', paddingHorizontal: 16, paddingVertical: 12,
  },
  farmHeaderText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  farmHeaderSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  list: { paddingTop: 4, paddingBottom: 100 },
  emptyContainer: { flex: 1 },
  sectionHeader: {
    fontSize: 12, color: '#6B7280',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  fieldCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 16, marginVertical: 5,
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  fieldIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
  },
  fieldInfo: { flex: 1, marginLeft: 12 },
  fieldName: { fontSize: 16, fontWeight: '700', color: '#1A202C' },
  fieldMeta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  fieldDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  fieldRight: { alignItems: 'center', gap: 4 },
  ndviDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: G },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#6B7280', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A202C', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute', bottom: 30,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: G, justifyContent: 'center', alignItems: 'center',
    shadowColor: G, shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
});
