-- Responder contact channels and incident notification delivery audit.
-- Contact details are separated from profiles so tenant administrators can
-- configure operational responders without exposing personal profile data.

CREATE TABLE IF NOT EXISTS public.responder_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  membership_id uuid NOT NULL REFERENCES public.organization_memberships(id) ON DELETE CASCADE,
  phone text,
  whatsapp_target text,
  sms_enabled boolean NOT NULL DEFAULT true,
  whatsapp_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, membership_id)
);

CREATE TABLE IF NOT EXISTS public.incident_notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  incident_report_id uuid NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  membership_id uuid REFERENCES public.organization_memberships(id) ON DELETE SET NULL,
  channel text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  recipient text NOT NULL,
  provider text,
  provider_message_id text,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error text,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS responder_contacts_org_idx
  ON public.responder_contacts(organization_id);

CREATE INDEX IF NOT EXISTS incident_notification_delivery_incident_idx
  ON public.incident_notification_deliveries(incident_report_id, created_at DESC);

ALTER TABLE public.responder_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members view responder contacts" ON public.responder_contacts;
CREATE POLICY "members view responder contacts"
  ON public.responder_contacts FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

DROP POLICY IF EXISTS "incident coordinators manage responder contacts" ON public.responder_contacts;
CREATE POLICY "incident coordinators manage responder contacts"
  ON public.responder_contacts FOR ALL TO authenticated
  USING (public.current_user_has_permission(organization_id, 'incidents.assign'))
  WITH CHECK (public.current_user_has_permission(organization_id, 'incidents.assign'));

DROP POLICY IF EXISTS "members view incident notification deliveries" ON public.incident_notification_deliveries;
CREATE POLICY "members view incident notification deliveries"
  ON public.incident_notification_deliveries FOR SELECT TO authenticated
  USING (public.is_organization_member(organization_id));

GRANT SELECT ON public.responder_contacts TO authenticated;
GRANT ALL ON public.responder_contacts TO service_role;
GRANT SELECT ON public.incident_notification_deliveries TO authenticated;
GRANT ALL ON public.incident_notification_deliveries TO service_role;
