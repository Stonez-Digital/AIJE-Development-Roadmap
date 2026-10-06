-- Operational responder dispatch
-- Makes verified -> dispatched an atomic dispatch operation:
-- validate authority, require an assigned team, create responder assignments,
-- advance lifecycle, and keep acknowledgement/response actions restricted
-- to members of the dispatched team.

CREATE OR REPLACE FUNCTION public.dispatch_incident(
  _incident_id uuid,
  _note text DEFAULT NULL
)
RETURNS public.incident_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  incident public.incident_reports;
  team public.teams;
  responder_count integer;
BEGIN
  SELECT * INTO incident
  FROM public.incident_reports
  WHERE id = _incident_id
  FOR UPDATE;

  IF incident.id IS NULL THEN
    RAISE EXCEPTION 'Incident not found';
  END IF;
  IF incident.organization_id IS NULL THEN
    RAISE EXCEPTION 'Incident has no organization scope';
  END IF;
  IF incident.status <> 'verified' THEN
    RAISE EXCEPTION 'Only verified incidents can be dispatched';
  END IF;
  IF incident.assigned_team_id IS NULL THEN
    RAISE EXCEPTION 'Assign a response team before dispatch';
  END IF;
  IF NOT public.current_user_has_permission(incident.organization_id, 'alerts.dispatch') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO team
  FROM public.teams
  WHERE id = incident.assigned_team_id
    AND organization_id = incident.organization_id;

  IF team.id IS NULL THEN
    RAISE EXCEPTION 'Assigned response team is outside the incident organization';
  END IF;

  INSERT INTO public.responder_assignments (
    organization_id, incident_report_id, membership_id, assigned_by, status
  )
  SELECT
    incident.organization_id,
    incident.id,
    tm.membership_id,
    auth.uid(),
    'assigned'
  FROM public.team_memberships tm
  JOIN public.organization_memberships om
    ON om.id = tm.membership_id
  JOIN public.membership_roles mr
    ON mr.membership_id = om.id
  JOIN public.role_permissions rp
    ON rp.role_id = mr.role_id
  JOIN public.access_permissions ap
    ON ap.id = rp.permission_id
  WHERE tm.team_id = team.id
    AND om.organization_id = incident.organization_id
    AND om.status = 'active'
    AND ap.key = 'incidents.respond'
  ON CONFLICT (incident_report_id, membership_id)
  DO UPDATE SET status = 'assigned', updated_at = now();

  GET DIAGNOSTICS responder_count = ROW_COUNT;

  IF responder_count = 0 THEN
    RAISE EXCEPTION 'Assigned response team has no active responders';
  END IF;

  UPDATE public.incident_reports
  SET status = 'dispatched'
  WHERE id = incident.id
  RETURNING * INTO incident;

  INSERT INTO public.incident_audit_log (
    incident_id, incident_report_id, organization_id, actor_id,
    previous_status, new_status, reason,
    action, from_status, to_status, note, metadata
  ) VALUES (
    incident.id, incident.id, incident.organization_id, auth.uid(),
    'verified', 'dispatched', NULLIF(trim(_note), ''),
    'response.dispatched', 'verified', 'dispatched',
    NULLIF(trim(_note), ''),
    jsonb_build_object(
      'team_id', team.id,
      'team_name', team.name,
      'responder_count', responder_count
    )
  );

  RETURN incident;
END
$$;

REVOKE ALL ON FUNCTION public.dispatch_incident(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_incident(uuid, text) TO authenticated, service_role;

-- Keep generic lifecycle transitions, but require the dispatched team for
-- acknowledgement and subsequent response states.
CREATE OR REPLACE FUNCTION public.transition_incident(
  _incident_id uuid,
  _to_status text,
  _note text DEFAULT NULL
)
RETURNS public.incident_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  incident public.incident_reports;
  required_permission text;
  audit_action text;
  actor_membership_id uuid;
BEGIN
  SELECT * INTO incident FROM public.incident_reports
  WHERE id = _incident_id FOR UPDATE;

  IF incident.id IS NULL THEN RAISE EXCEPTION 'Incident not found'; END IF;
  IF incident.organization_id IS NULL THEN RAISE EXCEPTION 'Incident has no organization scope'; END IF;

  IF NOT (
    (incident.status = 'pending' AND _to_status = 'verified') OR
    (incident.status = 'verified' AND _to_status = 'dispatched') OR
    (incident.status = 'dispatched' AND _to_status = 'acknowledged') OR
    (incident.status = 'acknowledged' AND _to_status = 'responding') OR
    (incident.status = 'responding' AND _to_status = 'resolved')
  ) THEN
    RAISE EXCEPTION 'Invalid incident transition: % -> %', incident.status, _to_status;
  END IF;

  IF _to_status = 'dispatched' THEN
    -- Dispatch must use the atomic operation above.
    RAISE EXCEPTION 'Use dispatch_incident to dispatch a verified incident';
  END IF;

  required_permission := CASE
    WHEN _to_status = 'verified' THEN 'reports.verify'
    ELSE 'incidents.respond'
  END CASE;

  IF NOT public.current_user_has_permission(incident.organization_id, required_permission) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF _to_status IN ('acknowledged', 'responding', 'resolved') THEN
    SELECT om.id INTO actor_membership_id
    FROM public.organization_memberships om
    JOIN public.team_memberships tm ON tm.membership_id = om.id
    WHERE tm.team_id = incident.assigned_team_id
      AND om.user_id = auth.uid()
      AND om.organization_id = incident.organization_id
      AND om.status = 'active'
    LIMIT 1;

    IF actor_membership_id IS NULL THEN
      RAISE EXCEPTION 'Only a member of the assigned response team can advance this incident';
    END IF;
  END IF;

  audit_action := CASE _to_status
    WHEN 'verified' THEN 'report.verified'
    WHEN 'acknowledged' THEN 'response.acknowledged'
    WHEN 'responding' THEN 'response.started'
    WHEN 'resolved' THEN 'incident.resolved'
  END;

  UPDATE public.incident_reports
  SET status = _to_status
  WHERE id = _incident_id
  RETURNING * INTO incident;

  IF _to_status IN ('acknowledged', 'responding', 'resolved') THEN
    UPDATE public.responder_assignments
    SET status = _to_status, updated_at = now()
    WHERE incident_report_id = incident.id
      AND membership_id = actor_membership_id;
  END IF;

  INSERT INTO public.incident_audit_log(
    incident_id, incident_report_id, organization_id, actor_id,
    previous_status, new_status, reason, action,
    from_status, to_status, note, metadata
  ) VALUES (
    incident.id, incident.id, incident.organization_id, auth.uid(),
    CASE _to_status
      WHEN 'verified' THEN 'pending'
      WHEN 'acknowledged' THEN 'dispatched'
      WHEN 'responding' THEN 'acknowledged'
      WHEN 'resolved' THEN 'responding'
    END,
    _to_status, NULLIF(trim(_note), ''), audit_action,
    CASE _to_status THEN '{}'::jsonb
         ELSE jsonb_build_object('responder_membership_id', actor_membership_id)
    END
  );

  RETURN incident;
END
$$;

REVOKE ALL ON FUNCTION public.transition_incident(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_incident(uuid, text, text) TO authenticated, service_role;
