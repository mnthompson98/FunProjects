import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './client.js';

export type { User };

/**
 * Send a magic link to the given email address.
 * Returns an error string if something went wrong, or null on success.
 */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Authentication is not configured yet.' };
  }
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) return { error: error.message };
  return { error: null };
}

/** Sign the current user out. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Get the currently authenticated user, or null if not signed in. */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/**
 * Subscribe to auth state changes.
 * The callback is called immediately with the current user, then on every change.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  if (!isSupabaseConfigured) {
    callback(null);
    return () => {};
  }

  // Fire immediately with current session
  supabase.auth.getUser().then(({ data }) => callback(data.user ?? null));

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}
