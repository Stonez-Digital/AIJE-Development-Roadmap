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
