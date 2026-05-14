
CREATE OR REPLACE FUNCTION public.find_or_create_dm_thread(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  existing_id uuid;
  new_id uuid;
BEGIN
  IF me IS NULL OR _other_user_id IS NULL OR me = _other_user_id THEN
    RAISE EXCEPTION 'Invalid users for DM thread';
  END IF;

  SELECT t.id INTO existing_id
  FROM chat_threads t
  WHERE t.is_group = false
    AND EXISTS (SELECT 1 FROM chat_members m1 WHERE m1.thread_id = t.id AND m1.user_id = me)
    AND EXISTS (SELECT 1 FROM chat_members m2 WHERE m2.thread_id = t.id AND m2.user_id = _other_user_id)
    AND (SELECT COUNT(*) FROM chat_members m3 WHERE m3.thread_id = t.id) = 2
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO chat_threads (created_by, is_group)
  VALUES (me, false)
  RETURNING id INTO new_id;

  INSERT INTO chat_members (thread_id, user_id) VALUES (new_id, me);
  INSERT INTO chat_members (thread_id, user_id) VALUES (new_id, _other_user_id);

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_dm_thread(uuid) TO authenticated;
