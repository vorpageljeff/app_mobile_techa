import { Alert, Platform } from 'react-native';

export function showNotice(title: string, message: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { detail?: unknown } }; message?: string })?.response;
  const detail = response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map(item => item?.msg).filter((value): value is string => typeof value === 'string');
    if (messages.length) return messages.join('\n');
  }
  const message = (error as { message?: unknown })?.message;
  return typeof message === 'string' && message ? message : fallback;
}
