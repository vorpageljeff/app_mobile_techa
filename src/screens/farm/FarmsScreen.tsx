// src/screens/farm/FarmsScreen.tsx — Lista de Estancias
import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { farmsAPI } from '@/services/api';
import { Farm } from '@/types';
import { OfflineIndicator } from '@/components/common/OfflineIndicator';
import { Ionicons } from '@expo/vector-icons';
import { useI18nStore } from '@/store/i18n';

export default function FarmsScreen() {
  const router = useRouter();
  const t = useI18nStore(s => s.t);
  const { width } = useWindowDimensions();
  const fabRight = Math.max(20, (width - 960) / 2 + 20);
  const { data: farms = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['farms'],
    queryFn: farmsAPI.list,
    staleTime: 5 * 60 * 1000,
  });

  const renderFarm = ({ item }: { item: Farm }) => (
    <TouchableOpacity
      style={styles.farmCard}
      onPress={() => router.push(`/farm/${item.id}/fields`)}
      activeOpacity={0.7}
    >
      <View style={styles.farmIcon}>
        <Ionicons name="leaf" size={24} color="#16A34A" />
      </View>
      <View style={styles.farmInfo}>
        <Text style={styles.farmName}>{item.name}</Text>
        <Text style={styles.farmMeta}>
          {item.city ? `${item.city}${item.state ? `, ${item.state}` : ''}` : ''}
          {typeof item.fields_count === 'number'
            ? `${item.city ? '  ·  ' : ''}${item.fields_count} ${item.fields_count !== 1 ? t('farms.fieldPlural') : t('farms.fieldSingular')}`
            : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <OfflineIndicator />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16A34A" />
          <Text style={styles.loadingText}>{t('farms.loading')}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.listFrame}
          data={farms}
          keyExtractor={(f) => f.id}
          renderItem={renderFarm}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#16A34A" />}
          contentContainerStyle={farms.length === 0 ? styles.emptyContainer : styles.list}
          ListHeaderComponent={() => (
            <Text style={styles.sectionHeader}>
              {farms.length > 0 ? `${farms.length} ${farms.length !== 1 ? t('farms.plural') : t('farms.singular')}` : ''}
            </Text>
          )}
          ListEmptyComponent={() => (
            <View style={styles.empty}>
              <Ionicons name="leaf-outline" size={56} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>{t('farms.emptyTitle')}</Text>
              <Text style={styles.emptyDesc}>
                {t('farms.emptyDesc')}
              </Text>
            </View>
          )}
        />
      )}

      {/* FAB — agregar estancia */}
      <TouchableOpacity
        style={[styles.fab, { right: fabRight }]}
        onPress={() => router.push('/farm/new')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  listFrame: { width: '100%', maxWidth: 960, alignSelf: 'center' },
  list: { paddingTop: 4, paddingBottom: 100 },
  emptyContainer: { flex: 1 },
  sectionHeader: { fontSize: 12, color: '#6B7280', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  farmCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFF', marginHorizontal: 16, marginVertical: 5,
    borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  farmIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center' },
  farmInfo: { flex: 1, marginLeft: 12 },
  farmName: { fontSize: 16, fontWeight: '700', color: '#1A202C' },
  farmMeta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#6B7280', fontSize: 14 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A202C', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  fab: {
    position: 'absolute', bottom: 30,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#16A34A', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#16A34A', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
  },
});
