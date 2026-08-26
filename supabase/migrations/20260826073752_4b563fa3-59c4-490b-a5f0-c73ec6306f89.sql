CREATE OR REPLACE FUNCTION public.submit_release_queue(_summary jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_service_id text := btrim(COALESCE(_summary->>'service_id', ''));
  v_existing public.queue_entries%ROWTYPE;
  v_inserted public.queue_entries%ROWTYPE;
BEGIN
  IF v_service_id = '' THEN
    RAISE EXCEPTION 'Service ID is required';
  END IF;

  SELECT * INTO v_existing
  FROM public.queue_entries
  WHERE kind = 'release'
    AND service_id = v_service_id
    AND status IN ('waiting', 'proceed')
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', v_existing.id,
      'display_code', v_existing.display_code,
      'status', v_existing.status,
      'reused', true
    );
  END IF;

  INSERT INTO public.queue_entries (
    kind,
    status,
    client_name,
    contact_number,
    device_type,
    brand,
    model,
    chief_complaint,
    service_id,
    form_payload
  ) VALUES (
    'release',
    'waiting',
    nullif(btrim(COALESCE(_summary->>'client_name', '')), ''),
    nullif(_summary->>'contact_number', ''),
    nullif(_summary->>'device_type', ''),
    nullif(_summary->>'brand', ''),
    nullif(_summary->>'model', ''),
    nullif(_summary->>'chief_complaint', ''),
    v_service_id,
    COALESCE(_summary, '{}'::jsonb)
  )
  RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'id', v_inserted.id,
    'display_code', v_inserted.display_code,
    'status', v_inserted.status,
    'reused', false
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.queue_entries
    WHERE kind = 'release'
      AND service_id = v_service_id
      AND status IN ('waiting', 'proceed')
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'id', v_existing.id,
        'display_code', v_existing.display_code,
        'status', v_existing.status,
        'reused', true
      );
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_release_queue(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_release_queue(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_release_queue(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_release_queue(jsonb) TO service_role;