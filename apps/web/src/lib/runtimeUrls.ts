function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, '');
}

export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return normalizeBaseUrl(String(import.meta.env.VITE_API_URL));
  }

  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return 'http://localhost:4000/api';
  }

  return '/api';
}

export function getSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) {
    return normalizeBaseUrl(String(import.meta.env.VITE_SOCKET_URL));
  }

  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return 'http://localhost:4000';
  }

  return window.location.origin;
}