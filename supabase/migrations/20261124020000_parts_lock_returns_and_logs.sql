-- Parts lock, returns and parts logging (applied to the live database on 2026-11-24; this file records it).
-- Safe to run again: every statement replaces or skips what already exists.
--
-- * Parts lock from "Done Repair - Under Observation" onward. Locked tickets still take requests and returns,
--   but nobody approves their own (two-person rule), and Cancelled/RTO tickets get no new parts.
-- * Returns (part_requests.kind = 'return'): not used / wrong entry go back into stock, defective parts go on
--   the Defective list. Approving takes the part and its cost off the ticket.
-- * services_parts_guard: background (service-role) parts writes are ignored and logged; only inventory staff
--   and management change parts directly, never on a locked ticket, and only by adding.
-- * Every request/return event, approval, direct add and defective update is logged on the ticket with who did it.

-- ---------------------------------------------------------------- helpers

CREATE OR REPLACE FUNCTION public.parts_locked_status(_status text)
 RETURNS boolean LANGUAGE sql IMMUTABLE
AS $function$
  SELECT coalesce(_status, '') IN ('Done Repair - Under Observation', 'Done Repair - Observation', 'Done Repair - For Release',
                                   'Done Repair - Advise Client', 'Completed', 'Cancelled', 'RTO', 'RTO - ACTech', 'RTO - Client')
$function$;

CREATE OR REPLACE FUNCTION public.parts_no_additions_status(_status text)
 RETURNS boolean LANGUAGE sql IMMUTABLE
AS $function$
  SELECT coalesce(_status, '') IN ('Cancelled', 'RTO', 'RTO - ACTech', 'RTO - Client')
$function$;

-- "LCD-A2681-OEM (2)" -> "lcd-a2681-oem" and 2 (a line without a quantity counts as 1).
CREATE OR REPLACE FUNCTION public.part_line_id(_line text)
 RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
  SELECT lower(btrim(regexp_replace(coalesce(_line, ''), '\s*\((x\s*)?\d+\)\s*$', '', 'i')))
$function$;

CREATE OR REPLACE FUNCTION public.part_line_qty(_line text)
 RETURNS integer LANGUAGE sql IMMUTABLE
AS $function$
  SELECT coalesce((regexp_match(coalesce(_line, ''), '\((?:x\s*)?(\d+)\)\s*$', 'i'))[1]::int, 1)
$function$;

-- Name and main role (management > inventory > admin > technician) for ticket logs.
CREATE OR REPLACE FUNCTION public.actor_label(_uid uuid, OUT name text, OUT role text)
 RETURNS record LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT (SELECT p.name FROM public.profiles p WHERE p.id = _uid),
         (SELECT CASE WHEN bool_or(r.role::text = 'management') THEN 'management'
                      WHEN bool_or(r.role::text = 'inventory') THEN 'inventory'
                      WHEN bool_or(r.role::text = 'admin') THEN 'admin'
                      WHEN bool_or(r.role::text = 'technician') THEN 'technician'
                      ELSE min(r.role::text) END
            FROM public.user_roles r WHERE r.user_id = _uid)
$function$;

-- ---------------------------------------------------------------- part_requests: returns and defective parts

ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'request';
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS return_reason text;
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS after_lock boolean NOT NULL DEFAULT false;
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS defect_status text;
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS defect_note text;
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS defect_updated_at timestamp with time zone;
ALTER TABLE public.part_requests ADD COLUMN IF NOT EXISTS defect_updated_by_name text;

ALTER TABLE public.part_requests DROP CONSTRAINT IF EXISTS part_requests_kind_check;
ALTER TABLE public.part_requests ADD CONSTRAINT part_requests_kind_check CHECK (kind = ANY (ARRAY['request'::text, 'return'::text]));
ALTER TABLE public.part_requests DROP CONSTRAINT IF EXISTS part_requests_return_reason_check;
ALTER TABLE public.part_requests ADD CONSTRAINT part_requests_return_reason_check
  CHECK (return_reason IS NULL OR return_reason = ANY (ARRAY['unused'::text, 'wrong_entry'::text, 'defective'::text]));
ALTER TABLE public.part_requests DROP CONSTRAINT IF EXISTS part_requests_defect_status_check;
ALTER TABLE public.part_requests ADD CONSTRAINT part_requests_defect_status_check
  CHECK (defect_status IS NULL OR defect_status = ANY (ARRAY['Waiting to send'::text, 'Sent to supplier'::text, 'Replaced'::text, 'Credited'::text, 'Disposed'::text]));

-- Staff add requests in their own name; inventory/management change any request, the requester can only cancel theirs.
DROP POLICY IF EXISTS "Auth write part requests" ON public.part_requests;
DROP POLICY IF EXISTS "Staff add own part requests" ON public.part_requests;
CREATE POLICY "Staff add own part requests" ON public.part_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());
DROP POLICY IF EXISTS "Inventory or requester update part requests" ON public.part_requests;
CREATE POLICY "Inventory or requester update part requests" ON public.part_requests FOR UPDATE TO authenticated
  USING (has_inventory_access(auth.uid()) OR requested_by = auth.uid())
  WITH CHECK (has_inventory_access(auth.uid()) OR requested_by = auth.uid());

-- Only inventory staff and management write the parts list (stock changes go through them or approvals).
DROP POLICY IF EXISTS "Mgmt write inventory" ON public.inventory_parts;
CREATE POLICY "Mgmt write inventory" ON public.inventory_parts FOR ALL TO authenticated
  USING (is_admin_or_management(auth.uid()) OR has_inventory_access(auth.uid()))
  WITH CHECK (is_admin_or_management(auth.uid()) OR has_inventory_access(auth.uid()));

-- ---------------------------------------------------------------- guard on a ticket's parts

CREATE OR REPLACE FUNCTION public.services_parts_guard()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  a record;
  v_line text;
  v_key text;
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_names jsonb := '{}'::jsonb;
  v_added text[] := ARRAY[]::text[];
  v_diff int;
BEGIN
  IF NEW.parts_used IS NOT DISTINCT FROM OLD.parts_used THEN RETURN NEW; END IF;
  -- Approved requests and returns (approve_part_request / approve_part_return) log themselves.
  IF coalesce(current_setting('app.parts_change', true), '') = 'approved' THEN RETURN NEW; END IF;

  IF v_uid IS NULL THEN
    INSERT INTO public.activity_logs (action, actor_id, actor_name, entity_type, entity_id, changes)
    VALUES ('Parts change from a background save was ignored (parts change only through requests, returns or Assign to Ticket)',
            NULL, 'System (parts guard)', 'service', OLD.service_id,
            jsonb_build_object('role', 'system',
                               'Parts kept', coalesce(nullif(array_to_string(OLD.parts_used, ', '), ''), 'None'),
                               'Attempted', coalesce(nullif(array_to_string(NEW.parts_used, ', '), ''), 'None')));
    NEW.parts_used := OLD.parts_used;
    NEW.parts_cost := OLD.parts_cost;
    RETURN NEW;
  END IF;

  IF public.parts_locked_status(OLD.status::text) THEN
    RAISE EXCEPTION 'Parts are locked on % (%). Request or return parts from the ticket; inventory staff or management approve the change.',
      OLD.service_id, OLD.status USING ERRCODE = 'check_violation';
  END IF;
  IF NOT public.has_inventory_access(v_uid) THEN
    RAISE EXCEPTION 'Only inventory staff or management can change a ticket''s parts directly. Request or return parts from the ticket instead.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Direct changes (Assign to Ticket) only add parts. Taking a part off goes through an approved return,
  -- which records the reason, who asked and who approved.
  FOREACH v_line IN ARRAY coalesce(OLD.parts_used, ARRAY[]::text[]) LOOP
    v_key := public.part_line_id(v_line);
    IF v_key <> '' THEN
      v_old := v_old || jsonb_build_object(v_key, coalesce((v_old->>v_key)::int, 0) + public.part_line_qty(v_line));
      v_names := v_names || jsonb_build_object(v_key, btrim(regexp_replace(v_line, '\s*\((x\s*)?\d+\)\s*$', '', 'i')));
    END IF;
  END LOOP;
  FOREACH v_line IN ARRAY coalesce(NEW.parts_used, ARRAY[]::text[]) LOOP
    v_key := public.part_line_id(v_line);
    IF v_key <> '' THEN
      v_new := v_new || jsonb_build_object(v_key, coalesce((v_new->>v_key)::int, 0) + public.part_line_qty(v_line));
      IF NOT v_names ? v_key THEN
        v_names := v_names || jsonb_build_object(v_key, btrim(regexp_replace(v_line, '\s*\((x\s*)?\d+\)\s*$', '', 'i')));
      END IF;
    END IF;
  END LOOP;
  FOR v_key IN SELECT jsonb_object_keys(v_old) LOOP
    IF coalesce((v_new->>v_key)::int, 0) < (v_old->>v_key)::int THEN
      RAISE EXCEPTION 'Parts can only be added here. To take % off %, use Return in the ticket''s Parts section (it records the reason and who approved it).',
        v_names->>v_key, OLD.service_id USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  FOR v_key IN SELECT jsonb_object_keys(v_new) ORDER BY 1 LOOP
    v_diff := (v_new->>v_key)::int - coalesce((v_old->>v_key)::int, 0);
    IF v_diff > 0 THEN v_added := v_added || ((v_names->>v_key) || ' (+' || v_diff || ')'); END IF;
  END LOOP;

  IF array_length(v_added, 1) > 0 THEN
    SELECT * INTO a FROM public.actor_label(v_uid);
    INSERT INTO public.activity_logs (action, actor_id, actor_name, entity_type, entity_id, changes)
    VALUES ('Parts added directly (Assign to Ticket): ' || array_to_string(v_added, ', ') || '. Added by ' || coalesce(a.name, '—'),
            v_uid, coalesce(a.name, 'Inventory'), 'service', OLD.service_id,
            jsonb_build_object('role', coalesce(a.role, 'inventory'), 'Added by', coalesce(a.name, '—'),
                               'Parts', jsonb_build_object('from', coalesce(nullif(array_to_string(OLD.parts_used, ', '), ''), 'None'),
                                                           'to', coalesce(nullif(array_to_string(NEW.parts_used, ', '), ''), 'None')))
            || CASE WHEN NEW.parts_cost IS DISTINCT FROM OLD.parts_cost
                    THEN jsonb_build_object('Parts cost', jsonb_build_object('from', coalesce(OLD.parts_cost, 0), 'to', coalesce(NEW.parts_cost, 0)))
                    ELSE '{}'::jsonb END);
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS services_parts_guard ON public.services;
CREATE TRIGGER services_parts_guard BEFORE UPDATE OF parts_used ON public.services
  FOR EACH ROW EXECUTE FUNCTION services_parts_guard();

-- ---------------------------------------------------------------- request / return checks and ticket log

CREATE OR REPLACE FUNCTION public.part_requests_before_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_status text; v_parts text[]; v_line text; v_on int := 0; v_pending int := 0;
BEGIN
  NEW.kind := coalesce(NEW.kind, 'request');
  IF nullif(btrim(coalesce(NEW.service_id, '')), '') IS NULL THEN
    IF NEW.kind = 'return' THEN RAISE EXCEPTION 'A return needs a ticket'; END IF;
    RETURN NEW;
  END IF;
  SELECT status::text, parts_used INTO v_status, v_parts FROM public.services WHERE service_id = NEW.service_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket % not found', NEW.service_id; END IF;
  NEW.after_lock := public.parts_locked_status(v_status);

  IF NEW.kind = 'request' THEN
    NEW.return_reason := NULL;
    IF public.parts_no_additions_status(v_status) THEN
      RAISE EXCEPTION 'Ticket % is %, so parts can''t be added. You can still return parts.', NEW.service_id, v_status;
    END IF;
  ELSE
    IF nullif(btrim(coalesce(NEW.part_id, '')), '') IS NULL THEN RAISE EXCEPTION 'Pick the part to return'; END IF;
    IF NEW.return_reason IS NULL THEN RAISE EXCEPTION 'Pick why the part is being returned'; END IF;
    IF NEW.return_reason = 'defective' AND nullif(btrim(coalesce(NEW.notes, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Say what''s wrong with the defective part';
    END IF;
    FOREACH v_line IN ARRAY coalesce(v_parts, ARRAY[]::text[]) LOOP
      IF public.part_line_id(v_line) = lower(NEW.part_id) THEN v_on := v_on + public.part_line_qty(v_line); END IF;
    END LOOP;
    SELECT coalesce(sum(quantity), 0) INTO v_pending FROM public.part_requests
     WHERE service_id = NEW.service_id AND kind = 'return' AND lower(part_id) = lower(NEW.part_id)
       AND status NOT IN ('Approved', 'Released to technician', 'Cancelled');
    IF NEW.quantity > v_on - v_pending THEN
      RAISE EXCEPTION 'Only % of % can be returned from % (% on the ticket, % already waiting to be returned)',
        greatest(v_on - v_pending, 0), NEW.part_id, NEW.service_id, v_on, v_pending;
    END IF;
    NEW.status := 'Requested';
  END IF;
  RETURN NEW;
END $function$;

-- Requesters can only cancel their own waiting request; nothing else about it changes.
CREATE OR REPLACE FUNCTION public.part_requests_before_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR public.has_inventory_access(v_uid) THEN RETURN NEW; END IF;
  IF OLD.requested_by IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Only inventory staff or management can change someone else''s request';
  END IF;
  IF OLD.status IN ('Approved', 'Released to technician', 'Cancelled') OR NEW.status IS DISTINCT FROM 'Cancelled' THEN
    RAISE EXCEPTION 'You can cancel your request while it''s waiting; anything else is done by inventory staff or management';
  END IF;
  NEW.kind := OLD.kind; NEW.return_reason := OLD.return_reason; NEW.part_id := OLD.part_id; NEW.part_name := OLD.part_name;
  NEW.quantity := OLD.quantity; NEW.service_id := OLD.service_id; NEW.requested_by := OLD.requested_by;
  NEW.requested_by_name := OLD.requested_by_name; NEW.notes := OLD.notes; NEW.after_lock := OLD.after_lock;
  NEW.approved_at := OLD.approved_at; NEW.approved_by := OLD.approved_by; NEW.approved_by_name := OLD.approved_by_name;
  NEW.defect_status := OLD.defect_status; NEW.defect_note := OLD.defect_note;
  NEW.cancelled_at := coalesce(NEW.cancelled_at, now());
  RETURN NEW;
END $function$;

-- Ticket log for every request/return event (approvals are logged by the approve functions).
CREATE OR REPLACE FUNCTION public.part_requests_log()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); a record; v_what text; v_kind text; v_reason text; v_action text; v_changes jsonb;
BEGIN
  IF nullif(btrim(coalesce(NEW.service_id, '')), '') IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO a FROM public.actor_label(v_uid);
  v_kind := CASE WHEN NEW.kind = 'return' THEN 'return' ELSE 'request' END;
  v_what := NEW.quantity || '× ' || coalesce(NEW.part_name, NEW.part_id, 'part')
            || CASE WHEN NEW.part_id IS NOT NULL AND NEW.part_name IS NOT NULL AND NEW.part_name <> NEW.part_id THEN ' (' || NEW.part_id || ')' ELSE '' END;
  v_reason := CASE NEW.return_reason WHEN 'unused' THEN 'Not used' WHEN 'wrong_entry' THEN 'Wrong entry' WHEN 'defective' THEN 'Defective' END;

  IF TG_OP = 'INSERT' THEN
    v_action := CASE WHEN NEW.kind = 'return' THEN 'Part return requested: ' || v_what || ' · ' || v_reason
                     ELSE 'Part requested: ' || v_what END
                || CASE WHEN NEW.after_lock THEN ' (after the repair was done)' ELSE '' END;
    v_changes := jsonb_build_object('Request', NEW.request_id, 'Status', NEW.status)
                 || CASE WHEN nullif(btrim(coalesce(NEW.notes, '')), '') IS NOT NULL THEN jsonb_build_object('Note', NEW.notes) ELSE '{}'::jsonb END;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('Approved') THEN
    IF NEW.status = 'Cancelled' THEN
      v_action := 'Part ' || v_kind || CASE WHEN v_uid IS NOT NULL AND v_uid = NEW.requested_by THEN ' cancelled by the requester: ' ELSE ' declined: ' END || v_what;
      v_changes := jsonb_build_object('Request', NEW.request_id, 'Reason', coalesce(NEW.cancelled_reason, '—'),
                                      'Requested by', coalesce(NEW.requested_by_name, '—'));
    ELSE
      v_action := 'Part ' || v_kind || ' ' || NEW.request_id || ' set to ' || NEW.status || ': ' || v_what;
      v_changes := jsonb_build_object('Status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
    END IF;
  ELSIF NEW.acknowledged_at IS NOT NULL AND OLD.acknowledged_at IS NULL AND NEW.status = OLD.status THEN
    v_action := 'Part ' || v_kind || ' marked as seen: ' || v_what;
    v_changes := jsonb_build_object('Request', NEW.request_id);
  ELSIF (NEW.defect_status IS DISTINCT FROM OLD.defect_status OR NEW.defect_note IS DISTINCT FROM OLD.defect_note) AND OLD.defect_status IS NOT NULL THEN
    v_action := 'Defective part ' || coalesce(NEW.part_id, NEW.part_name, 'part') || ': '
                || CASE WHEN NEW.defect_status IS DISTINCT FROM OLD.defect_status THEN coalesce(NEW.defect_status, '—') ELSE 'note updated' END;
    v_changes := jsonb_build_object('Request', NEW.request_id, 'Defective part', jsonb_build_object('from', OLD.defect_status, 'to', NEW.defect_status))
                 || CASE WHEN nullif(btrim(coalesce(NEW.defect_note, '')), '') IS NOT NULL THEN jsonb_build_object('Note', NEW.defect_note) ELSE '{}'::jsonb END;
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO public.activity_logs (action, actor_id, actor_name, entity_type, entity_id, changes)
  VALUES (v_action, v_uid, coalesce(a.name, 'System'), 'service', NEW.service_id, jsonb_build_object('role', coalesce(a.role, 'system')) || v_changes);
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS part_requests_before_insert ON public.part_requests;
CREATE TRIGGER part_requests_before_insert BEFORE INSERT ON public.part_requests
  FOR EACH ROW EXECUTE FUNCTION part_requests_before_insert();
DROP TRIGGER IF EXISTS part_requests_before_update ON public.part_requests;
CREATE TRIGGER part_requests_before_update BEFORE UPDATE ON public.part_requests
  FOR EACH ROW EXECUTE FUNCTION part_requests_before_update();
DROP TRIGGER IF EXISTS part_requests_log ON public.part_requests;
CREATE TRIGGER part_requests_log AFTER INSERT OR UPDATE ON public.part_requests
  FOR EACH ROW EXECUTE FUNCTION part_requests_log();

-- Inventory staff hear about new requests and returns.
CREATE OR REPLACE FUNCTION public.part_request_alert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kind = 'return' THEN
    PERFORM public.notify_inventory_staff('Part return to approve',
      coalesce(NEW.requested_by_name, 'A technician') || ' wants to return ' || coalesce(NEW.quantity, 1) || '× ' || coalesce(NEW.part_name, NEW.part_id, 'a part')
        || ' from ' || coalesce(NEW.service_id, 'a ticket') || ' ('
        || CASE NEW.return_reason WHEN 'unused' THEN 'not used' WHEN 'wrong_entry' THEN 'wrong entry' ELSE 'defective' END || ')',
      '/inventory-management?tab=requests', NEW.service_id, true, NEW.requested_by);
  ELSE
    PERFORM public.notify_inventory_staff('New part request',
      coalesce(NEW.requested_by_name, 'A technician') || ' requested ' || coalesce(NEW.quantity, 1) || '× ' || coalesce(NEW.part_name, NEW.part_id, 'a part')
        || CASE WHEN NEW.service_id IS NOT NULL THEN ' for ' || NEW.service_id ELSE '' END
        || CASE WHEN NEW.status = 'For Ordering' THEN ' (needs ordering)' ELSE '' END
        || CASE WHEN NEW.after_lock THEN ' (after the repair was done)' ELSE '' END,
      '/inventory-management?tab=requests', NEW.service_id, true, NEW.requested_by);
  END IF;
  RETURN NULL;
END $function$;

-- ---------------------------------------------------------------- approvals

CREATE OR REPLACE FUNCTION public.approve_part_request(_id uuid, _part_id text DEFAULT NULL::text, _quantity integer DEFAULT NULL::integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  a record;
  r public.part_requests%ROWTYPE;
  p public.inventory_parts%ROWTYPE;
  v_status text;
  v_locked boolean;
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
  SELECT * INTO a FROM public.actor_label(v_uid);

  SELECT * INTO r FROM public.part_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Part request not found'; END IF;
  IF r.kind = 'return' THEN RAISE EXCEPTION 'This is a return. Approve it as a return.'; END IF;
  IF r.status IN ('Approved', 'Released to technician', 'Cancelled') THEN
    RAISE EXCEPTION 'This request is already %', lower(r.status);
  END IF;
  IF nullif(btrim(coalesce(r.service_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'This request is not linked to a ticket';
  END IF;

  SELECT status::text, parts_used INTO v_status, v_parts FROM public.services WHERE service_id = r.service_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket % not found', r.service_id; END IF;
  IF public.parts_no_additions_status(v_status) THEN
    RAISE EXCEPTION 'Ticket % is %, so parts can''t be added', r.service_id, v_status;
  END IF;
  v_locked := public.parts_locked_status(v_status);
  IF v_locked AND r.requested_by = v_uid THEN
    RAISE EXCEPTION 'Parts on % are locked (%), so someone else has to approve your own request', r.service_id, v_status;
  END IF;

  v_qty := coalesce(_quantity, r.quantity, 1);
  IF v_qty < 1 THEN RAISE EXCEPTION 'Quantity must be at least 1'; END IF;

  SELECT * INTO p FROM public.inventory_parts
   WHERE part_id = coalesce(nullif(btrim(coalesce(_part_id, '')), ''), r.part_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose the inventory part to give for this request'; END IF;
  IF coalesce(p.quantity, 0) < v_qty THEN
    RAISE EXCEPTION 'Only % in stock for %', coalesce(p.quantity, 0), p.part_id;
  END IF;

  -- 1) Take the stock. The stock movement trigger records it under the approver, already approved.
  v_left := p.quantity - v_qty;
  UPDATE public.inventory_parts
     SET quantity = v_left,
         status = CASE WHEN status IN ('On Order', 'For Ordering') THEN status
                       WHEN v_left <= 0 THEN 'Out of Stock'
                       WHEN coalesce(reorder_level, 0) > 0 AND v_left <= reorder_level THEN 'Low Stock'
                       ELSE 'In Stock' END,
         updated_at = now()
   WHERE id = p.id;

  -- 2) Add it to the ticket's parts as "PART-ID (qty)", adding to an existing line for the same part.
  FOREACH v_line IN ARRAY coalesce(v_parts, ARRAY[]::text[]) LOOP
    IF NOT v_found AND public.part_line_id(v_line) = lower(p.part_id) THEN
      v_lines := v_lines || (p.part_id || ' (' || (public.part_line_qty(v_line) + v_qty) || ')');
      v_found := true;
    ELSE
      v_lines := v_lines || v_line;
    END IF;
  END LOOP;
  IF NOT v_found THEN v_lines := v_lines || (p.part_id || ' (' || v_qty || ')'); END IF;

  PERFORM set_config('app.parts_change', 'approved', true);
  UPDATE public.services
     SET parts_used = v_lines,
         parts_cost = coalesce(parts_cost, 0) + coalesce(p.cost_price, 0) * v_qty
   WHERE service_id = r.service_id;
  PERFORM set_config('app.parts_change', '', true);

  -- 3) Part log; its trigger links the stock movement to the ticket.
  INSERT INTO public.part_logs (part_id, action, quantity, service_id, performed_by, performed_by_name, notes)
  VALUES (p.part_id, 'Used', v_qty, r.service_id, v_uid, a.name, 'Approved part request ' || r.request_id);

  -- 4) Close the request.
  UPDATE public.part_requests
     SET status = 'Approved',
         part_id = p.part_id,
         part_name = CASE WHEN r.part_id IS NULL THEN p.part_name ELSE coalesce(r.part_name, p.part_name) END,
         notes = CASE WHEN r.part_id IS NULL AND nullif(btrim(coalesce(r.part_name, '')), '') IS NOT NULL AND r.part_name IS DISTINCT FROM p.part_name
                      THEN concat_ws(' | ', 'Asked for: ' || r.part_name, nullif(btrim(coalesce(r.notes, '')), ''))
                      ELSE r.notes END,
         quantity = v_qty,
         approved_at = now(), approved_by = v_uid, approved_by_name = a.name,
         acknowledged_at = coalesce(acknowledged_at, now()),
         acknowledged_by_name = coalesce(acknowledged_by_name, a.name)
   WHERE id = r.id;

  -- 5) Ticket log (who asked, who approved), and tell the requester.
  INSERT INTO public.activity_logs (action, actor_id, actor_name, entity_type, entity_id, changes)
  VALUES ('Part request approved: ' || p.part_id || ' (' || v_qty || ') added to parts used. Requested by '
            || coalesce(r.requested_by_name, '—') || ', approved by ' || coalesce(a.name, '—')
            || CASE WHEN v_locked THEN ' (after the repair was done)' ELSE '' END,
          v_uid, coalesce(a.name, 'Inventory'), 'service', r.service_id,
          jsonb_build_object('role', coalesce(a.role, 'inventory'), 'Request', r.request_id, 'Part', p.part_name,
                             'Requested by', coalesce(r.requested_by_name, '—'), 'Approved by', coalesce(a.name, '—'),
                             'Parts', jsonb_build_object('from', coalesce(nullif(array_to_string(v_parts, ', '), ''), 'None'), 'to', array_to_string(v_lines, ', '))));

  IF r.requested_by IS NOT NULL AND r.requested_by IS DISTINCT FROM v_uid THEN
    v_link := CASE WHEN public.is_admin_or_management(r.requested_by) THEN '/manage-client?serviceId=' ELSE '/service-update?serviceId=' END || r.service_id;
    INSERT INTO public.notifications (recipient_id, recipient_name, category, title, message, link, service_id)
    VALUES (r.requested_by, r.requested_by_name, 'part_request', 'Part request approved',
            coalesce(a.name, 'Inventory') || ' approved ' || v_qty || '× ' || p.part_name || ' for ' || r.service_id || '. It''s now in the ticket''s parts used.',
            v_link, r.service_id);
  END IF;

  RETURN jsonb_build_object('service_id', r.service_id, 'part_id', p.part_id, 'quantity', v_qty, 'stock_left', v_left, 'parts_used', to_jsonb(v_lines));
END $function$;

CREATE OR REPLACE FUNCTION public.approve_part_return(_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  a record;
  r public.part_requests%ROWTYPE;
  p public.inventory_parts%ROWTYPE;
  v_has_part boolean;
  v_status text;
  v_locked boolean;
  v_parts text[];
  v_lines text[] := ARRAY[]::text[];
  v_line text;
  v_on int := 0;
  v_to_remove int;
  v_q int;
  v_cost numeric := 0;
  v_stock_after int;
  v_reason text;
  v_link text;
BEGIN
  IF v_uid IS NULL OR NOT public.has_inventory_access(v_uid) THEN
    RAISE EXCEPTION 'Only inventory staff or management can approve returns';
  END IF;
  SELECT * INTO a FROM public.actor_label(v_uid);

  SELECT * INTO r FROM public.part_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Return not found'; END IF;
  IF r.kind IS DISTINCT FROM 'return' THEN RAISE EXCEPTION 'This is a part request, not a return'; END IF;
  IF r.status IN ('Approved', 'Released to technician', 'Cancelled') THEN RAISE EXCEPTION 'This return is already %', lower(r.status); END IF;

  SELECT status::text, parts_used INTO v_status, v_parts FROM public.services WHERE service_id = r.service_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Ticket % not found', r.service_id; END IF;
  v_locked := public.parts_locked_status(v_status);
  IF v_locked AND r.requested_by = v_uid THEN
    RAISE EXCEPTION 'Parts on % are locked (%), so someone else has to approve your own return', r.service_id, v_status;
  END IF;

  FOREACH v_line IN ARRAY coalesce(v_parts, ARRAY[]::text[]) LOOP
    IF public.part_line_id(v_line) = lower(r.part_id) THEN v_on := v_on + public.part_line_qty(v_line); END IF;
  END LOOP;
  IF v_on < r.quantity THEN RAISE EXCEPTION 'Only % of % is on %', v_on, r.part_id, r.service_id; END IF;

  -- Take the quantity off the ticket's matching line(s).
  v_to_remove := r.quantity;
  FOREACH v_line IN ARRAY coalesce(v_parts, ARRAY[]::text[]) LOOP
    IF v_to_remove > 0 AND public.part_line_id(v_line) = lower(r.part_id) THEN
      v_q := public.part_line_qty(v_line);
      IF v_q > v_to_remove THEN
        v_lines := v_lines || (btrim(regexp_replace(v_line, '\s*\((x\s*)?\d+\)\s*$', '', 'i')) || ' (' || (v_q - v_to_remove) || ')');
        v_to_remove := 0;
      ELSE
        v_to_remove := v_to_remove - v_q;
      END IF;
    ELSE
      v_lines := v_lines || v_line;
    END IF;
  END LOOP;

  SELECT * INTO p FROM public.inventory_parts WHERE lower(part_id) = lower(r.part_id) FOR UPDATE;
  v_has_part := FOUND;
  v_cost := CASE WHEN v_has_part THEN coalesce(p.cost_price, 0) * r.quantity ELSE 0 END;
  v_reason := CASE r.return_reason WHEN 'unused' THEN 'Not used' WHEN 'wrong_entry' THEN 'Wrong entry' ELSE 'Defective' END;

  PERFORM set_config('app.parts_change', 'approved', true);
  UPDATE public.services
     SET parts_used = v_lines, parts_cost = greatest(coalesce(parts_cost, 0) - v_cost, 0)
   WHERE service_id = r.service_id;
  PERFORM set_config('app.parts_change', '', true);

  IF r.return_reason IN ('unused', 'wrong_entry') AND v_has_part THEN
    v_stock_after := coalesce(p.quantity, 0) + r.quantity;
    UPDATE public.inventory_parts
       SET quantity = v_stock_after,
           status = CASE WHEN status IN ('On Order', 'For Ordering') THEN status
                         WHEN v_stock_after <= 0 THEN 'Out of Stock'
                         WHEN coalesce(reorder_level, 0) > 0 AND v_stock_after <= reorder_level THEN 'Low Stock'
                         ELSE 'In Stock' END,
           updated_at = now()
     WHERE id = p.id;
    INSERT INTO public.part_logs (part_id, action, quantity, service_id, performed_by, performed_by_name, notes)
    VALUES (p.part_id, 'Returned', r.quantity, r.service_id, v_uid, a.name,
            'Approved return ' || r.request_id || ' (' || v_reason || '), requested by ' || coalesce(r.requested_by_name, '—'));
  ELSE
    INSERT INTO public.part_logs (part_id, action, quantity, service_id, performed_by, performed_by_name, notes)
    VALUES (coalesce(p.part_id, r.part_id), CASE WHEN r.return_reason = 'defective' THEN 'Defective' ELSE 'Returned' END, r.quantity, r.service_id, v_uid, a.name,
            'Approved return ' || r.request_id || ' (' || v_reason || ', stock not changed), requested by ' || coalesce(r.requested_by_name, '—'));
  END IF;

  UPDATE public.part_requests
     SET status = 'Approved', approved_at = now(), approved_by = v_uid, approved_by_name = a.name,
         acknowledged_at = coalesce(acknowledged_at, now()), acknowledged_by_name = coalesce(acknowledged_by_name, a.name),
         defect_status = CASE WHEN r.return_reason = 'defective' THEN 'Waiting to send' END,
         defect_updated_at = CASE WHEN r.return_reason = 'defective' THEN now() END,
         defect_updated_by_name = CASE WHEN r.return_reason = 'defective' THEN a.name END
   WHERE id = r.id;

  INSERT INTO public.activity_logs (action, actor_id, actor_name, entity_type, entity_id, changes)
  VALUES ('Part return approved: ' || r.part_id || ' (' || r.quantity || ') taken off the ticket · ' || v_reason
            || CASE WHEN r.return_reason = 'defective' THEN ' (set aside for the supplier, stock not changed)'
                    WHEN v_has_part THEN ' (back in stock)' ELSE ' (not in the parts list, stock not changed)' END
            || '. Requested by ' || coalesce(r.requested_by_name, '—') || ', approved by ' || coalesce(a.name, '—'),
          v_uid, coalesce(a.name, 'Inventory'), 'service', r.service_id,
          jsonb_build_object('role', coalesce(a.role, 'inventory'), 'Request', r.request_id, 'Reason', v_reason,
                             'Requested by', coalesce(r.requested_by_name, '—'), 'Approved by', coalesce(a.name, '—'),
                             'Parts', jsonb_build_object('from', coalesce(nullif(array_to_string(v_parts, ', '), ''), 'None'),
                                                         'to', coalesce(nullif(array_to_string(v_lines, ', '), ''), 'None')))
          || CASE WHEN nullif(btrim(coalesce(r.notes, '')), '') IS NOT NULL THEN jsonb_build_object('Note', r.notes) ELSE '{}'::jsonb END
          || CASE WHEN v_cost > 0 THEN jsonb_build_object('Parts cost', '-' || v_cost) ELSE '{}'::jsonb END);

  IF r.requested_by IS NOT NULL AND r.requested_by IS DISTINCT FROM v_uid THEN
    v_link := CASE WHEN public.is_admin_or_management(r.requested_by) THEN '/manage-client?serviceId=' ELSE '/service-update?serviceId=' END || r.service_id;
    INSERT INTO public.notifications (recipient_id, recipient_name, category, title, message, link, service_id)
    VALUES (r.requested_by, r.requested_by_name, 'part_request', 'Part return approved',
            coalesce(a.name, 'Inventory') || ' approved your return of ' || r.quantity || '× ' || coalesce(r.part_name, r.part_id)
              || ' from ' || r.service_id || ' (' || v_reason || ').', v_link, r.service_id);
  END IF;

  RETURN jsonb_build_object('service_id', r.service_id, 'part_id', r.part_id, 'quantity', r.quantity, 'reason', r.return_reason,
                            'stock_after', v_stock_after, 'parts_used', to_jsonb(v_lines));
END $function$;

-- Defective list: where the part is with the supplier (logged on the ticket by part_requests_log).
CREATE OR REPLACE FUNCTION public.set_defect_status(_id uuid, _status text, _note text DEFAULT NULL::text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); a record;
BEGIN
  IF v_uid IS NULL OR NOT public.has_inventory_access(v_uid) THEN
    RAISE EXCEPTION 'Only inventory staff or management can update defective parts';
  END IF;
  IF _status NOT IN ('Waiting to send', 'Sent to supplier', 'Replaced', 'Credited', 'Disposed') THEN
    RAISE EXCEPTION 'Unknown status %', _status;
  END IF;
  SELECT * INTO a FROM public.actor_label(v_uid);
  UPDATE public.part_requests
     SET defect_status = _status,
         defect_note = coalesce(nullif(btrim(coalesce(_note, '')), ''), defect_note),
         defect_updated_at = now(), defect_updated_by_name = a.name
   WHERE id = _id AND kind = 'return' AND return_reason = 'defective' AND status = 'Approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Defective part not found'; END IF;
END $function$;

-- ---------------------------------------------------------------- stock movements

-- Link a part log to the matching stock movement (same part, last 2 minutes). Defective returns change no stock.
CREATE OR REPLACE FUNCTION public.stock_movement_link_service()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF nullif(btrim(coalesce(NEW.service_id, '')), '') IS NULL OR NEW.part_id IS NULL OR NEW.action = 'Defective' THEN RETURN NULL; END IF;
  UPDATE public.stock_movements SET service_id = NEW.service_id, notes = coalesce(notes, NEW.notes)
  WHERE id = (SELECT id FROM public.stock_movements WHERE part_id = NEW.part_id AND service_id IS NULL
              AND created_at > now() - interval '2 minutes' ORDER BY created_at DESC LIMIT 1);
  RETURN NULL;
END $function$;

-- Approve or reject pending stock changes; a change tied to a ticket is also logged on that ticket.
CREATE OR REPLACE FUNCTION public.review_stock_movement(_ids uuid[], _approve boolean, _reason text DEFAULT NULL::text)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid(); a record; m record; n int := 0;
BEGIN
  IF v_uid IS NULL OR NOT public.has_inventory_access(v_uid) THEN RAISE EXCEPTION 'Only inventory staff or management can review stock movements'; END IF;
  IF NOT _approve AND nullif(btrim(coalesce(_reason, '')), '') IS NULL THEN RAISE EXCEPTION 'A reason is required to reject'; END IF;
  SELECT * INTO a FROM public.actor_label(v_uid);
  FOR m IN SELECT * FROM public.stock_movements WHERE id = ANY(_ids) AND status = 'pending' LOOP
    IF NOT _approve AND m.movement_type IN ('stock_in', 'stock_out') THEN
      PERFORM set_config('app.skip_movement', 'on', true);
      IF m.part_source = 'fast_moving' THEN
        UPDATE public.fast_moving_parts SET quantity = greatest(0, quantity - m.delta) WHERE part_id = m.part_id;
      ELSE
        UPDATE public.inventory_parts SET quantity = greatest(0, quantity - m.delta) WHERE part_id = m.part_id;
      END IF;
      PERFORM set_config('app.skip_movement', 'off', true);
    END IF;
    UPDATE public.stock_movements SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_uid, reviewed_by_name = a.name, reviewed_at = now(), review_reason = nullif(btrim(coalesce(_reason, '')), '')
    WHERE id = m.id;
    IF NOT _approve AND m.actor_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, recipient_name, category, title, message, link, service_id)
      VALUES (m.actor_id, m.actor_name, 'part_request', 'Stock change rejected',
        coalesce(a.name, 'Inventory') || ' rejected your change to ' || coalesce(m.part_name, m.part_id) || ': ' || _reason
          || CASE WHEN m.movement_type IN ('stock_in', 'stock_out') THEN ' (stock restored to ' || m.quantity_before || ')' ELSE '' END,
        '/inventory-management?tab=movements', m.service_id);
    END IF;
    IF m.service_id IS NOT NULL THEN
      INSERT INTO public.activity_logs (action, actor_id, actor_name, entity_type, entity_id, changes)
      VALUES ('Stock change on this ticket ' || CASE WHEN _approve THEN 'approved' ELSE 'rejected' END || ': '
                || coalesce(m.part_name, m.part_id) || ' (' || CASE WHEN m.delta > 0 THEN '+' ELSE '' END || m.delta || ') by ' || coalesce(m.actor_name, '—'),
              v_uid, coalesce(a.name, 'Inventory'), 'service', m.service_id,
              jsonb_build_object('role', coalesce(a.role, 'inventory'), 'Part', coalesce(m.part_id, '—'), 'Changed by', coalesce(m.actor_name, '—'),
                                 'Stock', jsonb_build_object('from', m.quantity_before, 'to', m.quantity_after))
              || CASE WHEN NOT _approve THEN jsonb_build_object('Reason', _reason) ELSE '{}'::jsonb END);
    END IF;
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$;
