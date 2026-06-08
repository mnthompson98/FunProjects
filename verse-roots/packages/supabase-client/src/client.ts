import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ??
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ??
  '';

const supabaseAnonKey =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ??
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ??
  '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');
