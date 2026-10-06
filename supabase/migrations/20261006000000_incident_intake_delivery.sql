-- Reliable citizen incident intake:
-- 1. Every report is assigned to an operational organization.
-- 2. Triage members are notified in the same transaction as report creation.
-- 3. Older unscoped reports are routed the first time the intake endpoint runs.

ALTER TABLE public.incident_audit_log
  DROP CONSTRAINT IF EXISTS incident_audit_log_action_check;

ALTER TABLE public.incident_audit_log
  ADD CONSTRAINT incident_audit_log_action_check CHECK (
    action IN (
      'report.created', 'report.routed', 'report.verified',
      'response.dispatched', 'response.acknowledged', 'response.started',
      'incident.resolved', 'responder.assigned'
    )
  );

CREATE INDEX IF NOT EXISTS incident_reports_unrouted_idx
  ON public.incident_reports (id)
  WHERE organization_id IS NULL;

CREATE OR REPLACE FUNCTION public.accept_citizen_incident_report(
  _organization_id uuid,
  _reporter_id uuid,
  _client_id text,
  _title text,
  _category text,
  _description text,
  _contact text,
  _address text,
  _manual_location text,
  _latitude double precision,
  _longitude double precision,
  _image_count integer,
  _occurred_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report public.incident_reports;
  v_recipient_ids uuid[];
  v_recipient_count integer;
  v_is_new boolean := false;
  v_moved public.incident_reports;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _organization_id) THEN
    RAISE EXCEPTION 'Incident intake organization does not exist';
  END IF;

  SELECT array_agg(DISTINCT membership.user_id)
    INTO v_recipient_ids
  FROM public.organization_memberships membership
  JOIN public.membership_roles membership_role
    ON membership_role.membership_id = membership.id
  JOIN public.role_permissions role_permission
    ON role_permission.role_id = membership_role.role_id
  JOIN public.access_permissions permission
    ON permission.id = role_permission.permission_id
  WHERE membership.organization_id = _organization_id
    AND membership.status = 'active'
    AND permission.key IN (
      'reports.verify', 'incidents.assign', 'incidents.respond', 'platform.manage'
    );

  v_recipient_count := COALESCE(cardinality(v_recipient_ids), 0);
  IF v_recipient_count = 0 THEN
    RAISE EXCEPTION 'No active incident triage recipients are configured';
  END IF;

  -- Recover reports created before organization routing was enforced.
  FOR v_moved IN
    UPDATE public.incident_reports
       SET organization_id = _organization_id
     WHERE organization_id IS NULL
     RETURNING *
  LOOP
    INSERT INTO public.incident_audit_log (
      incident_id, incident_report_id, organization_id, actor_id,
      previous_status, new_status, reason,
      action, from_status, to_status, note, metadata
    ) VALUES (
      v_moved.id, v_moved.id, _organization_id, NULL,
      v_moved.status, v_moved.status, 'Routed to the configured incident intake',
      'report.routed', v_moved.status, v_moved.status,
      'Recovered an incident that previously had no operational organization.',
      jsonb_build_object('routing_recovery', true)
    );

    INSERT INTO public.notifications (
      user_id, category, priority, title, body, link, metadata
    )
    SELECT recipient_id, 'incident', 'high',
      'Unrouted incident report recovered',
      format('%s · %s', v_moved.title, v_moved.category),
      '/community/operations',
      jsonb_build_object(
        'incidentId', v_moved.id,
        'client_id', v_moved.client_id,
        'category', v_moved.category,
        'organizationId', _organization_id,
        'routingRecovery', true
      )
    FROM unnest(v_recipient_ids) AS recipient_id;
  END LOOP;

  INSERT INTO public.incident_reports (
    reporter_id, client_id, title, category, description, contact,
    address, manual_location, latitude, longitude, image_count,
    status, occurred_at, organization_id
  ) VALUES (
    _reporter_id, _client_id, _title, _category, _description, _contact,
    _address, _manual_location, _latitude, _longitude,
    GREATEST(0, LEAST(_image_count, 5)), 'pending', _occurred_at,
    _organization_id
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_report;

  v_is_new := FOUND;
  IF NOT v_is_new THEN
    SELECT * INTO v_report
      FROM public.incident_reports
     WHERE reporter_id IS NOT DISTINCT FROM _reporter_id
       AND client_id = _client_id
     LIMIT 1;
    IF v_report.id IS NULL THEN
      RAISE EXCEPTION 'Report idempotency conflict could not be resolved';
    END IF;
  ELSE
    INSERT INTO public.incident_audit_log (
      incident_id, incident_report_id, organization_id, actor_id,
      previous_status, new_status, reason,
      action, from_status, to_status, note, metadata
    ) VALUES (
      v_report.id, v_report.id, _organization_id, _reporter_id,
      NULL, 'pending', NULL,
      'report.created', NULL, 'pending', NULL,
      jsonb_build_object('source', 'citizen_intake', 'client_id', _client_id)
    );

    INSERT INTO public.notifications (
      user_id, category, priority, title, body, link, metadata
    )
    SELECT recipient_id, 'incident', 'high',
      'New citizen incident report',
      format('%s · %s · %s', _title, _category, COALESCE(_address, _manual_location, 'Location not provided')),
      '/community/operations',
      jsonb_build_object(
        'incidentId', v_report.id,
        'client_id', _client_id,
        'category', _category,
        'organizationId', _organization_id
      )
    FROM unnest(v_recipient_ids) AS recipient_id;
  END IF;

  RETURN jsonb_build_object(
    'report_id', v_report.id,
    'triage_notifications_created', CASE WHEN v_is_new THEN v_recipient_count ELSE 0 END,
    'organization_id', _organization_id,
    'created', v_is_new
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_citizen_incident_report(
  uuid, uuid, text, text, text, text, text, text, text,
  double precision, double precision, integer, timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_citizen_incident_report(
  uuid, uuid, text, text, text, text, text, text, text,
  double precision, double precision, integer, timestamptz
) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_incident_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recipient_ids uuid[];
  v_title text;
  v_body text;
  v_event text;
BEGIN
  IF NEW.assigned_team_id IS DISTINCT FROM OLD.assigned_team_id
     AND NEW.assigned_team_id IS NOT NULL THEN
    SELECT array_agg(DISTINCT membership.user_id)
      INTO v_recipient_ids
    FROM public.team_memberships team_membership
    JOIN public.organization_memberships membership
      ON membership.id = team_membership.membership_id
    JOIN public.membership_roles membership_role
      ON membership_role.membership_id = membership.id
    JOIN public.role_permissions role_permission
      ON role_permission.role_id = membership_role.role_id
    JOIN public.access_permissions permission
      ON permission.id = role_permission.permission_id
    WHERE team_membership.team_id = NEW.assigned_team_id
      AND membership.organization_id = NEW.organization_id
      AND membership.status = 'active'
      AND permission.key IN ('incidents.respond', 'incidents.assign', 'reports.verify', 'platform.manage');

    v_title := 'Incident assigned to your response team';
    v_body := format('%s · %s', NEW.title, NEW.category);
    v_event := 'team_assigned';

    IF COALESCE(cardinality(v_recipient_ids), 0) = 0 THEN
      SELECT array_agg(DISTINCT membership.user_id)
        INTO v_recipient_ids
      FROM public.organization_memberships membership
      JOIN public.membership_roles membership_role
        ON membership_role.membership_id = membership.id
      JOIN public.role_permissions role_permission
        ON role_permission.role_id = membership_role.role_id
      JOIN public.access_permissions permission
        ON permission.id = role_permission.permission_id
      WHERE membership.organization_id = NEW.organization_id
        AND membership.status = 'active'
        AND permission.key IN ('incidents.assign', 'reports.verify', 'platform.manage');
      v_title := 'Assigned team has no active responders';
      v_body := format('%s was assigned to a team with no active members.', NEW.title);
      v_event := 'team_assignment_unstaffed';
    END IF;

    INSERT INTO public.notifications (
      user_id, category, priority, title, body, link, metadata
    )
    SELECT recipient_id, 'incident', 'high', v_title, v_body,
      '/community/operations',
      jsonb_build_object(
        'incidentId', NEW.id,
        'organizationId', NEW.organization_id,
        'teamId', NEW.assigned_team_id,
        'event', v_event
      )
    FROM unnest(COALESCE(v_recipient_ids, ARRAY[]::uuid[])) AS recipient_id;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'dispatched' THEN
    SELECT array_agg(DISTINCT membership.user_id)
      INTO v_recipient_ids
    FROM public.team_memberships team_membership
    JOIN public.organization_memberships membership
      ON membership.id = team_membership.membership_id
    JOIN public.membership_roles membership_role
      ON membership_role.membership_id = membership.id
    JOIN public.role_permissions role_permission
      ON role_permission.role_id = membership_role.role_id
    JOIN public.access_permissions permission
      ON permission.id = role_permission.permission_id
    WHERE team_membership.team_id = NEW.assigned_team_id
      AND membership.organization_id = NEW.organization_id
      AND membership.status = 'active'
      AND permission.key IN ('incidents.respond', 'incidents.assign', 'reports.verify', 'platform.manage');

    IF COALESCE(cardinality(v_recipient_ids), 0) = 0 THEN
      SELECT array_agg(DISTINCT membership.user_id)
        INTO v_recipient_ids
      FROM public.organization_memberships membership
      JOIN public.membership_roles membership_role
        ON membership_role.membership_id = membership.id
      JOIN public.role_permissions role_permission
        ON role_permission.role_id = membership_role.role_id
      JOIN public.access_permissions permission
        ON permission.id = role_permission.permission_id
      WHERE membership.organization_id = NEW.organization_id
        AND membership.status = 'active'
        AND permission.key IN (
          'reports.verify', 'incidents.assign', 'incidents.respond', 'platform.manage'
        );
    END IF;

    INSERT INTO public.notifications (
      user_id, category, priority, title, body, link, metadata
    )
    SELECT recipient_id, 'incident', 'critical',
      'Incident response dispatched',
      format('%s · %s', NEW.title, COALESCE(NEW.address, NEW.manual_location, 'Location not provided')),
      '/community/operations',
      jsonb_build_object(
        'incidentId', NEW.id,
        'organizationId', NEW.organization_id,
        'teamId', NEW.assigned_team_id,
        'event', 'response_dispatched'
      )
    FROM unnest(COALESCE(v_recipient_ids, ARRAY[]::uuid[])) AS recipient_id;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = 'resolved'
     AND NEW.reporter_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id, category, priority, title, body, link, metadata
    ) VALUES (
      NEW.reporter_id, 'incident', 'normal', 'Incident marked resolved',
      format('%s has been marked resolved.', NEW.title),
      NULL,
      jsonb_build_object(
        'incidentId', NEW.id,
        'organizationId', NEW.organization_id,
        'event', 'incident_resolved'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_incident_operations() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS incident_reports_notify_operations ON public.incident_reports;
CREATE TRIGGER incident_reports_notify_operations
  AFTER UPDATE OF assigned_team_id, status ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_incident_operations();