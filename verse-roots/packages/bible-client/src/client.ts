import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL as string) ?? '';
const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) ?? '';

export const bibleSupa: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
);
