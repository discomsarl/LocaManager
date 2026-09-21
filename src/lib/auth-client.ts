import { createAuthClient } from 'better-auth/react';

const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const authClient = createAuthClient({
  // Better Auth endpoints are mounted by Express under /api/auth.  Keeping this
  // relative by default lets the Vite proxy work in development and keeps the
  // same-origin cookie in production.
  baseURL: `${apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')}/api/auth`,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
