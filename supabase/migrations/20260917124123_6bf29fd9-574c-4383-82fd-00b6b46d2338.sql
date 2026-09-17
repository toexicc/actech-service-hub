ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS interim_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interim_diagnosis text,
  ADD COLUMN IF NOT EXISTS ai_interim_report text,
  ADD COLUMN IF NOT EXISTS interim_warranty text,
  ADD COLUMN IF NOT EXISTS interim_summary text,
  ADD COLUMN IF NOT EXISTS interim_breakdown_text text,
  ADD COLUMN IF NOT EXISTS interim_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS interim_approved_at timestamptz;

ALTER TYPE public.service_file_kind ADD VALUE IF NOT EXISTS 'interim_photo';