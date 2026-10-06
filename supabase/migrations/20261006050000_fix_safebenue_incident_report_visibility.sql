-- Allow authenticated members of an organization to read that organization's incident reports.
-- Operational mutations remain protected by their existing permission policies.
DROP POLICY IF EXISTS "organization members view incident reports" ON public.incident_reports;

CREATE POLICY "organization members view incident reports"
  ON public.incident_reports
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.is_organization_member(organization_id)
  );
