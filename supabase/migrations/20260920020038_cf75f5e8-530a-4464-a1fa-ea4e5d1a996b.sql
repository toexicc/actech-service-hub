ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS parts_ordered boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waiting_parts_note_tech text;