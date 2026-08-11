ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS diagnosis_warranty text,
  ADD COLUMN IF NOT EXISTS diagnosis_other_notes text,
  ADD COLUMN IF NOT EXISTS diagnosis_summary text;