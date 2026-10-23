import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { authAPI } from '@/services/api';
import { useAuthStore } from '@/store/auth';
import { useI18nStore } from '@/store/i18n';

const GREEN = '#16A34A';

type Feedback = {
  type: 'success' | 'error';
  message: string;
};

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { required } = useLocalSearchParams<{ required?: string }>();
  const mustChange = required === '1';
  const { user, setUser, logout } = useAuthStore();
  const t = useI18nStore(state => state.t);
  const minimumLength = user?.plan === 'admin' ? 12 : 8;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handleSubmit() {
    setFeedback(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('common.attention'), t('auth.completeFields'));
      setFeedback({ type: 'error', message: t('auth.completeFields') });
      return;
    }
    if (newPassword.length < minimumLength) {
      const message = t('auth.changePasswordMin').replace('{count}', String(minimumLength));
      Alert.alert(
        t('common.attention'),
        message,
      );
      setFeedback({ type: 'error', message });
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert(t('common.attention'), t('auth.passwordMustDiffer'));
      setFeedback({ type: 'error', message: t('auth.passwordMustDiffer') });
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.attention'), t('auth.passwordMismatch'));
      setFeedback({ type: 'error', message: t('auth.passwordMismatch') });
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);

      if (user) {
        setUser({ ...user, must_change_password: false });
      }
      try {
        const refreshedUser = await authAPI.me();
        setUser(refreshedUser);
      } catch {
        // A senha já foi persistida. Uma falha ao atualizar o perfil não pode
        // transformar o salvamento confirmado em uma mensagem de erro.
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'success', message: t('auth.passwordChangedLoggedIn') });

      if (Platform.OS !== 'web') {
        Alert.alert(t('auth.passwordChangedTitle'), t('auth.passwordChangedLoggedIn'), [
          {
            text: t('common.confirm'),
            onPress: () => mustChange ? router.replace('/(tabs)/farms') : router.back(),
          },
        ]);
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const message = error?.offline
        ? t('auth.serverUnavailable')
        : typeof detail === 'string' ? detail : t('common.unknownError');
      setFeedback({ type: 'error', message });
      Alert.alert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRequiredLogout() {
    await logout();
    router.replace('/auth/login');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerBackVisible: !mustChange, gestureEnabled: !mustChange }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.icon}>
          <Ionicons name="key-outline" size={34} color={GREEN} />
        </View>
        <Text style={styles.title}>{t('auth.changePasswordTitle')}</Text>
        <Text style={styles.subtitle}>
          {mustChange ? t('auth.changePasswordRequired') : t('auth.changePasswordHint')}
        </Text>

        {feedback && (
          <View
            style={[
              styles.feedback,
              feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
            ]}
            accessibilityLiveRegion="polite"
          >
            <Ionicons
              name={feedback.type === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              size={22}
              color={feedback.type === 'success' ? '#15803D' : '#B91C1C'}
            />
            <View style={styles.feedbackContent}>
              <Text
                style={[
                  styles.feedbackTitle,
                  feedback.type === 'success' ? styles.feedbackTitleSuccess : styles.feedbackTitleError,
                ]}
              >
                {feedback.type === 'success'
                  ? t('auth.passwordChangedTitle')
                  : t('common.error')}
              </Text>
              <Text style={styles.feedbackMessage}>{feedback.message}</Text>
              {feedback.type === 'success' && Platform.OS === 'web' && (
                <TouchableOpacity
                  style={styles.feedbackAction}
                  onPress={() => mustChange ? router.replace('/(tabs)/farms') : router.back()}
                  accessibilityRole="button"
                >
                  <Text style={styles.feedbackActionText}>
                    {mustChange ? t('common.confirm') : t('common.back')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.label}>{t('auth.currentPassword')}</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry={!showPasswords}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={mustChange ? t('auth.temporaryPassword') : t('auth.currentPassword')}
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>{t('auth.newPassword')}</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showPasswords}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('auth.changePasswordMin').replace('{count}', String(minimumLength))}
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPasswords}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            placeholder={t('auth.confirmPassword')}
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity
            style={styles.showPassword}
            onPress={() => setShowPasswords(value => !value)}
            accessibilityRole="button"
          >
            <Ionicons
              name={showPasswords ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color="#4B5563"
            />
            <Text style={styles.showPasswordText}>
              {showPasswords ? t('auth.hidePasswords') : t('auth.showPasswords')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.disabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.buttonText}>{t('auth.saveNewPassword')}</Text>}
          </TouchableOpacity>
        </View>

        {mustChange && (
          <TouchableOpacity style={styles.logout} onPress={handleRequiredLogout}>
            <Text style={styles.logoutText}>{t('profile.logout')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F8F4' },
  content: { flexGrow: 1, width: '100%', maxWidth: 620, alignSelf: 'center', padding: 24, paddingTop: 40 },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF3DE', alignSelf: 'center' },
  title: { marginTop: 16, fontSize: 24, fontWeight: '700', color: '#1A1A18', textAlign: 'center' },
  subtitle: { marginTop: 8, marginBottom: 24, fontSize: 14, lineHeight: 20, color: '#5F5E5A', textAlign: 'center' },
  feedback: { flexDirection: 'row', gap: 10, marginBottom: 16, padding: 14, borderRadius: 12, borderWidth: 1 },
  feedbackSuccess: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  feedbackError: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  feedbackContent: { flex: 1 },
  feedbackTitle: { marginBottom: 3, fontSize: 14, fontWeight: '700' },
  feedbackTitleSuccess: { color: '#15803D' },
  feedbackTitleError: { color: '#B91C1C' },
  feedbackMessage: { color: '#374151', fontSize: 13, lineHeight: 19 },
  feedbackAction: { alignSelf: 'flex-start', marginTop: 10, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, backgroundColor: GREEN },
  feedbackActionText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  card: { padding: 20, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E0DED8' },
  label: { marginBottom: 6, fontSize: 13, fontWeight: '600', color: '#374151' },
  input: { marginBottom: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F9FAFB', color: '#1A202C', fontSize: 15 },
  showPassword: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', marginBottom: 18 },
  showPasswordText: { color: '#4B5563', fontSize: 13, fontWeight: '500' },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: GREEN },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  logout: { marginTop: 20, alignItems: 'center', padding: 12 },
  logoutText: { color: '#A32D2D', fontSize: 14, fontWeight: '600' },
});
