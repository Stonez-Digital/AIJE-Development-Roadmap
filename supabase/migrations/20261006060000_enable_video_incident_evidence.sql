-- Extend the existing private incident-evidence bucket to support short video evidence.
-- Video evidence is capped at 8 MB per clip and 10 MB per report for the current intake path;
-- the current incident intake keeps request payloads bounded for reliable emergency reporting.

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/webm','video/quicktime'
    ]
WHERE id = 'incident-evidence';

ALTER TABLE public.incident_report_images
  DROP CONSTRAINT IF EXISTS incident_report_images_size_bytes_check;

ALTER TABLE public.incident_report_images
  ADD CONSTRAINT incident_report_images_size_bytes_check
  CHECK (size_bytes > 0 AND size_bytes <= 10485760);
