import { create } from 'zustand';

import { deleteToken, getToken, setToken } from '@/lib/storage';

type AuthState = {
  isAuthenticated: boolean;
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isHydrated: false,
  hydrate: async () => {
    const token = await getToken();
    set({ isAuthenticated: Boolean(token), isHydrated: true });
  },
  login: async (token: string) => {
    await setToken(token);
    set({ isAuthenticated: true });
  },
  logout: async () => {
    await deleteToken();
    set({ isAuthenticated: false });
  },
}));
