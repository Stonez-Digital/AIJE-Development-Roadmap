-- Emergency Communication & Public Information Center
-- Public readers can only see published, currently active announcements.
-- Publishing and management are restricted by database-level RBAC.

CREATE TABLE IF NOT EXISTS public.emergency_public_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 180),
  summary text NOT NULL CHECK (char_length(trim(summary)) BETWEEN 5 AND 360),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 10 AND 12000),
  category text NOT NULL CHECK (category IN (
    'security_advisory', 'public_safety', 'missing_person', 'shelter_update',
    'medical_advisory', 'fire_warning', 'flood_warning', 'road_closure',
    'community_notice', 'preparedness'
  )),
  priority text NOT NULL DEFAULT 'informational'
    CHECK (priority IN ('informational', 'advisory', 'warning', 'critical')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  publishing_authority text NOT NULL CHECK (char_length(trim(publishing_authority)) BETWEEN 2 AND 160),
  language_code text NOT NULL DEFAULT 'en'
    CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  published_at timestamptz,
  expires_at timestamptz,
  person_name text,
  person_photo_url text,
  last_known_location text,
  last_seen_at timestamptz,
  person_description text,
  contact_information text,
  person_status text CHECK (person_status IS NULL OR person_status IN ('missing', 'found', 'closed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT emergency_public_announcements_expiry_valid
    CHECK (expires_at IS NULL OR published_at IS NULL OR expires_at > published_at),
  CONSTRAINT emergency_public_announcements_person_fields_valid
    CHECK (
      category <> 'missing_person'
      OR status <> 'published'
      OR (
        nullif(trim(person_name), '') IS NOT NULL
        AND nullif(trim(last_known_location), '') IS NOT NULL
        AND last_seen_at IS NOT NULL
        AND nullif(trim(contact_information), '') IS NOT NULL
      )
    )
);

CREATE INDEX IF NOT EXISTS emergency_public_announcements_public_feed_idx
  ON public.emergency_public_announcements (published_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS emergency_public_announcements_category_idx
  ON public.emergency_public_announcements (category, priority);

CREATE OR REPLACE FUNCTION public.set_emergency_public_announcement_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_emergency_public_announcement_updated_at
  ON public.emergency_public_announcements;

CREATE TRIGGER set_emergency_public_announcement_updated_at
BEFORE UPDATE ON public.emergency_public_announcements
FOR EACH ROW EXECUTE FUNCTION public.set_emergency_public_announcement_updated_at();

CREATE OR REPLACE FUNCTION public.can_manage_public_information()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin() OR EXISTS (
    SELECT 1
    FROM public.organization_memberships membership
    WHERE membership.user_id = auth.uid()
      AND membership.status = 'active'
      AND (
        public.current_user_has_permission(membership.organization_id, 'organization.manage')
        OR public.current_user_has_permission(membership.organization_id, 'reports.verify')
        OR public.current_user_has_permission(membership.organization_id, 'alerts.dispatch')
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_manage_public_information() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_public_information() TO authenticated;

ALTER TABLE public.emergency_public_announcements ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.emergency_public_announcements TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.emergency_public_announcements TO authenticated;

DROP POLICY IF EXISTS "Public can read active published information"
  ON public.emergency_public_announcements;
CREATE POLICY "Public can read active published information"
  ON public.emergency_public_announcements
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    AND published_at IS NOT NULL
    AND published_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "Information managers can read all announcements"
  ON public.emergency_public_announcements;
CREATE POLICY "Information managers can read all announcements"
  ON public.emergency_public_announcements
  FOR SELECT TO authenticated
  USING (public.can_manage_public_information());

DROP POLICY IF EXISTS "Information managers can create announcements"
  ON public.emergency_public_announcements;
CREATE POLICY "Information managers can create announcements"
  ON public.emergency_public_announcements
  FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_public_information());

DROP POLICY IF EXISTS "Information managers can update announcements"
  ON public.emergency_public_announcements;
CREATE POLICY "Information managers can update announcements"
  ON public.emergency_public_announcements
  FOR UPDATE TO authenticated
  USING (public.can_manage_public_information())
  WITH CHECK (public.can_manage_public_information());

DROP POLICY IF EXISTS "Information managers can delete announcements"
  ON public.emergency_public_announcements;
CREATE POLICY "Information managers can delete announcements"
  ON public.emergency_public_announcements
  FOR DELETE TO authenticated
  USING (public.can_manage_public_information());
