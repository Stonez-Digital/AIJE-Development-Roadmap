-- Do not expose the SECURITY DEFINER management helper to anonymous callers.
-- The helper is only needed by authenticated RLS policies.
REVOKE ALL ON FUNCTION public.can_manage_public_information() FROM anon;
GRANT EXECUTE ON FUNCTION public.can_manage_public_information() TO authenticated;
