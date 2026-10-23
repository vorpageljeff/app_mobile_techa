// src/screens/field/FieldDashboardScreen.tsx
// Tela principal do talhao: mapa NDVI, anomalias ativas e historico.
import React, { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { NDVIBadge } from '@/components/common/NDVIBadge';
import { OfflineStatusBadge } from '@/components/map/OfflineStatusBadge';
import { NDVIHeatmap } from '@/components/ndvi/NDVIHeatmap';
import { useFieldCache } from '@/hooks/useFieldCache';
import { fieldsAPI } from '@/services/api';
import { useI18nStore } from '@/store/i18n';

function formatImageDate(dateText?: string | null): string {
  if (!dateText) return '-';

  const [year, month, day] = dateText.split('-');
  if (!year || !month || !day) return dateText;

  return `${day}/${month}/${year}`;
}

function formatProcessedAt(dateText?: string | null, locale = 'pt-BR'): string {
  if (!dateText) return '-';

  return new Date(dateText).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FieldDashboardScreen() {
  const { fieldId, fieldName } = useLocalSearchParams<{ fieldId: string; fieldName: string }>();
  const router = useRouter();
  const { language, t } = useI18nStore();
  const [activeTab, setActiveTab] = useState<'mapa' | 'historico'>('mapa');
  useFieldCache(fieldId ?? '', fieldName ?? t('nav.field'), '');

  const { data: analysis } = useQuery({
    queryKey: ['field-latest', fieldId],
    queryFn: () => fieldsAPI.getLatestAnalysis(fieldId!),
    enabled: !!fieldId,
    refetchInterval: 60_000,
  });

  const { data: anomalies = [], isLoading: loadingAnomalies, refetch } = useQuery({
    queryKey: ['field-anomalies', fieldId],
    queryFn: () => fieldsAPI.getAnomalies(fieldId!),
    enabled: !!fieldId,
    refetchInterval: 60_000,
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ['field-analyses', fieldId],
    queryFn: () => fieldsAPI.getAnalyses(fieldId!),
    enabled: !!fieldId && activeTab === 'historico',
    refetchInterval: activeTab === 'historico' ? 60_000 : false,
  });

  const activeAnomalies = anomalies.filter((a) => a.status === 'active');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.fieldName}>{fieldName ?? t('nav.field')}</Text>
          <Text style={styles.lastUpdate}>
            {analysis
              ? `${t('field.lastAnalysis')}: ${formatImageDate(analysis.image_date)}`
              : t('field.waitingAnalysis')}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <NDVIBadge ndvi={analysis?.ndvi_mean ?? null} size="md" />
          <OfflineStatusBadge fieldId={fieldId!} />
        </View>
      </View>

      {activeAnomalies.length > 0 && (
        <TouchableOpacity
          style={styles.alertBanner}
          onPress={() => router.push(`/field/${fieldId}/anomalies`)}
          activeOpacity={0.85}
        >
          <Ionicons name="warning" size={22} color="#991B1B" />
          <View style={styles.alertText}>
            <Text style={styles.alertTitle}>
              {activeAnomalies.length} {activeAnomalies.length > 1 ? t('field.activeAnomalies') : t('field.activeAnomaly')}
            </Text>
            <Text style={styles.alertSub}>{t('field.alertAction')}</Text>
          </View>
          <Text style={styles.alertChevron}>›</Text>
        </TouchableOpacity>
      )}

      <View style={styles.tabs}>
        {(['mapa', 'historico'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'mapa' ? t('field.map') : t('field.history')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentFrame}
        refreshControl={
          <RefreshControl refreshing={loadingAnomalies} onRefresh={refetch} tintColor="#16A34A" />
        }
      >
        {activeTab === 'mapa' ? (
          <>
            <NDVIHeatmap
              fieldId={fieldId!}
              tilesPath={analysis?.tiles_path ?? null}
              anomalies={activeAnomalies}
              onAnomalyPress={(a) => router.push(`/anomaly/${a.id}`)}
            />

            <View style={styles.legend}>
              {[
                { color: '#DC2626', label: t('field.critical') },
                { color: '#F59E0B', label: t('field.alert') },
                { color: '#84CC16', label: t('field.normal') },
                { color: '#16A34A', label: t('field.great') },
              ].map(({ color, label }) => (
                <View key={label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>

            {analysis && (
              <View style={styles.metricsRow}>
                {[
                  { label: t('field.minimum'), value: analysis.ndvi_min },
                  { label: t('field.average'), value: analysis.ndvi_mean },
                  { label: t('field.maximum'), value: analysis.ndvi_max },
                ].map(({ label, value }) => (
                  <View key={label} style={styles.metricCard}>
                    <Text style={styles.metricValue}>
                      {value != null ? value.toFixed(3) : '-'}
                    </Text>
                    <Text style={styles.metricLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.historyList}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyHeaderImage}>{t('field.image')}</Text>
              <Text style={styles.historyHeaderProcessed}>{t('field.processed')}</Text>
              <Text style={styles.historyHeaderNdvi}>NDVI</Text>
              <Text style={styles.historyHeaderStatus}>{t('field.status')}</Text>
            </View>
            {analyses.map((a) => (
              <View key={a.id} style={styles.historyItem}>
                <View style={styles.historyDateGroup}>
                  <Text style={styles.historyDate}>{formatImageDate(a.image_date)}</Text>
                </View>
                <Text style={styles.historyProcessedDate}>
                  {formatProcessedAt(a.processed_at, language === 'es-PY' ? 'es-PY' : 'pt-BR')}
                </Text>
                <NDVIBadge ndvi={a.ndvi_mean} size="sm" />
                <View style={styles.historyStatusWrap}>
                  {a.status === 'valid' ? (
                    <Ionicons name="checkmark" size={16} color="#16A34A" />
                  ) : a.status === 'discarded_cloud' ? (
                    <Ionicons name="cloud-outline" size={16} color="#F59E0B" />
                  ) : (
                    <Ionicons name="time-outline" size={16} color="#6B7280" />
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push(`/field/${fieldId}/report`)}
      >
        <Ionicons name="document-text-outline" size={24} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  fieldName: { fontSize: 18, fontWeight: '700', color: '#1A202C' },
  lastUpdate: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 14, borderBottomWidth: 1, borderBottomColor: '#FECACA', gap: 10 },
  alertText: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#991B1B' },
  alertSub: { fontSize: 12, color: '#EF4444', marginTop: 1 },
  alertChevron: { fontSize: 22, color: '#EF4444' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#16A34A' },
  tabText: { fontSize: 14, fontWeight: '500', color: '#6B7280' },
  tabTextActive: { color: '#16A34A', fontWeight: '700' },
  content: { flex: 1 },
  contentFrame: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: '#6B7280' },
  metricsRow: { flexDirection: 'row', gap: 10, padding: 14 },
  metricCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 12, alignItems: 'center', elevation: 2 },
  metricValue: { fontSize: 18, fontWeight: '700', color: '#1A202C' },
  metricLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  historyList: { padding: 14, gap: 8 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 2 },
  historyHeaderImage: { flex: 1.05, fontSize: 11, fontWeight: '700', color: '#6B7280' },
  historyHeaderProcessed: { flex: 1.05, fontSize: 11, fontWeight: '700', color: '#6B7280' },
  historyHeaderNdvi: { width: 86, fontSize: 11, fontWeight: '700', color: '#6B7280', textAlign: 'center' },
  historyHeaderStatus: { width: 44, fontSize: 11, fontWeight: '700', color: '#6B7280', textAlign: 'right' },
  historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, elevation: 1 },
  historyDateGroup: { flex: 1.05 },
  historyDate: { fontSize: 13, fontWeight: '700', color: '#374151' },
  historyProcessedDate: { flex: 1.05, fontSize: 13, fontWeight: '500', color: '#4B5563' },
  historyStatusWrap: { width: 44, alignItems: 'flex-end' },
  fab: { position: 'absolute', right: 20, bottom: 30, width: 52, height: 52, borderRadius: 26, backgroundColor: '#1a4731', justifyContent: 'center', alignItems: 'center', elevation: 6 },
});
