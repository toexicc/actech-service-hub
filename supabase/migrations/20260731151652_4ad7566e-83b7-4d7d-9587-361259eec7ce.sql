ALTER TABLE public.inventory_parts ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.fast_moving_parts ADD COLUMN IF NOT EXISTS color text;

CREATE POLICY "Technicians read logs for assigned services"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'technician'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.service_id = public.activity_logs.entity_id
      AND public.is_assigned_technician(s.technicians)
  )
);