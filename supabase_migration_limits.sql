-- Migration: Usage limits & quota control
-- Run this in Supabase SQL Editor after deploying the new server code

-- 1. Global settings table (key-value)
CREATE TABLE IF NOT EXISTS public.usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Seed default values
INSERT INTO public.usage_limits (key, value) VALUES
  ('default_daily_limit', '20'),
  ('monthly_budget_usd', '500')
ON CONFLICT (key) DO NOTHING;

-- 2. Per-user daily limit override on profiles
-- NULL = use global default, 0 = blocked, number = custom limit
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_limit_override INTEGER DEFAULT NULL;

-- 3. Composite index for fast daily usage counting
CREATE INDEX IF NOT EXISTS idx_api_usage_user_day
  ON public.api_usage (user_id, created_at)
  WHERE success = true;
