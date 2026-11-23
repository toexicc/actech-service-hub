-- Automatic target dates, and part requests that are approved before a part goes on a ticket.
-- Applied to the database on 2026-11-23; written to be safe to run again.

-- ---------------------------------------------------------------------------
-- 1) Automatic target dates
-- ---------------------------------------------------------------------------
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS target_date_auto boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.services.target_date_auto IS 'True when target_date was filled in from the diagnostic or repair time frame rather than picked by staff.';

-- Time frame -> target date, counted from _from. Sundays move to Monday (the shop is open Monday to Saturday).
CREATE OR REPLACE FUNCTION public.target_date_from_time_frame(_time_frame text, _from date)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  k text := lower(regexp_replace(btrim(coalesce(_time_frame, '')), '\s*[-–—]\s*', '-', 'g'));
  d date;
BEGIN
  IF _from IS NULL OR k = '' THEN RETURN NULL; END IF;
  d := CASE k
    WHEN 'same-day' THEN _from
    WHEN 'same day' THEN _from
    WHEN 'within the day' THEN _from
    WHEN 'next business day' THEN _from + 1
    WHEN '1-2 days' THEN _from + 2
    WHEN '3-5 days' THEN _from + 3
    WHEN '5-7 days' THEN _from + 5
    WHEN '1-2 weeks' THEN _from + 14
    WHEN '2-4 weeks' THEN _from + 21
    ELSE NULL
  END;
  IF d IS NOT NULL AND extract(isodow FROM d) = 7 THEN d := d + 1; END IF;
  RETURN d;
END $$;

-- Fills an empty target date from the time frames (repair first, else diagnostic), counted from today in Manila.
-- An automatic date follows a repair time frame that is added or changed (or a changed diagnostic time frame
-- while there is no repair time frame). A date picked by staff is never changed. Closed tickets are left alone.
CREATE OR REPLACE FUNCTION public.services_auto_target_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Manila')::date;
  v_closed boolean := coalesce(NEW.status::text, '') IN ('Completed', 'Cancelled', 'RTO', 'RTO - ACTech', 'RTO - Client');
  v_repair text := nullif(btrim(coalesce(NEW.repair_time_frame, '')), '');
  v_diag text := nullif(btrim(coalesce(NEW.estimated_completion, '')), '');
  v_prev date;
  v_source text;
  v_tf text;
  v_date date;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_prev := OLD.target_date;
    -- A date picked by staff is theirs: it is never changed automatically.
    IF NEW.target_date IS NOT NULL AND NEW.target_date IS DISTINCT FROM OLD.target_date THEN
      NEW.target_date_auto := false;
      RETURN NEW;
    END IF;
    -- A screen that loaded the ticket before its automatic date existed sends it back empty: keep the date.
    IF NEW.target_date IS NULL AND OLD.target_date IS NOT NULL AND OLD.target_date_auto THEN
      NEW.target_date := OLD.target_date;
    END IF;
    NEW.target_date_auto := CASE WHEN NEW.target_date IS NULL THEN false ELSE OLD.target_date_auto END;
    IF v_closed THEN RETURN NEW; END IF;

    IF v_repair IS NOT NULL AND v_repair IS DISTINCT FROM nullif(btrim(coalesce(OLD.repair_time_frame, '')), '')
       AND (NEW.target_date IS NULL OR NEW.target_date_auto) THEN
      v_source := 'Repair Time Frame'; v_tf := v_repair;
    ELSIF v_repair IS NULL AND v_diag IS NOT NULL AND v_diag IS DISTINCT FROM nullif(btrim(coalesce(OLD.estimated_completion, '')), '')
       AND (NEW.target_date IS NULL OR NEW.target_date_auto) THEN
      v_source := 'Diagnostic Time Frame'; v_tf := v_diag;
    ELSIF NEW.target_date IS NULL AND coalesce(v_repair, v_diag) IS NOT NULL THEN
      v_source := CASE WHEN v_repair IS NOT NULL THEN 'Repair Time Frame' ELSE 'Diagnostic Time Frame' END;
      v_tf := coalesce(v_repair, v_diag);
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    IF NEW.target_date IS NOT NULL THEN
      NEW.target_date_auto := false;
      RETURN NEW;
    END IF;
    NEW.target_date_auto := false;
    IF v_closed OR coalesce(v_repair, v_diag) IS NULL THEN RETURN NEW; END IF;
    v_source := CASE WHEN v_repair IS NOT NULL THEN 'Repair Time Frame' ELSE 'Diagnostic Time Frame' END;
    v_tf := coalesce(v_repair, v_diag);
  END IF;

  v_date := public.target_date_from_time_frame(v_tf, v_today);
  IF v_date IS NULL THEN RETURN NEW; END IF;
  IF v_date IS NOT DISTINCT FROM NEW.target_date THEN
    NEW.target_date_auto := true;
    RETURN NEW;
  END IF;
  NEW.target_date := v_date;
  NEW.target_date_auto := true;
  INSERT INTO public.activity_logs (action, actor_id, actor_name, entity_type, entity_id, changes)
  VALUES ('Target date set automatically: ' || to_char(v_date, 'Mon DD, YYYY') || ' (' || v_source || ': ' || v_tf || ')',
          NULL, 'System', 'service', NEW.service_id,
          jsonb_build_object('role', 'system',
            'Target Date', jsonb_build_object('from', coalesce(to_char(v_prev, 'MM-DD-YYYY'), '(empty)'), 'to', to_char(v_date, 'MM-DD-YYYY'))));
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS services_auto_target_date ON public.services;
CREATE TRIGGER services_auto_target_date
  BEFORE INSERT OR UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.services_auto_target_date();

-- ---------------------------------------------------------------------------
-- 2) Part requests: requested from a ticket, approved by inventory staff or management
-- ---------------------------------------------------------------------------
ALTER TABLE public.part_requests ALTER COLUMN status SET DEFAULT 'Requested';
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS approved_by_name text;

CREATE OR REPLACE FUNCTION public.part_request_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.notify_inventory_staff('New part request',
    coalesce(NEW.requested_by_name, 'A technician') || ' requested ' || coalesce(NEW.quantity, 1) || '× ' || coalesce(NEW.part_name, NEW.part_id, 'a part')
      || CASE WHEN NEW.service_id IS NOT NULL THEN ' for ' || NEW.service_id ELSE '' END
      || CASE WHEN NEW.status = 'For Ordering' THEN ' (needs ordering)' ELSE '' END,
    '/inventory-management?tab=requests', NEW.service_id, true, NEW.requested_by);
  RETURN NULL;
END $$;

-- Approving takes the stock (recorded as an approved stock movement linked to the ticket), adds the part to the
-- ticket's parts used ("PART-ID (qty)") and parts cost, closes the request, logs it on the ticket and tells the
-- requester. _part_id picks the inventory part for a request typed in by name; _quantity overrides the amount.
CREATE OR REPLACE FUNCTION public.approve_part_request(_id uuid, _part_id text DEFAULT NULL, _quantity integer DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_role text;
  r public.part_requests%ROWTYPE;
  p public.inventory_parts%ROWTYPE;
  v_parts text[];
  v_lines text[] := ARRAY[]::text[];
  v_line text;
  v_found boolean := false;
  v_qty int;
  v_left int;
  v_link text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_inventory_access(v_uid) THEN
    RAISE EXCEPTION 'Only inventory staff or management can approve part requests';
  END IF;
  SELECT name INTO v_name FROM public.profiles WHERE id = v_uid;
  v_role := CASE WHEN public.has_role(v_uid, 'management'::app_role) THEN 'management' ELSE 'inventory' END;

  SELECT * INTO r FROM public.part_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Part request not found'; END IF;
  IF r.status IN ('Approved', 'Released to technician', 'Cancelled') THEN
    RAISE EXCEPTION 'This request is already %', lower(r.status);
  END IF;
  IF nullif(btrim(coalesce(r.service_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'This request is not linked to a ticket';
  END IF;

  v_qty := coalesce(_quantity, r.quantity, 1);
  IF v_qty < 1 THEN RAISE EXCEPTION 'Quantity must be at least 1'; END IF;

  SELECT * INTO p FROM public.inventory_parts
   WHERE part_id = coalesce(nullif(btrim(coalesce(_part_id, '')), ''), r.part_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose the inventory part to give for this request'; END IF;
  IF coalesce(p.quantity, 0) < v_qty THEN
    RAISE EXCEPTION 'Only % in stock for %', coalesce(p.quantity, 0), p.part_id;
  END IF;

  SELECT parts_used INTO v_parts FROM public.services WHERE service_id = r.service_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket % not found', r.service_id; END IF;

  v_left := p.quantity - v_qty;
  UPDATE public.inventory_parts
     SET quantity = v_left,
         status = CASE WHEN status IN ('On Order', 'For Ordering') THEN status
                       WHEN v_left <= 0 THEN 'Out of Stock'
                       WHEN coalesce(reorder_level, 0) > 0 AND v_left <= reorder_level THEN 'Low Stock'
                       ELSE 'In Stock' END,
         updated_at = now()
   WHERE id = p.id;

  FOREACH v_line IN ARRAY coalesce(v_parts, ARRAY[]::text[]) LOOP
    IF NOT v_found AND lower(btrim(regexp_replace(v_line, '\s*\((x\s*)?\d+\)\s*$', '', 'i'))) = lower(p.part_id) THEN
      v_lines := v_lines || (p.part_id || ' (' || (coalesce((regexp_match(v_line, '\((?:x\s*)?(\d+)\)\s*$', 'i'))[1]::int, 0) + v_qty) || ')');
      v_found := true;
    ELSE
      v_lines := v_lines || v_line;
    END IF;
  END LOOP;
  IF NOT v_found THEN v_lines := v_lines || (p.part_id || ' (' || v_qty || ')'); END IF;

  UPDATE public.services
     SET parts_used = v_lines,
         parts_cost = coalesce(parts_cost, 0) + coalesce(p.cost_price, 0) * v_qty
   WHERE service_id = r.service_id;

  INSERT INTO public.part_logs (part_id, action, quantity, service_id, performed_by, performed_by_name, notes)
  VALUES (p.part_id, 'Used', v_qty, r.service_id, v_uid, v_name, 'Approved part request ' || r.request_id);

  UPDATE public.part_requests
     SET status = 'Approved',
         part_id = p.part_id,
         part_name = CASE WHEN r.part_id IS NULL THEN p.part_name ELSE coalesce(r.part_name, p.part_name) END,
         notes = CASE WHEN r.part_id IS NULL AND nullif(btrim(coalesce(r.part_name, '')), '') IS NOT NULL AND r.part_name IS DISTINCT FROM p.part_name
                      THEN concat_ws(' | ', 'Asked for: ' || r.part_name, nullif(btrim(coalesce(r.notes, '')), ''))
                      ELSE r.notes END,
         quantity = v_qty,
         approved_at = now(), approved_by = v_uid, approved_by_name = v_name,
         acknowledged_at = coalesce(acknowledged_at, now()),
         acknowledged_by_name = coalesce(acknowledged_by_name, v_name)
   WHERE id = r.id;

  INSERT INTO public.activity_logs (action, actor_id, actor_name, entity_type, entity_id, changes)
  VALUES ('Part request approved: ' || p.part_id || ' (' || v_qty || ') added to parts used', v_uid, coalesce(v_name, 'Inventory'), 'service', r.service_id,
          jsonb_build_object('role', v_role, 'Request', r.request_id, 'Part', p.part_name, 'Requested by', coalesce(r.requested_by_name, '—'),
                             'Parts', jsonb_build_object('from', coalesce(nullif(array_to_string(v_parts, ', '), ''), 'None'), 'to', array_to_string(v_lines, ', '))));

  IF r.requested_by IS NOT NULL AND r.requested_by IS DISTINCT FROM v_uid THEN
    v_link := CASE WHEN public.is_admin_or_management(r.requested_by) THEN '/manage-client?serviceId=' ELSE '/service-update?serviceId=' END || r.service_id;
    INSERT INTO public.notifications (recipient_id, recipient_name, category, title, message, link, service_id)
    VALUES (r.requested_by, r.requested_by_name, 'part_request', 'Part request approved',
            coalesce(v_name, 'Inventory') || ' approved ' || v_qty || '× ' || p.part_name || ' for ' || r.service_id || '. It''s now in the ticket''s parts used.',
            v_link, r.service_id);
  END IF;

  RETURN jsonb_build_object('service_id', r.service_id, 'part_id', p.part_id, 'quantity', v_qty, 'stock_left', v_left, 'parts_used', to_jsonb(v_lines));
END $$;

REVOKE ALL ON FUNCTION public.approve_part_request(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_part_request(uuid, text, integer) TO authenticated;
