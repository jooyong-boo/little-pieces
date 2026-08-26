import { create } from 'zustand';

import { deleteToken, getToken, setToken } from '@/lib/storage';

type AuthState = {
  /** 매 요청마다 SecureStore를 읽으면 느리다. SecureStore는 영속 계층으로만 쓴다. */
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  hydrate: async () => {
    const token = await getToken();
    set({ token, isAuthenticated: Boolean(token), isHydrated: true });
  },
  login: async (token: string) => {
    await setToken(token);
    set({ token, isAuthenticated: true });
  },
  logout: async () => {
    await deleteToken();
    set({ token: null, isAuthenticated: false });
  },
}));
