DROP POLICY IF EXISTS "Auth add members" ON public.chat_members;
CREATE POLICY "Auth add members" ON public.chat_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR is_thread_member(thread_id, auth.uid())
  OR is_admin_or_management(auth.uid())
);