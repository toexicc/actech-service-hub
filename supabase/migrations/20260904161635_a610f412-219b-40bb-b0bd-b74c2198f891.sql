ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_released boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS has_pre_order boolean NOT NULL DEFAULT false;