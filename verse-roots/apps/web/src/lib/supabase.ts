import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';

export type { User };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create client with placeholder values if not configured so the module loads cleanly.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
);

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Send a magic link to the given email address. */
export async function sendMagicLink(email: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) {
    return { error: 'Authentication is not configured yet.' };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) return { error: error.message };
  return { error: null };
}

/** Sign the current user out. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/**
 * Get the currently authenticated user, or null if not signed in.
 * Uses getSession (localStorage, no network) for fast session restoration on
 * page reload. The onAuthStateChange listener will subsequently validate the
 * token server-side when the INITIAL_SESSION event fires.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

/**
 * Subscribe to auth state changes.
 * Fires immediately with the current user, then on every change.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  if (!isSupabaseConfigured) {
    callback(null);
    return () => {};
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => subscription.unsubscribe();
}

// ---------------------------------------------------------------------------
// Subscription status
// ---------------------------------------------------------------------------

export interface SubscriptionStatus {
  plan: 'free' | 'active' | 'canceled' | 'past_due';
  currentPeriodEnd: Date | null;
  canSync: boolean;
}

const FREE_STATUS: SubscriptionStatus = { plan: 'free', currentPeriodEnd: null, canSync: false };

export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  if (!isSupabaseConfigured) return FREE_STATUS;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return FREE_STATUS;

  const plan = (data as { status: SubscriptionStatus['plan']; current_period_end: string | null }).status;
  const periodEndRaw = (data as { status: SubscriptionStatus['plan']; current_period_end: string | null }).current_period_end;
  return {
    plan,
    currentPeriodEnd: periodEndRaw ? new Date(periodEndRaw) : null,
    canSync: plan === 'active',
  };
}
