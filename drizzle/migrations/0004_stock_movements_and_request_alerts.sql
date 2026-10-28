CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id text,
  part_name text,
  part_source text NOT NULL DEFAULT 'inventory',
  movement_type text NOT NULL,
  quantity_before integer NOT NULL DEFAULT 0,
  quantity_after integer NOT NULL DEFAULT 0,
  delta integer NOT NULL DEFAULT 0,
  service_id text,
  actor_id uuid,
  actor_name text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,
  review_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (true);
CREATE INDEX stock_movements_created_idx ON public.stock_movements (created_at DESC);
CREATE INDEX stock_movements_status_idx ON public.stock_movements (status);

ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS acknowledged_by_name text;

CREATE OR REPLACE FUNCTION public.has_inventory_access(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('inventory','management'));
END $$;

CREATE OR REPLACE FUNCTION public.notify_inventory_staff(_title text, _message text, _link text, _service_id text, _include_management boolean, _exclude uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, recipient_name, category, title, message, link, service_id)
  SELECT DISTINCT p.id, p.name, 'part_request', _title, _message, _link, _service_id
  FROM public.user_roles r JOIN public.profiles p ON p.id = r.user_id
  WHERE (r.role::text = 'inventory' OR (_include_management AND r.role::text = 'management'))
    AND coalesce(p.status,'active') = 'active'
    AND (_exclude IS NULL OR p.id <> _exclude);
END $$;

CREATE OR REPLACE FUNCTION public.stock_movement_capture()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_type text; v_before int; v_after int; v_pid text; v_pname text;
  v_status text := 'pending';
  v_src text := CASE WHEN TG_TABLE_NAME = 'fast_moving_parts' THEN 'fast_moving' ELSE 'inventory' END;
BEGIN
  IF coalesce(current_setting('app.skip_movement', true),'') = 'on' THEN RETURN NULL; END IF;
  IF TG_OP = 'INSERT' THEN
    v_type := 'added'; v_before := 0; v_after := coalesce(NEW.quantity,0); v_pid := NEW.part_id; v_pname := NEW.part_name;
  ELSIF TG_OP = 'UPDATE' THEN
    IF coalesce(NEW.quantity,0) = coalesce(OLD.quantity,0) THEN RETURN NULL; END IF;
    v_before := coalesce(OLD.quantity,0); v_after := coalesce(NEW.quantity,0);
    v_type := CASE WHEN v_after > v_before THEN 'stock_in' ELSE 'stock_out' END;
    v_pid := NEW.part_id; v_pname := NEW.part_name;
  ELSE
    v_type := 'removed'; v_before := coalesce(OLD.quantity,0); v_after := 0; v_pid := OLD.part_id; v_pname := OLD.part_name;
  END IF;
  SELECT name INTO v_name FROM public.profiles WHERE id = v_uid;
  IF v_uid IS NULL OR public.has_inventory_access(v_uid) THEN v_status := 'approved'; END IF;
  INSERT INTO public.stock_movements (part_id, part_name, part_source, movement_type, quantity_before, quantity_after, delta, actor_id, actor_name, status, reviewed_at, reviewed_by_name)
  VALUES (v_pid, v_pname, v_src, v_type, v_before, v_after, v_after - v_before, v_uid, coalesce(v_name,'System'), v_status,
    CASE WHEN v_status = 'approved' THEN now() END, CASE WHEN v_status = 'approved' THEN 'Auto (inventory staff)' END);
  IF v_status = 'pending' THEN
    PERFORM public.notify_inventory_staff(
      'Stock movement needs approval',
      coalesce(v_name,'Someone') || ' ' || CASE v_type WHEN 'added' THEN 'added a new part' WHEN 'removed' THEN 'removed a part' WHEN 'stock_in' THEN 'added stock to' ELSE 'took stock from' END
        || ': ' || coalesce(v_pname, v_pid) || ' (' || v_before || ' → ' || v_after || ')',
      '/inventory-management?tab=movements', NULL, false, v_uid);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER inventory_parts_stock_movement AFTER INSERT OR UPDATE OR DELETE ON public.inventory_parts
  FOR EACH ROW EXECUTE FUNCTION public.stock_movement_capture();
CREATE TRIGGER fast_moving_parts_stock_movement AFTER INSERT OR UPDATE OR DELETE ON public.fast_moving_parts
  FOR EACH ROW EXECUTE FUNCTION public.stock_movement_capture();

-- Link a movement to the service when a part log with a service follows it.
CREATE OR REPLACE FUNCTION public.stock_movement_link_service()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF nullif(btrim(coalesce(NEW.service_id,'')),'') IS NULL OR NEW.part_id IS NULL THEN RETURN NULL; END IF;
  UPDATE public.stock_movements SET service_id = NEW.service_id, notes = coalesce(notes, NEW.notes)
  WHERE id = (SELECT id FROM public.stock_movements WHERE part_id = NEW.part_id AND service_id IS NULL
              AND created_at > now() - interval '2 minutes' ORDER BY created_at DESC LIMIT 1);
  RETURN NULL;
END $$;
CREATE TRIGGER part_logs_link_movement AFTER INSERT ON public.part_logs
  FOR EACH ROW EXECUTE FUNCTION public.stock_movement_link_service();

CREATE OR REPLACE FUNCTION public.review_stock_movement(_ids uuid[], _approve boolean, _reason text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid(); v_name text; m record; n int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.has_inventory_access(v_uid) THEN RAISE EXCEPTION 'Only inventory staff or management can review stock movements'; END IF;
  IF NOT _approve AND nullif(btrim(coalesce(_reason,'')),'') IS NULL THEN RAISE EXCEPTION 'A reason is required to reject'; END IF;
  SELECT name INTO v_name FROM public.profiles WHERE id = v_uid;
  FOR m IN SELECT * FROM public.stock_movements WHERE id = ANY(_ids) AND status = 'pending' LOOP
    IF NOT _approve AND m.movement_type IN ('stock_in','stock_out') THEN
      PERFORM set_config('app.skip_movement','on', true);
      IF m.part_source = 'fast_moving' THEN
        UPDATE public.fast_moving_parts SET quantity = greatest(0, quantity - m.delta) WHERE part_id = m.part_id;
      ELSE
        UPDATE public.inventory_parts SET quantity = greatest(0, quantity - m.delta) WHERE part_id = m.part_id;
      END IF;
      PERFORM set_config('app.skip_movement','off', true);
    END IF;
    UPDATE public.stock_movements SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_uid, reviewed_by_name = v_name, reviewed_at = now(), review_reason = nullif(btrim(coalesce(_reason,'')),'')
    WHERE id = m.id;
    IF NOT _approve AND m.actor_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, recipient_name, category, title, message, link, service_id)
      VALUES (m.actor_id, m.actor_name, 'part_request', 'Stock change rejected',
        coalesce(v_name,'Inventory') || ' rejected your change to ' || coalesce(m.part_name, m.part_id) || ': ' || _reason
          || CASE WHEN m.movement_type IN ('stock_in','stock_out') THEN ' (stock restored to ' || m.quantity_before || ')' ELSE '' END,
        '/inventory-management?tab=movements', m.service_id);
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
GRANT EXECUTE ON FUNCTION public.review_stock_movement(uuid[], boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_inventory_access(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_inventory_staff(text,text,text,text,boolean,uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.part_request_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.notify_inventory_staff('New part request',
    coalesce(NEW.requested_by_name,'A technician') || ' requested ' || coalesce(NEW.quantity,1) || '× ' || coalesce(NEW.part_name, NEW.part_id, 'a part')
      || CASE WHEN NEW.service_id IS NOT NULL THEN ' for ' || NEW.service_id ELSE '' END,
    '/request-for-parts', NEW.service_id, true, NEW.requested_by);
  RETURN NULL;
END $$;
CREATE TRIGGER part_requests_alert AFTER INSERT ON public.part_requests
  FOR EACH ROW EXECUTE FUNCTION public.part_request_alert();