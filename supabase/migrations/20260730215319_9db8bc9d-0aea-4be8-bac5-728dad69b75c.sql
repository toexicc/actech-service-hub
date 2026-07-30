ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS username text;

UPDATE public.clients c
SET username = s.username
FROM (
  SELECT DISTINCT ON (client_id) client_id, username
  FROM public.services
  WHERE client_id IS NOT NULL AND username IS NOT NULL AND username <> ''
  ORDER BY client_id, created_at DESC
) s
WHERE s.client_id = c.client_id AND (c.username IS NULL OR c.username = '');