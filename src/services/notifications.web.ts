export type NotificationData = {
  type?: string;
  anomaly_id?: string;
  field_name?: string;
};

export async function registerForPushNotifications(): Promise<null> {
  return null;
}

export async function showLocalNotification(
  _title: string,
  _body: string,
  _data?: Record<string, string>
): Promise<void> {
  // Push e notificações locais ficam restritos aos aplicativos nativos.
}

export async function showAnomalyAlert(
  _fieldName: string,
  _ndviDropPct: number,
  _anomalyId: string
): Promise<void> {}

export function setupNotificationListeners(
  _onTap: (data: NotificationData) => void
): () => void {
  return () => {};
}

export const Notifications = {};
