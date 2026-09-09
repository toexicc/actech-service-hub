ALTER FUNCTION public.delete_service_permanently(text) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.delete_service_permanently(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_service_permanently(text) TO service_role;