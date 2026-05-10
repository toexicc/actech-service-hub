CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.set_last_updated()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.last_updated = now(); RETURN NEW; END;
$$;