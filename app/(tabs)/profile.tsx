// app/(tabs)/profile.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { useTheme } from '@/theme/useTheme';
import { useRouter } from 'expo-router';
import { Language, useI18nStore } from '@/store/i18n';

type ThemeMode = 'light' | 'dark' | 'system';

const THEME_OPTIONS: { mode: ThemeMode; labelKey: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { mode: 'light', labelKey: 'profile.themeLight', icon: 'sunny-outline' },
  { mode: 'dark', labelKey: 'profile.themeDark', icon: 'moon-outline' },
  { mode: 'system', labelKey: 'profile.themeSystem', icon: 'phone-portrait-outline' },
];

const LANGUAGE_OPTIONS: { language: Language; labelKey: 'profile.portuguese' | 'profile.spanish' }[] = [
  { language: 'pt-BR', labelKey: 'profile.portuguese' },
  { language: 'es-PY', labelKey: 'profile.spanish' },
];

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const { setMode } = useThemeStore();
  const { colors, mode } = useTheme();
  const { language, setLanguage, t } = useI18nStore();
  const router = useRouter();
  const planLabels: Record<string, string> = {
    free: 'Plan Free',
    pro: 'Plan Pro',
    enterprise: 'Enterprise',
    admin: 'Admin',
  };

  const handleLogout = () => Alert.alert(t('profile.logoutTitle'), t('profile.logoutMessage'), [
    { text: t('profile.cancel'), style: 'cancel' },
    { text: t('profile.logoutTitle'), style: 'destructive', onPress: async () => { await logout(); router.replace('/auth/login'); } },
  ]);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      nestedScrollEnabled
      showsVerticalScrollIndicator
    >
      {/* User card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryDark }]}>
          <Text style={styles.avatarText}>{user?.name?.[0] ?? '?'}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]}>{user?.name}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        <View style={[styles.planBadge, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="leaf" size={13} color={colors.primary} />
          <Text style={[styles.planText, { color: colors.primary }]}>{planLabels[user?.plan ?? 'free']}</Text>
        </View>
      </View>

      {/* Appearance card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, alignItems: 'stretch' }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('profile.appearance')}</Text>
        {THEME_OPTIONS.map((option, index) => {
          const isActive = mode === option.mode;
          const isLast = index === THEME_OPTIONS.length - 1;
          return (
            <TouchableOpacity
              key={option.mode}
              style={[
                styles.themeOption,
                !isLast && { borderBottomWidth: 1, borderBottomColor: colors.separator },
              ]}
              onPress={() => setMode(option.mode)}
              activeOpacity={0.7}
            >
              <View style={styles.themeOptionLeft}>
                <Ionicons
                  name={option.icon}
                  size={20}
                  color={isActive ? colors.primary : colors.textSecondary}
                  style={styles.themeIcon}
                />
                <Text style={[styles.themeLabel, { color: isActive ? colors.primary : colors.text }]}>
                  {t(option.labelKey)}
                </Text>
              </View>
              {isActive && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder, alignItems: 'stretch' }]}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{t('profile.language')}</Text>
        {LANGUAGE_OPTIONS.map((option, index) => {
          const isActive = language === option.language;
          const isLast = index === LANGUAGE_OPTIONS.length - 1;
          return (
            <TouchableOpacity
              key={option.language}
              style={[
                styles.themeOption,
                !isLast && { borderBottomWidth: 1, borderBottomColor: colors.separator },
              ]}
              onPress={() => setLanguage(option.language)}
              activeOpacity={0.7}
            >
              <View style={styles.themeOptionLeft}>
                <Ionicons
                  name="language-outline"
                  size={20}
                  color={isActive ? colors.primary : colors.textSecondary}
                  style={styles.themeIcon}
                />
                <Text style={[styles.themeLabel, { color: isActive ? colors.primary : colors.text }]}>
                  {t(option.labelKey)}
                </Text>
              </View>
              {isActive && (
                <Ionicons name="checkmark" size={20} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.accountAction, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        onPress={() => router.push('/auth/change-password')}
        accessibilityRole="button"
        accessibilityLabel={t('profile.changePassword')}
      >
        <View style={styles.accountActionLeft}>
          <Ionicons name="key-outline" size={21} color={colors.primary} />
          <Text style={[styles.accountActionText, { color: colors.text }]}>
            {t('profile.changePassword')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Logout button */}
      <TouchableOpacity
        style={[styles.logoutBtn, { backgroundColor: colors.card, borderColor: colors.danger }]}
        onPress={handleLogout}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
          <Text style={[styles.logoutText, { color: colors.danger }]}>{t('profile.logout')}</Text>
        </View>
      </TouchableOpacity>

      <Text style={[styles.version, { color: colors.textMuted }]}>Techá v1.0.0 · InnovAgro Py</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, minHeight: 0, overflow: 'scroll' },
  container: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
    marginBottom: 16,
    borderWidth: 1,
  },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, color: '#FFF', fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '700' },
  email: { fontSize: 14, marginTop: 4 },
  planBadge: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 5 },
  planText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  themeOptionLeft: { flexDirection: 'row', alignItems: 'center' },
  themeIcon: { marginRight: 12 },
  themeLabel: { fontSize: 15, fontWeight: '500' },
  accountAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  accountActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountActionText: { fontSize: 15, fontWeight: '600' },
  logoutBtn: { borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1.5 },
  logoutText: { fontSize: 15, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, marginTop: 20 },
});

