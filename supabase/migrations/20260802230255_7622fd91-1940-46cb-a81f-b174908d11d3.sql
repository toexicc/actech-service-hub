UPDATE public.services
SET model = btrim(regexp_replace(
  regexp_replace(model, '^' || regexp_replace(coalesce(device_type,''), '([().\[\]*+?^$|\\])', '\\\1', 'g') || '\s*', '', 'i'),
  '^' || regexp_replace(coalesce(brand,''), '([().\[\]*+?^$|\\])', '\\\1', 'g') || '\s*', '', 'i'))
WHERE coalesce(device_type,'') <> ''
  AND model ILIKE device_type || '%';