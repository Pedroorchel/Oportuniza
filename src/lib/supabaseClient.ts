import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ckzygdwhihybrdzctdup.supabase.co';
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QHYzyrfocbKo60XS5EFYBA_Js8u-l0O';

// Sanitize URL to ensure standard Supabase base URL format (without /rest/v1 or trailing slashes)
const supabaseUrl = rawUrl
  .trim()
  .replace(/\/rest\/v1\/?$/i, '')
  .replace(/\/+$/, '')
  .trim();

const supabaseAnonKey = rawKey.trim();

// Direct Supabase Client connected to your database
export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage // Store auth tokens securely for session persistence
    }
  }
);

// Helper to get the full base URL including subpath (e.g. /oportunizae/ on GitHub Pages)
export function getAppRedirectUrl(): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

// Backward-compatibility helper
export function isSupabaseUsingDummy() {
  return false;
}

