import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function hasGoogleMapsAndroidKey(): boolean {
  if (Platform.OS === 'web') return false;
  if (Platform.OS !== 'android') return true;
  if (Constants.appOwnership === 'expo') return true;

  const extra = Constants.expoConfig?.extra as
    | { hasGoogleMapsAndroidKey?: boolean }
    | undefined;

  const androidConfig = Constants.expoConfig?.android as
    | { config?: { googleMaps?: { apiKey?: string } } }
    | undefined;

  return Boolean(extra?.hasGoogleMapsAndroidKey || androidConfig?.config?.googleMaps?.apiKey);
}
