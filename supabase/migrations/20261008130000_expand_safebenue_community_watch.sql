-- Expand SafeBenue Community Watch into a moderated local early-warning workflow.
-- Existing active/resolved/false_alarm records remain valid.

ALTER TABLE public.safebenue_early_warnings
  DROP CONSTRAINT IF EXISTS safebenue_warning_status_chk;

ALTER TABLE public.safebenue_early_warnings
  ADD CONSTRAINT safebenue_warning_status_chk
  CHECK (status IN ('pending', 'active', 'resolved', 'false_alarm'));

ALTER TABLE public.safebenue_early_warnings
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderator_note text,
  ADD COLUMN IF NOT EXISTS location_accuracy_m double precision;

CREATE INDEX IF NOT EXISTS safebenue_early_warnings_location_idx
  ON public.safebenue_early_warnings (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS safebenue_early_warnings_status_created_idx
  ON public.safebenue_early_warnings (status, created_at DESC);

DROP POLICY IF EXISTS "Authors or admins can update early warnings"
  ON public.safebenue_early_warnings;

CREATE POLICY "Authors or moderators can update early warnings"
  ON public.safebenue_early_warnings FOR UPDATE TO authenticated
  USING (
    auth.uid() = author_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR (
      auth.uid() = author_id
      AND status IN ('pending', 'resolved', 'false_alarm')
      AND verified_by IS NULL
      AND verified_at IS NULL
    )
  );
