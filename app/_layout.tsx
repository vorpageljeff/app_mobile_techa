// app/_layout.tsx — Root Layout con monitoramiento de red + sync
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, Component, ReactNode } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNetworkMonitor } from '@/hooks/useNetwork';
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from '@/services/notifications';
import { useTheme } from '@/theme/useTheme';
import { useI18nStore } from '@/store/i18n';

// ── Error Boundary — muestra el error en lugar de cerrar la app ─────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <View style={{ flex: 1, backgroundColor: '#1a4731', padding: 20, paddingTop: 60 }}>
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            ⚠️ Error en la App
          </Text>
          <ScrollView>
            <Text style={{ color: '#FFC', fontSize: 13, fontFamily: 'monospace' }}>
              {err.message}{'\n\n'}{err.stack}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 3 * 60 * 1000 } },
});

function AppCore() {
  useNetworkMonitor();
  const { colors, isDark } = useTheme();
  const t = useI18nStore(s => s.t);

  useEffect(() => {
    registerForPushNotifications();

    const cleanup = setupNotificationListeners((data) => {
      if (data?.type === 'anomaly' && data?.anomaly_id) {
        router.push(`/anomaly/${data.anomaly_id}`);
      }
    });

    return cleanup;
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: '700' },
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerBackTitle: ' ' }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ headerShown: false }} />
        <Stack.Screen name="auth/change-password" options={{ title: t('nav.changePassword'), headerBackTitle: ' ' }} />
        <Stack.Screen name="farm/new" options={{ title: t('nav.newFarm'), presentation: 'modal', headerBackTitle: ' ' }} />
        <Stack.Screen name="farm/[farmId]/fields" options={{ title: t('nav.fields'), headerBackTitle: ' ' }} />
        <Stack.Screen name="farm/[farmId]/new-field" options={{ title: t('nav.newField'), presentation: 'modal', headerBackTitle: ' ' }} />
        <Stack.Screen name="field/[fieldId]/dashboard" options={{ title: t('nav.field'), headerBackTitle: ' ' }} />
        <Stack.Screen name="field/[fieldId]/report" options={{ title: t('nav.report'), headerBackTitle: ' ' }} />
        <Stack.Screen name="field/[fieldId]/anomalies" options={{ title: t('nav.fieldAnomalies'), headerBackTitle: ' ' }} />
        <Stack.Screen name="anomaly/[anomalyId]/index" options={{ title: t('nav.anomaly'), headerBackTitle: ' ' }} />
        <Stack.Screen name="anomaly/[anomalyId]/navigate" options={{ headerShown: false }} />
        <Stack.Screen name="anomaly/[anomalyId]/inspect" options={{ title: t('nav.inspect'), presentation: 'modal', headerBackTitle: ' ' }} />
        <Stack.Screen name="auth/forgot-password" options={{ title: t('nav.forgotPassword') }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppCore />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
