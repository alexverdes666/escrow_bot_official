import { create } from 'zustand';
import { api } from './api';

interface User {
  _id: string;
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  photoUrl?: string;
  role: 'user' | 'admin';
  reputation: {
    score: number;
    completedDeals: number;
    disputesWon: number;
    disputesLost: number;
    disputesTotal: number;
  };
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (authData: Record<string, unknown>) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  login: async (authData) => {
    const { data } = await api.post('/auth/telegram', authData);
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    set({ user: data.user, token: data.token, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isLoading: false });
  },

  loadFromStorage: () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ user, token, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));
