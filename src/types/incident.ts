// types/incident.ts
//
// This is the CONTRACT the Community Emergency Dashboard reads from.
// It does NOT own incident creation (that's the Reporting module) or
// AI verification (that's Harsh's module) — it only displays and lets
// coordinators update status/response fields.
//
// Where fields come from:
// - id, title, category, description, location, timestamp, images -> Reporting module (EmergencyReport)
// - priority, verified, aiConfidence -> AI Detection module (Harsh)
// - status, timeline, assignedResponder, responseNotes -> owned/updated by THIS dashboard

export type IncidentPriority = "low" | "medium" | "high" | "critical";

export type IncidentStatus =
  | "pending" // just received, not yet verified
  | "verified" // AI/human confirmed it's real
  | "dispatched" // a response team has been notified
  | "acknowledged" // the assigned team accepted the dispatch
  | "responding" // the assigned team is actively responding
  | "resolved";

export type IncidentAuditAction =
  | "report.created"
  | "report.routed"
  | "report.verified"
  | "response.dispatched"
  | "response.acknowledged"
  | "response.started"
  | "incident.resolved"
  | "responder.assigned";

export interface TimelineEvent {
  id: string;
  label:
    | "report_received"
    | "verification_completed"
    | "team_notified"
    | "dispatch_acknowledged"
    | "response_started"
    | "incident_resolved";
  timestamp: string; // ISO 8601
  note?: string;
  actorId?: string;
  actorName?: string;
  action?: IncidentAuditAction;
}

export interface Incident {
  id: string;
  title: string;
  category: string; // matches EmergencyCategoryId from the Reporting module
  description: string;
  location: {
    lat?: number;
    lng?: number;
    address?: string;
    manualEntry?: string;
  };
  reportedAt: string; // ISO 8601
  priority: IncidentPriority;
  status: IncidentStatus;
  timeline: TimelineEvent[];
  assignedResponder?: string;
  responseNotes?: string;
  imageUrls?: string[];
  origin?: "database" | "integration" | "demo";
  operationalUpdatedAt?: string;
  assignedTeamId?: string;
}

// Aggregate counts for the Emergency Status Board.
export interface DashboardStats {
  totalActive: number;
  critical: number;
  pendingVerification: number;
  respondingTeams: number;
  resolvedToday: number;
}

export interface IncidentFilters {
  status?: IncidentStatus;
  priority?: IncidentPriority;
  category?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  assignedResponder?: string;
}
