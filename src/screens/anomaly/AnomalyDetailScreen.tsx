// src/screens/anomaly/AnomalyDetailScreen.tsx
// Tela de detalhe de anomalia — mapa + botão "Navegar até o problema"
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { anomaliesAPI } from '@/services/api';
import { NDVIHeatmap } from '@/components/ndvi/NDVIHeatmap';
import { format } from 'date-fns';
import { es, ptBR } from 'date-fns/locale';
import { useI18nStore } from '@/store/i18n';

const TYPE_INFO: Record<string, { emoji: string; labelKey: string; actionKey: string }> = {
  hidrico: { emoji: '!', labelKey: 'anomaly.typeWater', actionKey: 'anomaly.actionWater' },
  praga: { emoji: '!', labelKey: 'anomaly.typePest', actionKey: 'anomaly.actionPest' },
  nutricional: { emoji: '!', labelKey: 'anomaly.typeNutrition', actionKey: 'anomaly.actionNutrition' },
  low_ndvi: { emoji: '!', labelKey: 'anomaly.lowNdvi', actionKey: 'anomaly.actionLowNdvi' },
  unknown: { emoji: '!', labelKey: 'anomaly.typeUnknown', actionKey: 'anomaly.actionUnknown' },
};

function getApiErrorMessage(error: unknown, fallback: string): string {
  const response = (error as any)?.response;
  const detail = response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  if ((error as any)?.message) return (error as any).message;
  return fallback;
}

export default function AnomalyDetailScreen() {
  const { anomalyId } = useLocalSearchParams<{ anomalyId: string }>();
  const router = useRouter();
  const { language, t } = useI18nStore();
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const { data: anomaly, isLoading } = useQuery({
    queryKey: ['anomaly', anomalyId],
    queryFn: () => anomaliesAPI.getById(anomalyId!),
    enabled: !!anomalyId,
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  if (!anomaly) return null;

  const info = TYPE_INFO[anomaly.suspected_type] ?? TYPE_INFO.unknown;
  const isLowNdvi = anomaly.suspected_type === 'low_ndvi';
  const dropColor = isLowNdvi || anomaly.ndvi_drop_pct > 25 ? '#DC2626' : '#F59E0B';
  const locale = language === 'es-PY' ? es : ptBR;
  const detectedDate = format(new Date(anomaly.detected_at), "dd/MM/yyyy HH:mm", { locale });

  const handleNavigate = () => {
    if (!anomaly.centroid) {
      Alert.alert(t('anomaly.locationUnavailable'), t('anomaly.noCoordinates'));
      return;
    }
    // Sprint 4: substitui por navegação GPS offline via MapLibre
    router.push({
      pathname: '/anomaly/[anomalyId]/navigate',
      params: {
        anomalyId: anomaly.id,
        lat: anomaly.centroid.latitude.toString(),
        lon: anomaly.centroid.longitude.toString(),
      },
    });
  };

  const handleConfirm = async () => {
    Alert.alert(t('anomaly.confirmTitle'), t('anomaly.confirmQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), onPress: async () => {
        setConfirming(true);
        try {
          await anomaliesAPI.registerInspection(anomaly.id, { confirmed_issue: 'confirmado' });
          Alert.alert(t('anomaly.confirmed'), t('anomaly.confirmedMsg'));
          router.back();
        } catch (error) {
          Alert.alert(t('common.error'), getApiErrorMessage(error, t('anomaly.confirmError')));
        }
        finally { setConfirming(false); }
      }},
    ]);
  };

  const handleDismiss = async () => {
    Alert.alert(t('anomaly.dismissTitle'), t('anomaly.dismissQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('anomaly.dismissed'), style: 'destructive', onPress: async () => {
        setDismissing(true);
        try {
          await anomaliesAPI.dismiss(anomaly.id);
          Alert.alert(t('anomaly.dismissed'), t('anomaly.dismissedMsg'));
          router.back();
        } catch (error) {
          Alert.alert(t('common.error'), getApiErrorMessage(error, t('anomaly.dismissError')));
        }
        finally { setDismissing(false); }
      }},
    ]);
  };

  const handleInspect = () => {
    router.push({
      pathname: '/anomaly/[anomalyId]/inspect',
      params: { anomalyId: anomaly.id },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Mapa do talhao com overlay NDVI real. Para alerta de NDVI baixo,
          a anomalia pode nao ter centroide proprio, entao usamos o mapa do talhao. */}
      <NDVIHeatmap
        fieldId={anomaly.field_id}
        tilesPath={null}
        anomalies={anomaly.centroid ? [anomaly] : []}
        onAnomalyPress={() => {}}
        height={240}
      />

      {/* Cards de métricas */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricCard, { borderTopColor: dropColor }]}>
          <Text style={[styles.metricBig, { color: dropColor }]}>
            {isLowNdvi ? t('anomaly.lowNdvi') : `▼ ${anomaly.ndvi_drop_pct.toFixed(1)}%`}
          </Text>
          <Text style={styles.metricSub}>{isLowNdvi ? t('anomaly.lowNdviSub') : t('anomaly.ndviDrop')}</Text>
        </View>
        <View style={[styles.metricCard, { borderTopColor: '#16A34A' }]}>
          <Text style={styles.metricBig}>{anomaly.affected_area_ha.toFixed(1)} ha</Text>
          <Text style={styles.metricSub}>{t('anomaly.affectedArea')}</Text>
        </View>
      </View>

      {/* Tipo suspeito */}
      <View style={styles.typeCard}>
        <Text style={styles.typeEmoji}>{info.emoji}</Text>
        <View style={styles.typeText}>
          <Text style={styles.typeLabel}>{t('anomaly.suspect')}: {t(info.labelKey)}</Text>
          <Text style={styles.typeAction}>{t(info.actionKey)}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>{t('anomaly.detailsTitle')}</Text>
        <Text style={styles.infoLine}>{t('anomaly.detectedAt')} {detectedDate}</Text>
        {anomaly.centroid && (
          <Text style={styles.infoLine}>
            📍 {anomaly.centroid.latitude.toFixed(5)}, {anomaly.centroid.longitude.toFixed(5)}
          </Text>
        )}
        <Text style={styles.infoLine}>
          {t('anomaly.source')}
        </Text>
      </View>

      {/* Botões de ação */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.btnInspect}
          onPress={handleInspect}
          activeOpacity={0.85}
        >
          <Text style={styles.btnInspectText}>{t('anomaly.inspect')}</Text>
        </TouchableOpacity>
        {anomaly.status === 'active' && (
          <>
            <TouchableOpacity style={styles.btnConfirm} onPress={handleConfirm} disabled={confirming} activeOpacity={0.85}>
              {confirming ? <ActivityIndicator color='#FFF' /> : <Text style={styles.btnConfirmText}>{t('anomaly.confirmField')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnDismiss} onPress={handleDismiss} disabled={dismissing} activeOpacity={0.85}>
              {dismissing ? <ActivityIndicator color='#DC2626' /> : <Text style={styles.btnDismissText}>{t('anomaly.dismiss')}</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  metricsRow: { flexDirection: 'row', gap: 12, padding: 16 },
  metricCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 14, borderTopWidth: 3, elevation: 2 },
  metricBig: { fontSize: 22, fontWeight: '800', color: '#1A202C' },
  metricSub: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB',
    marginHorizontal: 16, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FDE68A', gap: 12, marginBottom: 12,
  },
  typeEmoji: { fontSize: 28 },
  typeText: { flex: 1 },
  typeLabel: { fontSize: 15, fontWeight: '700', color: '#92400E' },
  typeAction: { fontSize: 13, color: '#78350F', marginTop: 3 },
  infoCard: { backgroundColor: '#FFF', marginHorizontal: 16, borderRadius: 12, padding: 14, elevation: 1, marginBottom: 16 },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoLine: { fontSize: 13, color: '#4B5563', marginBottom: 5 },
  actions: { paddingHorizontal: 16, gap: 10 },
  btnNavigate: {
    backgroundColor: '#1a4731', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', elevation: 4,
    shadowColor: '#1a4731', shadowOpacity: 0.3, shadowRadius: 8,
  },
  btnNavigateText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  btnNavigateSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  btnInspect: { backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: '#16A34A' },
  btnInspectText: { color: '#16A34A', fontSize: 16, fontWeight: '700' },
  btnConfirm: { backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  btnConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  btnDismiss: { backgroundColor: '#FFF', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#DC2626' },
  btnDismissText: { color: '#DC2626', fontSize: 15, fontWeight: '600' },
});
