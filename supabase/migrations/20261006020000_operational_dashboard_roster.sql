CREATE OR REPLACE FUNCTION public.get_response_team_roster(_organization_id uuid)
RETURNS TABLE(team_id uuid, team_name text, team_type text, membership_id uuid, user_id uuid, display_name text, membership_status public.membership_status)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team.id, team.name, team.team_type, membership.id, membership.user_id,
         COALESCE(profile.display_name, membership.user_id::text), membership.status
  FROM public.teams team
  LEFT JOIN public.team_memberships team_membership ON team_membership.team_id = team.id
  LEFT JOIN public.organization_memberships membership ON membership.id = team_membership.membership_id
  LEFT JOIN public.profiles profile ON profile.user_id = membership.user_id
  WHERE team.organization_id = _organization_id AND public.is_organization_member(_organization_id)
  ORDER BY team.name, COALESCE(profile.display_name, membership.user_id::text);
$$;
REVOKE ALL ON FUNCTION public.get_response_team_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_response_team_roster(uuid) TO authenticated, service_role;
