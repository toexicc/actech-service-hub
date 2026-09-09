ALTER TABLE public.attendance_logs
  ADD COLUMN IF NOT EXISTS overtime_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS overtime_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS overtime_reviewed_at timestamp with time zone;

UPDATE public.attendance_logs
SET overtime_status = 'pending'
WHERE is_overtime = true AND overtime_status = 'none';

CREATE OR REPLACE FUNCTION public.attendance_guard_overtime_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF (NEW.overtime_status IS DISTINCT FROM OLD.overtime_status
      OR NEW.overtime_reviewed_by IS DISTINCT FROM OLD.overtime_reviewed_by
      OR NEW.overtime_reviewed_at IS DISTINCT FROM OLD.overtime_reviewed_at)
     AND NOT public.is_admin_or_management(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins or management can review overtime';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_logs_overtime_review_guard ON public.attendance_logs;
CREATE TRIGGER attendance_logs_overtime_review_guard
BEFORE UPDATE ON public.attendance_logs
FOR EACH ROW EXECUTE FUNCTION public.attendance_guard_overtime_review();