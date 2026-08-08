DROP INDEX IF EXISTS public.queue_entries_unique_service_id;
CREATE UNIQUE INDEX queue_entries_unique_active_service_id
  ON public.queue_entries (kind, service_id)
  WHERE service_id IS NOT NULL AND status IN ('waiting','proceed');