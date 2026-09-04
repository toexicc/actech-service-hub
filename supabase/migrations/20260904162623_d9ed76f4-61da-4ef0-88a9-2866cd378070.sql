UPDATE public.services s
SET is_released = true,
    released_at = COALESCE(s.released_at, q.updated_at, q.created_at)
FROM public.queue_entries q
WHERE q.kind = 'release'
  AND q.status = 'completed'
  AND q.service_id = s.service_id
  AND s.is_released = false;