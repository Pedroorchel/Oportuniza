import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env?.VITE_SUPABASE_URL || 'https://ckzygdwhihybrdzctdup.supabase.co';
const rawKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QHYzyrfocbKo60XS5EFYBA_Js8u-l0O';

// Sanitize URL to ensure standard Supabase base URL format (without /rest/v1 or trailing slashes)
const supabaseUrl = rawUrl
  .trim()
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '')
  .trim();

const supabaseAnonKey = rawKey.trim();

// Safe storage adapter so restricted/incognito browsers never crash at module load
function createSafeStorage() {
  const memoryFallback = new Map<string, string>();
  return {
    getItem(key: string): string | null {
      try {
        return typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem(key)
          : (memoryFallback.get(key) ?? null);
      } catch {
        return memoryFallback.get(key) ?? null;
      }
    },
    setItem(key: string, value: string): void {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
      } catch {
        // Fallback to memory storage when localStorage is blocked
      }
      memoryFallback.set(key, value);
    },
    removeItem(key: string): void {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch {
        // Ignore storage restrictions
      }
      memoryFallback.delete(key);
    },
  };
}

// Direct Supabase Client connected to your database
export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: createSafeStorage()
    }
  }
);

// Non-persisting client for isolated 2FA OTP checks without overwriting active Google/OAuth sessions
export function createEphemeralSupabaseClient() {
  return createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      }
    }
  );
}

// Helper to get the full base URL including subpath (e.g. /Oportuniza/ on GitHub Pages)
export function getAppRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  const envBase = (import.meta.env?.BASE_URL || '/').trim();
  let prefix = '';
  if (envBase.startsWith('/') && envBase !== '/') {
    prefix = envBase.replace(/\/+$/, '');
  } else if (window.location.hostname.endsWith('github.io')) {
    const segments = (window.location.pathname || '/').split('/').filter(Boolean);
    if (segments.length > 0 && segments[0].toLowerCase() === 'oportuniza') {
      prefix = `/${segments[0]}`;
    }
  }
  return `${window.location.origin}${prefix}/`;
}

// Backward-compatibility helper
export function isSupabaseUsingDummy() {
  return false;
}

