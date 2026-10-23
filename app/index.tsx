// app/index.tsx — Tela inicial: redireciona baseado em autenticação
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { authAPI, getCachedUser, getToken } from '@/services/api';
import { useAuthStore } from '@/store/auth';

export default function Index() {
  const router = useRouter();
  const { setUser } = useAuthStore();

  useEffect(() => {
    const check = async () => {
      const token = await getToken();
      if (!token) {
        router.replace('/auth/login');
        return;
      }
      try {
        // Timeout de 5s para não travar na tela de loading
        const user = await Promise.race([
          authAPI.me(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 5000)
          ),
        ]);
        setUser(user);
        router.replace(user.must_change_password
          ? '/auth/change-password?required=1'
          : '/(tabs)/farms');
      } catch {
        const cachedUser = await getCachedUser();
        if (cachedUser) {
          setUser(cachedUser);
          router.replace(cachedUser.must_change_password
            ? '/auth/change-password?required=1'
            : '/(tabs)/farms');
          return;
        }
        router.replace('/auth/login');
      }
    };
    check();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#16A34A" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a4731' },
});
