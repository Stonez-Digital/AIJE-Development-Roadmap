-- Production recovery: restore the reviewed incident-intake routing function.
-- This intentionally reuses the reviewed implementation already present in
-- 20261006000000_incident_intake_delivery.sql. The function will recover
-- legacy reports with organization_id IS NULL when the intake endpoint runs.

CREATE OR REPLACE FUNCTION public.accept_citizen_incident_report(
  _organization_id uuid,
  _reporter_id uuid,
  _client_hash text,
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
  v_allowed boolean;
  v_is_new boolean := false;
  v_moved public.incident_reports;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_client_id, 0));

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _organization_id) THEN
    RAISE EXCEPTION 'Incident intake organization does not exist';
  END IF;

  SELECT array_agg(DISTINCT membership.user_id)
    INTO v_recipient_ids
  FROM public.organization_memberships membership
  JOIN public.membership_roles membership_role ON membership_role.membership_id = membership.id
  JOIN public.role_permissions role_permission ON role_permission.role_id = membership_role.role_id
  JOIN public.access_permissions permission ON permission.id = role_permission.permission_id
  WHERE membership.organization_id = _organization_id
    AND membership.status = 'active'
    AND permission.key IN ('reports.verify', 'incidents.assign', 'incidents.respond', 'platform.manage');

  v_recipient_count := COALESCE(cardinality(v_recipient_ids), 0);
  IF v_recipient_count = 0 THEN
    RAISE EXCEPTION 'No active incident triage recipients are configured';
  END IF;

  SELECT * INTO v_report
    FROM public.incident_reports
   WHERE client_id = _client_id
   ORDER BY created_at
   LIMIT 1;

  IF v_report.id IS NOT NULL AND v_report.organization_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'report_id', v_report.id,
      'triage_notifications_created', 0,
      'organization_id', v_report.organization_id,
      'created', false
    );
  END IF;

  IF _client_hash IS NOT NULL THEN
    SELECT public.consume_public_incident_rate_limit(_client_hash) INTO v_allowed;
    IF NOT v_allowed THEN
      RAISE EXCEPTION 'PUBLIC_INCIDENT_RATE_LIMIT';
    END IF;
  END IF;

  FOR v_moved IN
    UPDATE public.incident_reports
       SET organization_id = _organization_id
     WHERE organization_id IS NULL
     RETURNING *
  LOOP
    INSERT INTO public.incident_audit_log (
      incident_id, incident_report_id, organization_id, actor_id,
      previous_status, new_status, reason, action, from_status, to_status, note, metadata
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
     WHERE client_id = _client_id
     ORDER BY created_at
     LIMIT 1;
    IF v_report.id IS NULL THEN
      RAISE EXCEPTION 'Report idempotency conflict could not be resolved';
    END IF;
  ELSE
    INSERT INTO public.incident_audit_log (
      incident_id, incident_report_id, organization_id, actor_id,
      previous_status, new_status, reason, action, from_status, to_status, note, metadata
    ) VALUES (
      v_report.id, v_report.id, _organization_id, _reporter_id,
      NULL, 'pending', NULL, 'report.created', NULL, 'pending', NULL,
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
        'client_id', v_report.client_id,
        'category', _category,
        'organizationId', _organization_id
      )
    FROM unnest(v_recipient_ids) AS recipient_id;
  END IF;

  RETURN jsonb_build_object(
    'report_id', v_report.id,
    'triage_notifications_created', CASE WHEN v_is_new THEN v_recipient_count ELSE 0 END,
    'organization_id', v_report.organization_id,
    'created', v_is_new
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_citizen_incident_report(
  uuid, uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, integer, timestamptz
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_citizen_incident_report(
  uuid, uuid, text, text, text, text, text, text, text, text,
  double precision, double precision, integer, timestamptz
) TO service_role;