import { create } from 'zustand';
import { getMe, login, registerAccount, setAuthToken } from '../api';
import type { AuthClaims, User } from '../types';
import type { RegisterAccountPayload } from '../api';

interface AuthState {
  user: User | null;
  claims: AuthClaims | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  bootstrap: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: RegisterAccountPayload) => Promise<void>;
  signOut: () => void;
}

const storageKey = 'deskora-auth';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    const message = response?.data?.message;
    if (message) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isValidEmail(email: string) {
  return emailPattern.test(email.trim());
}

function clearAuthState() {
  localStorage.removeItem(storageKey);
  setAuthToken(null);
}

function hydrate() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return { token: null, user: null, claims: null };
  return JSON.parse(raw) as Pick<AuthState, 'token' | 'user' | 'claims'>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  ...hydrate(),
  loading: true,
  error: null,
  bootstrap: async () => {
    const { token } = get();
    if (!token) {
      set({ loading: false });
      return;
    }

    setAuthToken(token);
    try {
      const response = await getMe();
      set({ user: response.user, claims: response.claims, loading: false, error: null });
      localStorage.setItem(storageKey, JSON.stringify({ token, user: response.user, claims: response.claims }));
    } catch {
      clearAuthState();
      set({ user: null, claims: null, token: null, loading: false, error: 'Session expired.' });
    }
  },
  signIn: async (email: string, password: string) => {
    if (!isValidEmail(email)) {
      clearAuthState();
      set({ user: null, claims: null, token: null, loading: false, error: 'Enter a valid email address.' });
      throw new Error('Enter a valid email address.');
    }

    clearAuthState();
    set({ user: null, claims: null, token: null, loading: true, error: null });
    try {
      const response = await login(email, password);
      setAuthToken(response.token);
      const claimsResponse = await getMe();
      set({ user: response.user, claims: claimsResponse.claims, token: response.token, loading: false, error: null });
      localStorage.setItem(storageKey, JSON.stringify({ token: response.token, user: response.user, claims: claimsResponse.claims }));
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to sign in.');
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },
  signUp: async (payload) => {
    if (!isValidEmail(payload.email)) {
      clearAuthState();
      set({ user: null, claims: null, token: null, loading: false, error: 'Enter a valid email address.' });
      throw new Error('Enter a valid email address.');
    }

    clearAuthState();
    set({ user: null, claims: null, token: null, loading: true, error: null });
    try {
      const response = await registerAccount(payload);
      setAuthToken(response.token);
      const claimsResponse = await getMe();
      set({ user: response.user, claims: claimsResponse.claims, token: response.token, loading: false, error: null });
      localStorage.setItem(storageKey, JSON.stringify({ token: response.token, user: response.user, claims: claimsResponse.claims }));
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to create account.');
      set({ loading: false, error: message });
      throw new Error(message);
    }
  },
  signOut: () => {
    clearAuthState();
    set({ user: null, claims: null, token: null, error: null });
  }
}));
