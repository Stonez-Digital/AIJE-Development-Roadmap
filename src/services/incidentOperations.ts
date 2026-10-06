import { supabase } from "@/integrations/supabase/client";
import type { IncidentStatus } from "@/types/incident";
import { enqueue, registerSyncHandler } from "@/lib/syncEngine";
import type {
  IncidentAuditRow,
  IncidentReportRow,
} from "./incidentOperationMappers";

export { mapAuditRow, mapIncidentReport } from "./incidentOperationMappers";
export type {
  IncidentAuditRow,
  IncidentReportRow,
} from "./incidentOperationMappers";

export interface ResponseTeam {
  id: string;
  name: string;
  teamType: string;
}
interface QueuedTransition {
  incidentId: string;
  status: IncidentStatus;
  note?: string;
}
const LIFECYCLE_COLLECTION = "incident_lifecycle_transitions";
let lifecycleHandlerRegistered = false;

export function registerIncidentLifecycleSync() {
  if (lifecycleHandlerRegistered) return;
  lifecycleHandlerRegistered = true;
  registerSyncHandler<QueuedTransition>(LIFECYCLE_COLLECTION, async (item) => {
    await transitionIncident(item);
  });
}

export async function queueIncidentTransition(
  input: QueuedTransition,
): Promise<string> {
  registerIncidentLifecycleSync();
  return enqueue(LIFECYCLE_COLLECTION, input);
}

export async function fetchOrganizationIncidents(
  organizationId: string,
): Promise<IncidentReportRow[]> {
  const { data, error } = await supabase
    .from("incident_reports")
    .select("*")
    .eq("organization_id", organizationId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function transitionIncident(input: {
  incidentId: string;
  status: IncidentStatus;
  note?: string;
}): Promise<IncidentReportRow> {
  const { data, error } = await supabase.rpc("transition_incident", {
    _incident_id: input.incidentId,
    _to_status: input.status,
    _note: input.note ?? null,
  });
  if (error) throw error;
  return data;
}

export async function fetchResponseTeams(
  organizationId: string,
): Promise<ResponseTeam[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id,name,team_type")
    .eq("organization_id", organizationId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    teamType: team.team_type,
  }));
}

export async function dispatchIncident(input: {
  incidentId: string;
  note?: string;
}): Promise<IncidentReportRow> {
  const { data, error } = await supabase.rpc("dispatch_incident", {
    _incident_id: input.incidentId,
    _note: input.note ?? null,
  });
  if (error) throw error;

  // In-app notifications are generated transactionally by the database.
  // SMS/WhatsApp is best-effort fallback and must never roll back dispatch.
  await supabase.functions.invoke("dispatch-incident-notification", {
    body: { incidentId: input.incidentId },
  });

  return data;
}

export async function assignIncidentTeam(input: {
  incidentId: string;
  teamId: string;
  note?: string;
}): Promise<IncidentReportRow> {
  const { data, error } = await supabase.rpc("assign_incident_team", {
    _incident_id: input.incidentId,
    _team_id: input.teamId,
    _note: input.note ?? null,
  });
  if (error) throw error;
  return data;
}

export async function fetchActorNames(
  organizationId: string,
  actorIds: string[],
): Promise<Record<string, string>> {
  if (actorIds.length === 0) return {};
  const { data, error } = await supabase.rpc("get_incident_actor_names", {
    _organization_id: organizationId,
    _actor_ids: actorIds,
  });
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((actor) => [actor.user_id, actor.display_name]),
  );
}

export async function fetchIncidentAudit(input: {
  incidentId: string;
  organizationId: string;
}): Promise<IncidentAuditRow[]> {
  const { data, error } = await supabase
    .from("incident_audit_log")
    .select("*")
    .eq("organization_id", input.organizationId)
    .or(
      `incident_report_id.eq.${input.incidentId},incident_id.eq.${input.incidentId}`,
    )
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchOrganizationIncidentAudit(
  organizationId: string,
): Promise<IncidentAuditRow[]> {
  const { data, error } = await supabase
    .from("incident_audit_log")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface ResponseTeamRoster {
  teamId: string;
  teamName: string;
  teamType: string;
  members: Array<{
    membershipId: string;
    userId: string;
    displayName: string;
    status: string;
  }>;
}

export interface DispatchReportRow {
  auditId: string;
  incidentId: string;
  title: string;
  category: string;
  teamName: string | null;
  status: string;
  dispatchedAt: string;
  note: string | null;
}

export async function fetchResponseTeamRoster(
  organizationId: string,
): Promise<ResponseTeamRoster[]> {
  const { data, error } = await supabase.rpc("get_response_team_roster", {
    _organization_id: organizationId,
  });
  if (error) throw error;

  const grouped = new Map<string, ResponseTeamRoster>();
  for (const row of data ?? []) {
    const team = grouped.get(row.team_id) ?? {
      teamId: row.team_id,
      teamName: row.team_name,
      teamType: row.team_type,
      members: [],
    };
    if (row.membership_id) {
      team.members.push({
        membershipId: row.membership_id,
        userId: row.user_id,
        displayName: row.display_name,
        status: row.membership_status,
      });
    }
    grouped.set(row.team_id, team);
  }
  return [...grouped.values()];
}

export async function fetchDispatchReport(
  organizationId: string,
): Promise<DispatchReportRow[]> {
  const { data: audits, error: auditError } = await supabase
    .from("incident_audit_log")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("action", "response.dispatched")
    .order("created_at", { ascending: false });
  if (auditError) throw auditError;

  const incidentIds = [
    ...new Set(
      (audits ?? [])
        .map((audit) => audit.incident_report_id ?? audit.incident_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: incidents, error: incidentError } = incidentIds.length
    ? await supabase
        .from("incident_reports")
        .select("id,title,category,assigned_team_id,status")
        .in("id", incidentIds)
    : { data: [], error: null };
  if (incidentError) throw incidentError;

  const teamIds = [
    ...new Set(
      (incidents ?? [])
        .map((incident) => incident.assigned_team_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: teams, error: teamError } = teamIds.length
    ? await supabase.from("teams").select("id,name").in("id", teamIds)
    : { data: [], error: null };
  if (teamError) throw teamError;

  const incidentMap = new Map((incidents ?? []).map((incident) => [incident.id, incident]));
  const teamMap = new Map((teams ?? []).map((team) => [team.id, team.name]));

  return (audits ?? []).map((audit) => {
    const incidentId = audit.incident_report_id ?? audit.incident_id ?? "";
    const incident = incidentMap.get(incidentId);
    const teamId = incident?.assigned_team_id ?? null;

    return {
      auditId: audit.id,
      incidentId,
      title: incident?.title ?? "Incident",
      category: incident?.category ?? "Unknown",
      teamName: teamId ? teamMap.get(teamId) ?? null : null,
      status: incident?.status ?? "dispatched",
      dispatchedAt: audit.created_at,
      note: audit.note ?? audit.reason ?? null,
    };
  });
}

export async function fetchIncidentEvidenceUrls(
  organizationId: string,
  incidentIds: string[],
): Promise<Record<string, { imageUrls: string[]; videoUrls: string[] }>> {
  if (incidentIds.length === 0) return {};

  const { data, error } = await supabase
    .from("incident_report_images")
    .select("incident_report_id,storage_path,content_type")
    .eq("organization_id", organizationId)
    .in("incident_report_id", incidentIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const grouped = new Map<string, { paths: string[]; types: string[] }>();
  for (const row of data ?? []) {
    const current = grouped.get(row.incident_report_id) ?? { paths: [], types: [] };
    current.paths.push(row.storage_path);
    current.types.push(row.content_type);
    grouped.set(row.incident_report_id, current);
  }

  const result: Record<string, { imageUrls: string[]; videoUrls: string[] }> = {};
  for (const [incidentId, evidence] of grouped) {
    const { data: signed, error: signedError } = await supabase.storage
      .from("incident-evidence")
      .createSignedUrls(evidence.paths, 3600);
    if (signedError) throw signedError;

    const media = (signed ?? [])
      .map((item, index) => ({
        url: item.signedUrl,
        type: evidence.types[index] ?? "",
      }))
      .filter((item): item is { url: string; type: string } => Boolean(item.url));

    result[incidentId] = {
      imageUrls: media.filter((item) => item.type.startsWith("image/")).map((item) => item.url),
      videoUrls: media.filter((item) => item.type.startsWith("video/")).map((item) => item.url),
    };
  }
  return result;
}
