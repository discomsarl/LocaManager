import { createAuthClient } from 'better-auth/react';

const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const authClient = createAuthClient({
  // Better Auth endpoints are mounted by Express under /api/auth. Prefer the
  // explicit API URL from env, otherwise use the current origin for same-site
  // cookies in production and local development.
  baseURL: `${apiBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '')}/api/auth`,
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient;
