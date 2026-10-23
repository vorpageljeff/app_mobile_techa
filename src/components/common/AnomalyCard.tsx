// src/components/common/AnomalyCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { es, ptBR } from 'date-fns/locale';
import { Ionicons } from '@expo/vector-icons';

import { Anomaly } from '@/types';
import { useI18nStore } from '@/store/i18n';

const SUSPECTED_LABEL_KEYS: Record<string, string> = {
  hidrico: 'anomaly.typeWater',
  praga: 'anomaly.typePest',
  nutricional: 'anomaly.typeNutrition',
  low_ndvi: 'anomaly.lowNdvi',
  unknown: 'anomaly.typeUnknown',
};

interface Props {
  anomaly: Anomaly;
  fieldName?: string;
  onPress: () => void;
}

export function AnomalyCard({ anomaly, fieldName, onPress }: Props) {
  const { language, t } = useI18nStore();
  const isLowNdvi = anomaly.suspected_type === 'low_ndvi';
  const dropColor = isLowNdvi || anomaly.ndvi_drop_pct > 25 ? '#DC2626' : '#F59E0B';
  const timeAgo = formatDistanceToNow(new Date(anomaly.detected_at), {
    addSuffix: true,
    locale: language === 'es-PY' ? es : ptBR,
  });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.severity, { backgroundColor: dropColor }]} />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.fieldName}>{fieldName ?? t('nav.field')}</Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="trending-down" size={14} color={dropColor} />
              <Text style={[styles.metricValue, { color: dropColor }]}>
                {isLowNdvi ? t('anomaly.lowNdvi') : `${anomaly.ndvi_drop_pct.toFixed(0)}%`}
              </Text>
            </View>
            <Text style={styles.metricLabel}>{isLowNdvi ? t('anomaly.lowNdviSub') : t('anomaly.ndviDrop')}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {anomaly.affected_area_ha.toFixed(1)} ha
            </Text>
            <Text style={styles.metricLabel}>{t('anomaly.affectedArea')}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {t(SUSPECTED_LABEL_KEYS[anomaly.suspected_type] ?? 'anomaly.typeUnknown')}
            </Text>
            <Text style={styles.metricLabel}>{t('anomaly.suspect')}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <View style={[styles.statusBadge, anomaly.status === 'active' && styles.statusActive]}>
            <Text style={styles.statusText}>
              {anomaly.status === 'active'
                ? t('anomaly.active')
                : anomaly.status === 'inspected'
                  ? t('anomaly.inspected')
                  : t('anomaly.resolved')}
            </Text>
          </View>
          <Text style={styles.navigate}>{t('anomaly.navigate')}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  severity: { width: 5 },
  content: { flex: 1, padding: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  fieldName: { fontSize: 15, fontWeight: '700', color: '#1A202C' },
  time: { fontSize: 12, color: '#9CA3AF' },
  metrics: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  metric: { flex: 1 },
  metricValue: { fontSize: 14, fontWeight: '700', color: '#1A202C' },
  metricLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: '#F3F4F6' },
  statusActive: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  navigate: { fontSize: 13, fontWeight: '600', color: '#16A34A' },
});
