-- Enable RLS on all tables
-- Users are managed by Supabase Auth (auth.users table)

-- Subscriptions table (synced from Stripe webhooks)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'free', -- 'free' | 'active' | 'canceled' | 'past_due'
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Studies table (mirrors the IndexedDB Study type)
CREATE TABLE public.studies (
  id UUID PRIMARY KEY,  -- same UUID as local IndexedDB id
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_ref TEXT NOT NULL,
  title TEXT NOT NULL,
  focus_strongs TEXT,
  focus_word TEXT,
  sections JSONB NOT NULL DEFAULT '[]',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ  -- soft delete for sync
);

-- RLS policies
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;

-- Users can only see/modify their own data
CREATE POLICY "users_own_subscriptions" ON public.subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "users_own_studies" ON public.studies
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_studies_user_verse ON public.studies(user_id, verse_ref);
CREATE INDEX idx_studies_user_updated ON public.studies(user_id, updated_at DESC);
CREATE INDEX idx_studies_focus_strongs ON public.studies(user_id, focus_strongs);
