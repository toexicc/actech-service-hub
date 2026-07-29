DROP POLICY IF EXISTS "Anyone can read active queue entries" ON public.queue_entries;
CREATE POLICY "Anyone can read recent queue entries"
ON public.queue_entries
FOR SELECT
TO anon, authenticated
USING (created_at > now() - interval '12 hours');