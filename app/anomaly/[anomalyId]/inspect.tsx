// app/anomaly/[anomalyId]/inspect.tsx
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { anomaliesAPI } from '@/services/api';
import { pendingInspDB } from '@/services/offline';
import { useOfflineStore } from '@/store/offline';
import { useI18nStore } from '@/store/i18n';

const ISSUE_OPTIONS = [
  'inspect.issuePest',
  'inspect.issueDisease',
  'inspect.issueWaterStress',
  'inspect.issueNutrition',
  'inspect.issueMechanical',
  'inspect.issueOther',
];

export default function InspectScreen() {
  const { anomalyId } = useLocalSearchParams<{ anomalyId: string }>();
  const router = useRouter();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const t = useI18nStore((s) => s.t);

  const [photo, setPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [confirmedIssue, setConfirmedIssue] = useState('');
  const [loading, setLoading] = useState(false);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('inspect.permissionTitle'), t('inspect.permissionMsg'));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });

    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!confirmedIssue) {
      Alert.alert(t('common.attention'), t('inspect.selectIssue'));
      return;
    }

    setLoading(true);

    let coords = { latitude: null as number | null, longitude: null as number | null };
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {}

    const apiPayload = {
      photo_url: null as string | null,
      notes: notes.trim() || null,
      confirmed_issue: t(confirmedIssue),
      location_lat: coords.latitude,
      location_lon: coords.longitude,
    };

    const offlinePayload = {
      anomaly_id: anomalyId!,
      photo_local_uri: photo ?? undefined,
      notes: notes.trim() || undefined,
      confirmed_issue: t(confirmedIssue),
      latitude: coords.latitude ?? undefined,
      longitude: coords.longitude ?? undefined,
    };

    try {
      if (isOnline) {
        await anomaliesAPI.registerInspection(anomalyId!, apiPayload);
        Alert.alert(t('inspect.savedTitle'), t('inspect.savedMsg'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await pendingInspDB.save(offlinePayload);
        Alert.alert(t('inspect.offlineSavedTitle'), t('inspect.offlineSavedMsg'), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch {
      await pendingInspDB.save(offlinePayload);
      Alert.alert(t('inspect.offlineSavedTitle'), t('inspect.offlineSavedMsg'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 24}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>{t('inspect.photo')}</Text>
        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoEmpty}>
              <Ionicons name="camera-outline" size={36} color="#9CA3AF" />
              <Text style={styles.photoHint}>{t('inspect.photoHint')}</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('inspect.whatFound')}</Text>
        <View style={styles.optionsGrid}>
          {ISSUE_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.option, confirmedIssue === opt && styles.optionSelected]}
              onPress={() => setConfirmedIssue(opt)}
            >
              <Text style={[styles.optionText, confirmedIssue === opt && styles.optionTextSelected]}>
                {t(opt)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{t('inspect.notes')}</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('inspect.notesPlaceholder')}
          multiline
          numberOfLines={4}
          placeholderTextColor="#9CA3AF"
        />

        {!isOnline && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineBannerText}>{t('inspect.offline')}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveBtnText}>{t('inspect.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingBottom: 80 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photoBtn: { borderRadius: 12, overflow: 'hidden', marginBottom: 4 },
  photoPreview: { width: '100%', height: 180, borderRadius: 12 },
  photoEmpty: {
    height: 180,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    gap: 8,
  },
  photoHint: { fontSize: 14, color: '#6B7280' },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFF',
  },
  optionSelected: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  optionText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  optionTextSelected: { color: '#16A34A', fontWeight: '700' },
  notesInput: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1A202C',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  offlineBanner: { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginTop: 10 },
  offlineBannerText: { fontSize: 13, color: '#92400E', fontWeight: '500' },
  saveBtn: {
    backgroundColor: '#16A34A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    elevation: 3,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});
