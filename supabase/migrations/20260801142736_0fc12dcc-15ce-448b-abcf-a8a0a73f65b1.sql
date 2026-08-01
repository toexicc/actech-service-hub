DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['services','service_breakdowns','client_inquiries','clients','part_requests','inventory_parts','fast_moving_parts','transactions','expenses','queue_entries','activity_logs']
  LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;