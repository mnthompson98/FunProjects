import { supabase, isSupabaseConfigured } from './client.js';

export interface SubscriptionStatus {
  plan: 'free' | 'active' | 'canceled' | 'past_due';
  currentPeriodEnd: Date | null;
  canSync: boolean; // true only when plan === 'active'
}

const FREE_STATUS: SubscriptionStatus = {
  plan: 'free',
  currentPeriodEnd: null,
  canSync: false,
};

/** Fetch subscription status for the given user from Supabase. */
export async function getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
  if (!isSupabaseConfigured) return FREE_STATUS;

  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return FREE_STATUS;

  const plan = data.status as SubscriptionStatus['plan'];
  return {
    plan,
    currentPeriodEnd: data.current_period_end ? new Date(data.current_period_end) : null,
    canSync: plan === 'active',
  };
}
