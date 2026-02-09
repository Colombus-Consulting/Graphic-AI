-- Migration: API usage tracking for cost estimation
-- Run this in the Supabase SQL Editor

CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  mode TEXT NOT NULL DEFAULT 'base',
  image_size TEXT NOT NULL DEFAULT '1K',
  input_image_count INTEGER NOT NULL DEFAULT 1,
  prompt_token_count INTEGER,
  candidates_token_count INTEGER,
  total_token_count INTEGER,
  output_image_count INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6),
  is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_usage_user_id ON public.api_usage(user_id);
CREATE INDEX idx_api_usage_created_at ON public.api_usage(created_at DESC);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
