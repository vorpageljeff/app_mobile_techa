// src/screens/auth/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { registerForPushNotifications } from '@/services/notifications';
import { useI18nStore } from '@/store/i18n';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const t = useI18nStore(s => s.t);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('common.attention'), t('auth.emailPasswordRequired'));
      return;
    }

    try {
      const user = await login(email.trim().toLowerCase(), password);
      if (user.must_change_password) {
        router.replace('/auth/change-password?required=1');
        return;
      }
      registerForPushNotifications().catch(() => {});
      router.replace('/(tabs)/farms');
    } catch (err: any) {
      const msg = err?.offline || !err?.response
        ? t('auth.serverUnavailable')
        : err?.response?.data?.detail ?? t('auth.invalidLogin');
      Alert.alert(t('auth.loginError'), msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Ionicons name="leaf" size={56} color="#4ADE80" />
          <Text style={styles.brand}>Techa</Text>
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('auth.login')}</Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            placeholderTextColor="#9CA3AF"
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <View style={styles.passwordWrap}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder={t('auth.password')}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(value => !value)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#6B7280"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, isLoading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.btnText}>{t('auth.login')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={() => router.push('/auth/forgot-password')}
          >
            <Text style={styles.forgotText}>{t('auth.forgot')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => router.push('/auth/register')}
          >
            <Text style={styles.btnSecondaryText}>
              {t('auth.noAccount')} <Text style={styles.link}>{t('auth.signUp')}</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>InnovAgro Py - Hernandarias, Paraguay</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#16A34A';
const DARK_GREEN = '#1a4731';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_GREEN },
  inner: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 32 },
  brand: { fontSize: 36, fontWeight: '800', color: '#FFF', marginTop: 8 },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 6, lineHeight: 18 },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#1A202C', marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A202C',
    marginBottom: 14,
    backgroundColor: '#F9FAFB',
  },
  passwordWrap: { position: 'relative', marginBottom: 14 },
  passwordInput: { marginBottom: 0, paddingRight: 48 },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  btnPrimary: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  btnSecondary: { marginTop: 14, alignItems: 'center' },
  btnSecondaryText: { fontSize: 14, color: '#6B7280' },
  link: { color: GREEN, fontWeight: '600' },
  forgotBtn: { marginTop: 10, alignItems: 'center' },
  forgotText: { fontSize: 13, color: GREEN, fontWeight: '500' },
  footer: { color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center', marginTop: 24 },
});
