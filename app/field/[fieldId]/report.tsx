// app/field/[fieldId]/report.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from '@/services/secureStorage';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';

import { API_URL, reportsAPI } from '@/services/api';
import { fieldCacheDB } from '@/services/database';
import { useOfflineStore } from '@/store/offline';
import { useI18nStore } from '@/store/i18n';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let output = '';
  let i = 0;

  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    output +=
      BASE64_CHARS[(n >>> 18) & 63] +
      BASE64_CHARS[(n >>> 12) & 63] +
      BASE64_CHARS[(n >>> 6) & 63] +
      BASE64_CHARS[n & 63];
  }

  if (i < bytes.length) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const n = (a << 16) | (b << 8);
    output += BASE64_CHARS[(n >>> 18) & 63] + BASE64_CHARS[(n >>> 12) & 63];
    output += i + 1 < bytes.length ? BASE64_CHARS[(n >>> 6) & 63] : '=';
    output += '=';
  }

  return output;
}

export default function ReportScreen() {
  const { fieldId } = useLocalSearchParams<{ fieldId: string }>();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const { language, t } = useI18nStore();

  const [fieldName, setFieldName] = useState('Talhao');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingWpp, setLoadingWpp] = useState(false);
  const [phone, setPhone] = useState('');
  const [localPdfUri, setLocalPdfUri] = useState<string | null>(null);
  const [localPdfBase64, setLocalPdfBase64] = useState<string | null>(null);

  useEffect(() => {
    fieldCacheDB.get(fieldId).then((row) => {
      if (row?.field_name) setFieldName(row.field_name);
    });
  }, [fieldId]);

  async function handleDownloadPDF() {
    if (!isOnline) {
      Alert.alert(t('common.error'), t('report.noConnection'));
      return;
    }

    setLoadingPdf(true);
    setLocalPdfUri(null);
    setLocalPdfBase64(null);

    try {
      const token = await SecureStore.getItemAsync('techa_auth_token');
      const response = await fetch(`${API_URL}/fields/${fieldId}/report`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
          Accept: 'application/pdf',
        },
        body: JSON.stringify({ language }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}${detail ? ': ' + detail : ''}`);
      }

      const buffer = await response.arrayBuffer();

      if (Platform.OS === 'web') {
        const blobUrl = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
        setLocalPdfUri((previous) => {
          if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
          return blobUrl;
        });
        Alert.alert(t('report.readyTitle'), t('report.readyMsg'));
        return;
      }

      const base64 = bytesToBase64(new Uint8Array(buffer));
      const localUri = `${FileSystem.documentDirectory}relatorio_${fieldId}_${Date.now()}.pdf`;

      await FileSystem.writeAsStringAsync(localUri, base64, {
        encoding: 'base64' as any,
      });

      setLocalPdfUri(localUri);
      setLocalPdfBase64(base64);
      Alert.alert(t('report.readyTitle'), t('report.readyMsg'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('common.unknownError'));
    } finally {
      setLoadingPdf(false);
    }
  }

  async function handleOpenPDF() {
    if (!localPdfUri) return;

    try {
      if (Platform.OS === 'web') {
        window.open(localPdfUri, '_blank', 'noopener,noreferrer');
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localPdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: t('report.openShare'),
          UTI: 'com.adobe.pdf',
        });
        return;
      }

      const contentUri = Platform.OS === 'android'
        ? await FileSystem.getContentUriAsync(localPdfUri)
        : localPdfUri;
      await Linking.openURL(contentUri);
    } catch {
      Alert.alert(t('report.openShare'), `Arquivo salvo em:\n${localPdfUri}`);
    }
  }

  async function handleSavePDFToDevice() {
    if (!localPdfUri) return;

    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        const safeName = fieldName.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'relatorio';
        link.href = localPdfUri;
        link.download = `${safeName}_${Date.now()}.pdf`;
        link.click();
        return;
      }

      if (!localPdfBase64) return;
      const storageAccess = (FileSystem as any).StorageAccessFramework;

      if (Platform.OS !== 'android' || !storageAccess) {
        await handleOpenPDF();
        return;
      }

      const permissions = await storageAccess.requestDirectoryPermissionsAsync();
      if (!permissions.granted) return;

      const safeName = fieldName.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'relatorio';
      const fileUri = await storageAccess.createFileAsync(
        permissions.directoryUri,
        `${safeName}_${Date.now()}.pdf`,
        'application/pdf'
      );

      await FileSystem.writeAsStringAsync(fileUri, localPdfBase64, {
        encoding: 'base64' as any,
      });

      Alert.alert(t('report.savedDeviceTitle'), t('report.savedDeviceMsg'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('common.unknownError'));
    }
  }

  async function handleSendWhatsApp() {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      Alert.alert(t('common.error'), t('report.phoneInvalid'));
      return;
    }
    if (!isOnline) {
      Alert.alert(t('common.error'), t('report.noConnection'));
      return;
    }

    setLoadingWpp(true);
    try {
      await reportsAPI.sendWhatsApp(fieldId, cleaned);
      Alert.alert('OK', `${t('report.title')} +${cleaned}`);
      setPhone('');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.detail ?? t('report.sendError'));
    } finally {
      setLoadingWpp(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.heroCard}>
        <Ionicons name="bar-chart-outline" size={40} color="#FFF" />
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>{t('report.title')}</Text>
          <Text style={styles.heroSub}>{fieldName}</Text>
        </View>
      </View>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {t('report.noConnection')}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('report.includes')}</Text>
        {[
          t('report.itemMap'),
          t('report.itemHistory'),
          t('report.itemAnomalies'),
          t('report.itemInspections'),
          t('report.itemRecommendations'),
        ].map((item) => (
          <Text key={item} style={styles.bulletItem}>{item}</Text>
        ))}
      </View>

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>{t('report.pdf')}</Text>
      <TouchableOpacity
        style={[styles.btnPrimary, (!isOnline || loadingPdf) && styles.btnDisabled]}
        onPress={handleDownloadPDF}
        disabled={!isOnline || loadingPdf}
      >
        {loadingPdf
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.btnText}>{t('report.generate')}</Text>}
      </TouchableOpacity>

      {localPdfUri && (
        <>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleSavePDFToDevice}>
            <Text style={styles.btnSecondaryText}>{t('report.saveDevice')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleOpenPDF}>
            <Text style={styles.btnSecondaryText}>{t('report.openShare')}</Text>
          </TouchableOpacity>
        </>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>{t('report.whatsapp')}</Text>
      <Text style={styles.inputLabel}>{t('report.phone')}</Text>
      <TextInput
        style={styles.phoneInput}
        value={phone}
        onChangeText={setPhone}
        placeholder="Ex: 59599999999"
        placeholderTextColor="#9CA3AF"
        keyboardType="phone-pad"
        maxLength={15}
      />
      <Text style={styles.inputHint}>{t('report.phoneHint')} (595 Paraguay)</Text>

      <TouchableOpacity
        style={[styles.btnWhatsApp, (!isOnline || loadingWpp) && styles.btnDisabled]}
        onPress={handleSendWhatsApp}
        disabled={!isOnline || loadingWpp}
      >
        {loadingWpp
          ? <ActivityIndicator color="#FFF" />
          : <Text style={styles.btnText}>{t('report.send')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const G = '#16A34A';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 16, paddingBottom: 48 },
  heroCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1a4731', borderRadius: 16, padding: 18, marginBottom: 16,
  },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  offlineBanner: {
    backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: '#F59E0B',
  },
  offlineBannerText: { fontSize: 13, color: '#92400E', fontWeight: '600', textAlign: 'center' },
  section: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A202C', marginBottom: 10 },
  bulletItem: { fontSize: 13, color: '#374151', marginBottom: 6, lineHeight: 20 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  phoneInput: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 16,
    color: '#1A202C', backgroundColor: '#FFF', marginBottom: 4,
    letterSpacing: 1,
  },
  inputHint: { fontSize: 11, color: '#9CA3AF', marginBottom: 14 },
  btnPrimary: {
    backgroundColor: '#1a4731', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginBottom: 10,
  },
  btnSecondary: {
    backgroundColor: '#FFF', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginBottom: 10,
    borderWidth: 1.5, borderColor: G,
  },
  btnSecondaryText: { color: G, fontSize: 15, fontWeight: '700' },
  btnWhatsApp: {
    backgroundColor: '#25D366', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center', marginBottom: 10,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
