-- Persist citizen report evidence in a private Storage bucket and expose it only to
-- members of the incident's organization through signed URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'incident-evidence',
  'incident-evidence',
  false,
  524288,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 524288,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif'];

CREATE TABLE IF NOT EXISTS public.incident_report_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 524288),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS incident_report_images_report_idx
  ON public.incident_report_images (incident_report_id, created_at);

ALTER TABLE public.incident_report_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Incident members can view report evidence"
  ON public.incident_report_images;
CREATE POLICY "Incident members can view report evidence"
  ON public.incident_report_images
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS "Incident members can view evidence objects"
  ON storage.objects;
CREATE POLICY "Incident members can view evidence objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND public.is_organization_member(
      NULLIF((storage.foldername(name))[1], '')::uuid
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.incident_report_images FROM anon, authenticated;
GRANT SELECT ON public.incident_report_images TO authenticated;
