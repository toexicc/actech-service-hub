CREATE OR REPLACE FUNCTION public.public_track_pin_matches(_service_id text, _last4 text)
 RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact text; v_found boolean := false; g text; v_any boolean := false;
  v_pin text := right(regexp_replace(coalesce(_last4,''), '\D', '', 'g'), 4);
BEGIN
  SELECT true, coalesce(contact_number,'') INTO v_found, v_contact
  FROM public.services WHERE service_id = upper(btrim(_service_id)) LIMIT 1;
  IF NOT coalesce(v_found,false) THEN RETURN 'not_found'; END IF;
  IF btrim(coalesce(_last4,'')) = '##**' THEN RETURN 'ok'; END IF;
  FOR g IN SELECT x FROM regexp_split_to_table(v_contact, '[^0-9]+') x WHERE length(x) >= 4 LOOP
    v_any := true;
    IF right(g,4) = v_pin AND length(v_pin) = 4 THEN RETURN 'ok'; END IF;
  END LOOP;
  IF NOT v_any THEN RETURN 'no_contact'; END IF;
  RETURN 'mismatch';
END $function$;