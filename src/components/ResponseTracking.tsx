// components/ResponseTracking.tsx
import { useState } from "react";
import { useAccess } from "@/features/access/AccessProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Incident, IncidentStatus } from "../types/incident";
import { getNextIncidentStatus } from "@/lib/incidentLifecycle";
import { dispatchIncident } from "@/services/incidentOperations";
import type { IncidentMutationState } from "@/hooks/useIncidents";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface ResponseTrackingProps {
  incident: Incident;
  onUpdateStatus: (
    id: string,
    status: IncidentStatus,
    note?: string,
  ) => Promise<boolean>;
  mutationState?: IncidentMutationState;
  onSaved?: () => Promise<void>;
}

const NEXT_STATUS_LABEL: Record<IncidentStatus, string> = {
  pending: "Mark Verified",
  verified: "Dispatch Response",
  dispatched: "Acknowledge Dispatch",
  acknowledged: "Start Response",
  responding: "Mark Resolved",
  resolved: "Resolved",
};

export function ResponseTracking({
  incident,
  onUpdateStatus,
  mutationState,
  onSaved,
}: ResponseTrackingProps) {
  const [note, setNote] = useState("");
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const { hasPermission } = useAccess();

  const nextStatus = getNextIncidentStatus(incident.status);
  const requiresTeam = incident.status === "verified";
  const canDispatch = hasPermission("alerts.dispatch");

  async function handleAdvanceStatus() {
    if (!nextStatus) return;

    if (incident.status === "verified") {
      setDispatchError(null);
      try {
        await dispatchIncident({
          incidentId: incident.id,
          note: note.trim() || undefined,
        });
        setNote("");
        await onSaved?.();
      } catch (error) {
        setDispatchError(
          error instanceof Error ? error.message : "Dispatch failed.",
        );
      }
      return;
    }

    const saved = await onUpdateStatus(
      incident.id,
      nextStatus,
      note.trim() || undefined,
    );
    if (saved) setNote("");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="note">Response note</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about the response (optional)"
          rows={2}
        />
      </div>

      <Button
        className="w-full"
        onClick={handleAdvanceStatus}
        disabled={
          !nextStatus ||
          (requiresTeam && (!incident.assignedTeamId || !canDispatch)) ||
          mutationState?.phase === "saving" ||
          incident.origin !== "database"
        }
      >
        {mutationState?.phase === "saving" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          {requiresTeam && !canDispatch
            ? "Dispatch permission required"
            : requiresTeam && !incident.assignedTeamId
              ? "Assign a response team first"
              : NEXT_STATUS_LABEL[incident.status]}
        )}
      </Button>

      {dispatchError && (
        <div role="alert" className="rounded-md border border-destructive/40 p-2 text-xs text-destructive">
          {dispatchError}
        </div>
      )}

      {incident.origin !== "database" && (
        <p className="text-xs text-muted-foreground">
          Read-only integration record. Lifecycle changes require a canonical
          organization incident.
        </p>
      )}

      {mutationState?.message && (
        <div
          role={mutationState.phase === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
            mutationState.phase === "error"
              ? "border-destructive/40 text-destructive"
              : "border-green-500/30 text-green-700 dark:text-green-300"
          }`}
        >
          {mutationState.phase === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          {mutationState.message}
        </div>
      )}

      {incident.responseNotes && (
        <div className="text-xs text-muted-foreground border-t pt-2">
          <span className="font-medium">Latest note: </span>
          {incident.responseNotes}
        </div>
      )}
    </div>
  );
}
