import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { wsClient } from '../lib/ws';

interface User {
  id: string;
  username: string;
  role: string;
  siteId: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      login: (token, user) => {
        wsClient.setToken(token);
        set({ token, user, isAuthenticated: true });
      },
      logout: () => {
        wsClient.setToken(null);
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'parkflow-auth',
      onRehydrateStorage: () => (state) => {
        // 페이지 새로고침 시 저장된 토큰으로 WebSocket 연결
        if (state?.token) {
          wsClient.setToken(state.token);
        }
      },
    }
  )
);
