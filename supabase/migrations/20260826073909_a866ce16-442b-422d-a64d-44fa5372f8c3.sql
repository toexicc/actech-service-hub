REVOKE ALL ON FUNCTION public.submit_release_queue(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_release_queue(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.submit_release_queue(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.submit_release_queue(jsonb) TO service_role;