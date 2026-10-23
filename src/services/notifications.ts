// src/services/notifications.ts
// Gerenciamento de push notifications (Expo Push + local)
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { authAPI } from './api';

// Configura como as notificações aparecem quando o app está em foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Registro do token de push ──────────────────────────────────────

export async function registerForPushNotifications(): Promise<string | null> {
  // Notificações físicas só funcionam em dispositivo real
  if (!Device.isDevice) {
    console.log('[Push] Simulador detectado — notificações desativadas');
    return null;
  }

  // Solicita permissão
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Push] Permissão negada pelo usuário');
    return null;
  }

  // Canal Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('techa-alertas', {
      name: 'Alertas Techá',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16A34A',
      sound: 'default',
    });
  }

  // Tenta obter Expo Push Token (requer projectId no app.json)
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId || projectId === 'SUBSTITUA_PELO_PROJECT_ID_DO_EAS') {
      console.warn('[Push] projectId não configurado no app.json. Execute eas init para obter.');
      // Fallback: token nativo (FCM direto)
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      const token = deviceToken.data;
      console.log('[Push] Token FCM nativo:', token.slice(0, 20) + '...');
      await _saveTokenToServer(token);
      return token;
    }

    const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = pushToken.data;
    console.log('[Push] Token completo:', token);
    await _saveTokenToServer(token);
    return token;

  } catch (err) {
    console.error('[Push] Erro ao obter token:', err);
    return null;
  }
}

async function _saveTokenToServer(token: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await authAPI.updateFCMToken(token);
      console.log('[Push] Token salvo no servidor');
      return;
    } catch {
      if (i < retries - 1) {
        await new Promise(r => setTimeout(r, 3000)); // aguarda 3s e tenta de novo
      }
    }
  }
  console.warn('[Push] Token não salvo após ' + retries + ' tentativas');
}

// ── Notificações locais ────────────────────────────────────────────

export async function showLocalNotification(
  title: string,
  body: string,
  data?: Record<string, string>
) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data ?? {}, sound: 'default' },
    trigger: null, // imediato
  });
}

export async function showAnomalyAlert(
  fieldName: string,
  ndviDropPct: number,
  anomalyId: string
) {
  await showLocalNotification(
    `⚠ Alerta Techá — ${fieldName}`,
    `Queda de ${ndviDropPct.toFixed(0)}% no vigor vegetativo detectada.`,
    { type: 'anomaly', anomaly_id: anomalyId, field_name: fieldName }
  );
}

// ── Listeners ─────────────────────────────────────────────────────

export type NotificationData = {
  type?: string;
  anomaly_id?: string;
  field_name?: string;
};

/**
 * Configura listeners de notificação.
 * onTap: chamado quando o usuário toca na notificação.
 * Retorna cleanup function.
 */
export function setupNotificationListeners(
  onTap: (data: NotificationData) => void
): () => void {
  // Notificação recebida em foreground
  const receivedSub = Notifications.addNotificationReceivedListener(n => {
    console.log('[Push] Recebida em foreground:', n.request.content.title);
  });

  // Usuário tocou na notificação
  const responseSub = Notifications.addNotificationResponseReceivedListener(r => {
    const data = r.notification.request.content.data as NotificationData;
    onTap(data);
  });

  return () => {
    receivedSub.remove();
    responseSub.remove();
  };
}

export { Notifications };
