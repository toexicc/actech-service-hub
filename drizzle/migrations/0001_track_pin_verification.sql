CREATE OR REPLACE FUNCTION public.public_track_pin_matches(_service_id text, _last4 text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_contact text; v_found boolean := false; g text; v_any boolean := false;
  v_pin text := right(regexp_replace(coalesce(_last4,''), '\D', '', 'g'), 4);
BEGIN
  SELECT true, coalesce(contact_number,'') INTO v_found, v_contact
  FROM public.services WHERE service_id = upper(btrim(_service_id)) LIMIT 1;
  IF NOT coalesce(v_found,false) THEN RETURN 'not_found'; END IF;
  FOR g IN SELECT x FROM regexp_split_to_table(v_contact, '[^0-9]+') x WHERE length(x) >= 4 LOOP
    v_any := true;
    IF right(g,4) = v_pin AND length(v_pin) = 4 THEN RETURN 'ok'; END IF;
  END LOOP;
  IF NOT v_any THEN RETURN 'no_contact'; END IF;
  RETURN 'mismatch';
END $$;

CREATE OR REPLACE FUNCTION public.public_service_snapshot_verified(_service_id text, _last4 text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF public.public_track_pin_matches(_service_id, _last4) <> 'ok' THEN RETURN NULL; END IF;
  RETURN public.public_service_snapshot(upper(btrim(_service_id)));
END $$;

CREATE OR REPLACE FUNCTION public.public_track_pin_status(_service_id text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE WHEN s.service_id IS NULL THEN 'not_found'
    WHEN coalesce(regexp_replace(s.contact_number,'\D','','g'),'') ~ '\d{4}' THEN 'needs_pin'
    ELSE 'no_contact' END
  FROM (SELECT 1) d LEFT JOIN public.services s ON s.service_id = upper(btrim(_service_id));
$$;

GRANT EXECUTE ON FUNCTION public.public_service_snapshot_verified(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_track_pin_status(text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_track_pin_matches(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.public_service_snapshot(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_service_snapshot(text) TO authenticated, service_role;