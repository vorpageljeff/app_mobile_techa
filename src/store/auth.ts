// src/store/auth.ts â€” Zustand store para autenticaÃ§Ã£o
import { create } from '@/store/zustand';
import { User } from '@/types';
import {
  authAPI,
  getCachedUser,
  getToken,
  removeCachedUser,
  removeToken,
  saveCachedUser,
} from '@/services/api';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      await authAPI.login(email, password);
      const user = await authAPI.me();
      console.log('[AUTH] user retornado:', JSON.stringify(user));
      await saveCachedUser(user);
      set({ user, isAuthenticated: true });
      return user;
    } catch (err: any) {
      if (err?.offline || !err?.response) {
        const [cachedUser, token] = await Promise.all([getCachedUser(), getToken()]);
        if (cachedUser?.email?.toLowerCase() === email.toLowerCase() && token) {
          set({ user: cachedUser, isAuthenticated: true });
          return cachedUser;
        }
      }
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (name, email, password) => {
    set({ isLoading: true });
    try {
      await authAPI.register(name, email, password);
      const user = await authAPI.me();
      await saveCachedUser(user);
      set({ user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await removeToken();
    await removeCachedUser();
    set({ user: null, isAuthenticated: false });
  },

  setUser: (user) => {
    saveCachedUser(user).catch(() => {});
    set({ user, isAuthenticated: true });
  },
}));


