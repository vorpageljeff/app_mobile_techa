// src/theme/useTheme.ts
import { useColorScheme } from 'react-native';
import { useThemeStore } from '@/store/theme';
import { lightColors, darkColors } from './colors';

export function useTheme() {
  const systemScheme = useColorScheme();
  const { mode } = useThemeStore();

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');
  const colors = isDark ? darkColors : lightColors;

  return { colors, isDark, mode };
}
