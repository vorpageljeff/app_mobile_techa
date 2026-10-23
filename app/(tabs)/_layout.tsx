// app/(tabs)/_layout.tsx — Bottom Tab Navigator
import { Tabs } from 'expo-router';
import { useOfflineStore } from '@/store/offline';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/useTheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18nStore } from '@/store/i18n';
import { Platform, useWindowDimensions } from 'react-native';

export default function TabLayout() {
  const pendingCount = useOfflineStore(s => s.pendingSyncCount);
  const { colors } = useTheme();
  const t = useI18nStore(s => s.t);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 900;
  const bottomInset = Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarPosition: isDesktopWeb ? 'left' : 'bottom',
        tabBarVariant: isDesktopWeb ? 'material' : 'uikit',
        tabBarLabelPosition: isDesktopWeb ? 'beside-icon' : 'below-icon',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: isDesktopWeb ? 'transparent' : colors.separator,
          borderRightColor: isDesktopWeb ? colors.separator : 'transparent',
          borderRightWidth: isDesktopWeb ? 1 : 0,
          width: isDesktopWeb ? 220 : undefined,
          height: isDesktopWeb ? '100%' : 58 + bottomInset,
          paddingTop: isDesktopWeb ? 20 : 6,
          paddingBottom: isDesktopWeb ? 20 : bottomInset,
        },
        tabBarItemStyle: isDesktopWeb
          ? { minHeight: 52, marginHorizontal: 10, borderRadius: 10 }
          : undefined,
        tabBarLabelStyle: {
          fontSize: isDesktopWeb ? 14 : 11,
          fontWeight: '600',
          marginLeft: isDesktopWeb ? 8 : 0,
        },
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="farms"
        options={{
          title: t('tabs.farms'),
          tabBarLabel: t('tabs.farms'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: t('tabs.alerts'),
          tabBarLabel: t('tabs.alerts'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'warning' : 'warning-outline'} size={22} color={color} />
          ),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#F59E0B', fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
