ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS waiting_parts_note text,
  ADD COLUMN IF NOT EXISTS is_backjob boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rush_fee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rto_reason text;

ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'RTO - ACTech';
ALTER TYPE public.service_status ADD VALUE IF NOT EXISTS 'RTO - Client';