-- Keep incident evidence limits consistent across the client, intake function, and database.
-- Videos: 3 MiB per clip. Images: 512 KiB per file.

ALTER TABLE public.incident_report_images
  DROP CONSTRAINT IF EXISTS incident_report_images_size_bytes_check;

ALTER TABLE public.incident_report_images
  ADD CONSTRAINT incident_report_images_size_bytes_check
  CHECK (
    size_bytes > 0
    AND (
      (content_type LIKE 'video/%' AND size_bytes <= 3145728)
      OR
      (content_type NOT LIKE 'video/%' AND size_bytes <= 524288)
    )
  );
