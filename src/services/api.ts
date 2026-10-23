// src/services/api.ts
// Cliente HTTP centralizado — todas as chamadas ao back-end Techá

import axios, { AxiosInstance, AxiosError } from 'axios';
import { Platform } from 'react-native';
import * as SecureStore from '@/services/secureStorage';
import { User, Farm, Field, SatelliteAnalysis, Anomaly, FieldInspection } from '@/types';

export const DEFAULT_API_URL = 'https://techa-api.2.25.189.129.nip.io/api/v1';
const PLATFORM_API_URL = Platform.OS === 'web' ? '/api/v1' : DEFAULT_API_URL;
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? PLATFORM_API_URL;
const TOKEN_KEY = 'techa_auth_token';
const CACHED_USER_KEY = 'techa_cached_user';

// ── Instância Axios ───────────────────────────────────────────────
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

function normalizeField(field: Field): Field {
  return {
    ...field,
    geometry_geojson: field.geometry_geojson ?? field.geometry ?? null,
  };
}

// Interceptor: injeta token JWT em toda requisição
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: trata erros de rede graciosamente
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (!error.response) {
      // Sem rede — app continua funcionando em modo offline
      return Promise.reject({ offline: true, message: 'Sem conexão com a internet' });
    }
    return Promise.reject(error);
  }
);

// ── Funções de Token ──────────────────────────────────────────────
export const saveToken = (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token);
export const removeToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);

export const saveCachedUser = (user: User) =>
  SecureStore.setItemAsync(CACHED_USER_KEY, JSON.stringify(user));

export async function getCachedUser(): Promise<User | null> {
  const raw = await SecureStore.getItemAsync(CACHED_USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as User;
  } catch {
    await SecureStore.deleteItemAsync(CACHED_USER_KEY);
    return null;
  }
}

export const removeCachedUser = () => SecureStore.deleteItemAsync(CACHED_USER_KEY);

export async function checkApiHealth(timeoutMs = 8_000): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const healthUrl = API_URL.startsWith('/')
      ? '/backend-ready'
      : `${API_URL.replace(/\/api\/v1\/?$/, '')}/ready`;
    const res = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Auth ──────────────────────────────────────────────────────────
export const authAPI = {
  register: async (name: string, email: string, password: string) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    await saveToken(data.access_token);
    return data as { access_token: string; user: User };
  },

  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    await saveToken(data.access_token);
    return data as { access_token: string; user: User };
  },

  me: async (): Promise<User> => {
    const { data } = await api.get('/auth/me');
    return data;
  },

  logout: async () => {
    await removeToken();
  },

  updateFCMToken: async (fcm_token: string) => {
    await api.patch('/auth/fcm-token', { fcm_token });
  },

  changePassword: async (current_password: string, new_password: string) => {
    await api.patch('/auth/change-password', { current_password, new_password });
  },

  requestPasswordReset: async (email: string) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  },

  resetPassword: async (email: string, code: string, new_password: string) => {
    const { data } = await api.post('/auth/reset-password', { email, code, new_password });
    return data;
  },
};

// ── Fazendas ──────────────────────────────────────────────────────
export const farmsAPI = {
  list: async (): Promise<Farm[]> => {
    const { data } = await api.get('/farms');
    return data;
  },

  create: async (name: string, city?: string, state?: string): Promise<Farm> => {
    const { data } = await api.post('/farms', { name, city, state });
    return data;
  },
};

// ── Talhões ───────────────────────────────────────────────────────
export const fieldsAPI = {
  list: async (farmId: string): Promise<Field[]> => {
    const { data } = await api.get(`/farms/${farmId}/fields`);
    return data.map(normalizeField);
  },

  get: async (fieldId: string): Promise<Field> => {
    const { data } = await api.get(`/fields/${fieldId}`);
    return normalizeField(data);
  },

  create: async (farmId: string, payload: {
    name: string;
    crop?: string;
    planting_date?: string;
    geometry_geojson: object;
  }): Promise<Field> => {
    const { geometry_geojson, ...rest } = payload;
    const { data } = await api.post(`/farms/${farmId}/fields`, { ...rest, geometry: geometry_geojson });
    return data;
  },

  getAnalyses: async (fieldId: string): Promise<SatelliteAnalysis[]> => {
    const { data } = await api.get(`/fields/${fieldId}/analyses`);
    return data;
  },

  getLatestAnalysis: async (fieldId: string): Promise<SatelliteAnalysis | null> => {
    try {
      const { data } = await api.get(`/fields/${fieldId}/analyses/latest`);
      return data;
    } catch {
      return null;
    }
  },

  getAnomalies: async (fieldId: string): Promise<Anomaly[]> => {
    const { data } = await api.get(`/fields/${fieldId}/anomalies`);
    return data;
  },
};

// ── Anomalias ─────────────────────────────────────────────────────
export const anomaliesAPI = {
  listActive: async (): Promise<Anomaly[]> => {
    const { data } = await api.get('/anomalies');
    return data;
  },

  getById: async (anomalyId: string): Promise<Anomaly> => {
    const { data } = await api.get(`/anomalies/${anomalyId}`);
    return data;
  },

  dismiss: async (anomalyId: string): Promise<void> => {
    await api.patch(`/anomalies/${anomalyId}/dismiss`, { reason: 'false_positive' });
  },
  registerInspection: async (
    anomalyId: string,
    inspection: {
      confirmed_issue: string;
      notes?: string | null;
      location_lat?: number | null;
      location_lon?: number | null;
      photo_url?: string | null;
      mark_anomaly_inspected?: boolean;
    }
  ): Promise<any> => {
    const { data } = await api.post('/inspections', {
      anomaly_id: anomalyId,
      ...inspection,
    });
    return data;
  },
};

// ── Relatório PDF ─────────────────────────────────────────────────
export const reportsAPI = {
  downloadPDF: async (fieldId: string): Promise<Blob> => {
    const { data } = await api.post(
      `/fields/${fieldId}/report`,
      {},
      { responseType: 'blob' }
    );
    return data;
  },

  sendWhatsApp: async (fieldId: string, phone_number: string) => {
    const { data } = await api.post(`/fields/${fieldId}/report/whatsapp`, { phone_number });
    return data;
  },
};

export default api;
