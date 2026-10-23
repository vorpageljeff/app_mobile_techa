// src/screens/auth/RegisterScreen.tsx
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/store/auth';
import { useI18nStore } from '@/store/i18n';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const t = useI18nStore(s => s.t);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('common.attention'), t('auth.completeFields'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('auth.weakPassword'), t('auth.weakPasswordMsg'));
      return;
    }
    try {
      await register(name.trim(), email.trim().toLowerCase(), password);
      router.replace('/(tabs)/farms');
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Erro ao criar a conta';
      Alert.alert(t('common.error'), msg);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.logoArea}>
          <Ionicons name="leaf" size={44} color="#4ADE80" />
          <Text style={styles.brand}>Techa</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('auth.createAccount')}</Text>

          {[
            { label: t('auth.fullName'), value: name, setter: setName, placeholder: 'Joao Silva', keyboard: 'default' as const },
            { label: 'Email', value: email, setter: setEmail, placeholder: 'seu@email.com', keyboard: 'email-address' as const },
            { label: t('auth.passwordMin'), value: password, setter: setPassword, placeholder: '********', keyboard: 'default' as const, secure: true },
          ].map((field) => (
            <View key={field.label}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput
                style={styles.input}
                value={field.value}
                onChangeText={field.setter}
                placeholder={field.placeholder}
                keyboardType={field.keyboard}
                autoCapitalize={field.keyboard === 'email-address' ? 'none' : 'words'}
                secureTextEntry={field.secure}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.btnPrimary, isLoading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.btnText}>{t('auth.createFree')}</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnSecondary} onPress={() => router.back()}>
            <Text style={styles.btnSecondaryText}>
              {t('auth.hasAccount')} <Text style={styles.link}>{t('auth.login')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const GREEN = '#16A34A';
const DARK_GREEN = '#1a4731';
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_GREEN },
  inner: { flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24 },
  logoArea: { alignItems: 'center', marginBottom: 24, gap: 6 },
  brand: { fontSize: 30, fontWeight: '800', color: '#FFF', marginTop: 6 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, elevation: 8 },
  cardTitle: { fontSize: 22, fontWeight: '700', color: '#1A202C', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1A202C',
    marginBottom: 12, backgroundColor: '#F9FAFB',
  },
  btnPrimary: { backgroundColor: GREEN, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  btnSecondary: { marginTop: 14, alignItems: 'center' },
  btnSecondaryText: { fontSize: 14, color: '#6B7280' },
  link: { color: GREEN, fontWeight: '600' },
});
