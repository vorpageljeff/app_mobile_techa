// app/auth/forgot-password.tsx — Recuperação de senha via OTP
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authAPI } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useI18nStore } from '@/store/i18n';

const GREEN = '#16A34A';
const DARK_GREEN = '#1a4731';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const t = useI18nStore(s => s.t);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => {
      setResendIn(value => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const handleSendCode = async () => {
    if (!email.trim()) { Alert.alert(t('common.attention'), t('auth.emailRequired')); return; }
    setLoading(true);
    try {
      await authAPI.requestPasswordReset(email.trim().toLowerCase());
      Alert.alert(t('auth.codeSentTitle'), t('auth.codeSentMsg'));
      setStep('code');
      setResendIn(30);
    } catch (err: any) {
      const msg = err?.offline
        ? t('auth.serverUnavailable')
        : err?.response?.data?.detail ?? t('auth.codeSendError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code.trim()) { Alert.alert(t('common.attention'), t('auth.codeRequired')); return; }
    if (newPassword.length < 8) { Alert.alert(t('common.attention'), t('auth.weakPasswordMsg')); return; }
    if (newPassword !== confirmPassword) { Alert.alert(t('common.attention'), t('auth.passwordMismatch')); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      Alert.alert(t('auth.passwordChangedTitle'), t('auth.passwordChangedMsg'), [
        { text: t('auth.login'), onPress: () => router.replace('/auth/login') },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? t('auth.invalidCode');
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Ionicons name="lock-closed-outline" size={48} color="#4ADE80" />
          <Text style={styles.brand}>{t('auth.forgotTitle')}</Text>
          <Text style={styles.tagline}>
            {step === 'email'
              ? t('auth.forgotEmailStep')
              : t('auth.forgotCodeStep')}
          </Text>
        </View>

        <View style={styles.card}>
          {step === 'email' ? (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="seu@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSendCode}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleSendCode}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>{t('auth.sendCode')}</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.sentTo}>
                {t('auth.codeSentTo').replace('{email}', email.trim().toLowerCase())}
              </Text>
              <Text style={styles.label}>{t('auth.otpCode')}</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={value => setCode(value.replace(/\D/g, ''))}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="next"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.label}>{t('auth.newPassword')}</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                secureTextEntry
                returnKeyType="next"
                placeholderTextColor="#9CA3AF"
              />
              <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>{t('auth.resetPassword')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnSecondary, (loading || resendIn > 0) && styles.btnDisabled]}
                onPress={handleSendCode}
                disabled={loading || resendIn > 0}
              >
                <Text style={styles.btnSecondaryText}>
                  {resendIn > 0
                    ? t('auth.resendIn').replace('{seconds}', String(resendIn))
                    : t('auth.resendCode')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.changeEmail}
                onPress={() => {
                  setStep('email');
                  setCode('');
                }}
              >
                <Text style={styles.changeEmailText}>{t('auth.changeEmail')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <TouchableOpacity style={styles.backToLogin} onPress={() => router.back()}>
          <Text style={styles.backToLoginText}>{t('auth.backToLogin')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_GREEN },
  inner: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  brand: { fontSize: 28, fontWeight: '800', color: '#FFF', marginTop: 8 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1A202C', marginBottom: 14, backgroundColor: '#F9FAFB' },
  btnPrimary: { backgroundColor: GREEN, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  btnSecondary: { marginTop: 14, alignItems: 'center' },
  btnSecondaryText: { fontSize: 14, color: GREEN, fontWeight: '600' },
  sentTo: { marginBottom: 18, color: '#4B5563', fontSize: 13, lineHeight: 18, textAlign: 'center' },
  changeEmail: { marginTop: 14, alignItems: 'center' },
  changeEmailText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  backToLogin: { marginTop: 24, alignItems: 'center' },
  backToLoginText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
});
