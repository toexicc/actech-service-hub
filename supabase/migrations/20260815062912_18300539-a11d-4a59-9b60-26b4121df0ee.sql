CREATE OR REPLACE FUNCTION public.create_service_atomic(
  _payload jsonb,
  _queue_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id text;
  v_service_id text;
  v_prefix text := 'AC' || to_char(current_date, 'DDMMYY');
  v_suffix integer;
  v_is_service_role boolean := COALESCE(auth.jwt()->>'role', '') = 'service_role';
BEGIN
  IF auth.uid() IS NULL AND NOT v_is_service_role THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _payload IS NULL OR nullif(btrim(_payload->>'client_name'), '') IS NULL THEN
    RAISE EXCEPTION 'Client name is required';
  END IF;

  IF _queue_id IS NOT NULL THEN
    SELECT service_id INTO v_existing_id
    FROM public.queue_entries
    WHERE id = _queue_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Queue entry not found';
    END IF;

    IF v_existing_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.services WHERE service_id = v_existing_id) THEN
        RETURN v_existing_id;
      END IF;
      RAISE EXCEPTION 'Queue entry has an invalid ticket reference';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_prefix));

  SELECT candidate INTO v_suffix
  FROM generate_series(0, 999) AS candidate
  WHERE NOT EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.service_id = v_prefix || lpad(candidate::text, 3, '0')
  )
  ORDER BY candidate
  LIMIT 1;

  IF v_suffix IS NULL THEN
    RAISE EXCEPTION 'Daily ticket number capacity reached';
  END IF;

  v_service_id := v_prefix || lpad(v_suffix::text, 3, '0');

  INSERT INTO public.services (
    service_id, client_id, client_name, contact_number, email, address, username,
    device_type, brand, model, serial_number, color, memory, device_password,
    chief_complaint, issue_description, device_notes, estimated_cost,
    estimated_completion, client_type, priority, receiving_staff, technicians,
    admin_reps, technician_departments, source, conditions, acknowledgements,
    auto_approve_diagnosis, rush_fee
  ) VALUES (
    v_service_id,
    nullif(_payload->>'client_id', ''),
    _payload->>'client_name',
    nullif(_payload->>'contact_number', ''),
    nullif(_payload->>'email', ''),
    nullif(_payload->>'address', ''),
    nullif(_payload->>'username', ''),
    nullif(_payload->>'device_type', ''),
    nullif(_payload->>'brand', ''),
    nullif(_payload->>'model', ''),
    nullif(_payload->>'serial_number', ''),
    nullif(_payload->>'color', ''),
    nullif(_payload->>'memory', ''),
    nullif(_payload->>'device_password', ''),
    nullif(_payload->>'chief_complaint', ''),
    nullif(_payload->>'issue_description', ''),
    nullif(_payload->>'device_notes', ''),
    COALESCE((_payload->>'estimated_cost')::numeric, 0),
    nullif(_payload->>'estimated_completion', ''),
    nullif(_payload->>'client_type', ''),
    nullif(_payload->>'priority', ''),
    nullif(_payload->>'receiving_staff', ''),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'technicians', '[]'::jsonb))), ARRAY[]::text[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'admin_reps', '[]'::jsonb))), ARRAY[]::text[]),
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'technician_departments', '[]'::jsonb))), ARRAY[]::text[]),
    COALESCE(nullif(_payload->>'source', ''), 'Staff Intake'),
    COALESCE(_payload->'conditions', '{}'::jsonb),
    COALESCE(_payload->'acknowledgements', '{}'::jsonb),
    COALESCE((_payload->>'auto_approve_diagnosis')::boolean, false),
    COALESCE((_payload->>'rush_fee')::boolean, false)
  );

  IF _queue_id IS NOT NULL THEN
    UPDATE public.queue_entries
    SET status = 'completed', service_id = v_service_id, updated_at = now()
    WHERE id = _queue_id;
  END IF;

  RETURN v_service_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_service_atomic(jsonb, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_service_atomic(jsonb, uuid) TO authenticated, service_role;