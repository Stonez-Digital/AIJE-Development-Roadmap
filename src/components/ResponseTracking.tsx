// components/ResponseTracking.tsx
import { useEffect, useState } from "react";
import { useAccess } from "@/features/access/AccessProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Incident, IncidentStatus } from "../types/incident";
import { getNextIncidentStatus } from "@/lib/incidentLifecycle";
import {
  dispatchIncident,
  fetchCommunityWatchGroups,
  type CommunityWatchGroup,
} from "@/services/incidentOperations";
import type { IncidentMutationState } from "@/hooks/useIncidents";
import { AlertCircle, CheckCircle2, Loader2, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { activeOrganization, hasPermission } = useAccess();
  const [watchGroups, setWatchGroups] = useState<CommunityWatchGroup[]>([]);
  const [watchGroupId, setWatchGroupId] = useState("");
  const [watchGroupsLoading, setWatchGroupsLoading] = useState(false);
  const [watchGroupsError, setWatchGroupsError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeOrganization || !hasPermission("alerts.dispatch")) {
      setWatchGroups([]);
      setWatchGroupId("");
      return;
    }
    let cancelled = false;
    setWatchGroupsLoading(true);
    setWatchGroupsError(null);
    void fetchCommunityWatchGroups(activeOrganization.id)
      .then((groups) => {
        if (cancelled) return;
        setWatchGroups(groups);
        setWatchGroupId((current) =>
          groups.some((group) => group.id === current) ? current : "",
        );
        if (groups.length === 0) {
          setWatchGroupsError(
            "No Community Watch group is configured for this organization. Configure a group before dispatching.",
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWatchGroupsError(
            error instanceof Error
              ? error.message
              : "Community Watch groups could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setWatchGroupsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrganization, hasPermission]);

  const nextStatus = getNextIncidentStatus(incident.status);
  const requiresTeam = incident.status === "verified";
  const canDispatch = hasPermission("alerts.dispatch");

  async function handleAdvanceStatus() {
    if (!nextStatus) return;

    if (incident.status === "verified") {
      setDispatchError(null);
      try {
        if (!activeOrganization?.id) {
          throw new Error("Select an organization before dispatching.");
        }
        if (!watchGroupId) {
          throw new Error("Select the Community Watch group before dispatching.");
        }
        await dispatchIncident({
          incidentId: incident.id,
          organizationId: activeOrganization.id,
          communityWatchGroupId: watchGroupId,
          note: note.trim() || undefined,
        });
        setNote("");
        await onSaved?.();
      } catch (error) {
        // Dispatch may already be persisted even when downstream delivery
        // fails. Refresh first so the UI cannot invite a duplicate dispatch.
        await onSaved?.();
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

      {requiresTeam && canDispatch && (
        <div className="space-y-2 rounded-md border p-3">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Community Watch handoff
          </Label>
          <Select
            value={watchGroupId}
            onValueChange={setWatchGroupId}
            disabled={watchGroupsLoading || watchGroups.length === 0}
          >
            <SelectTrigger aria-label="Community Watch group">
              <SelectValue
                placeholder={
                  watchGroupsLoading
                    ? "Loading Community Watch groups…"
                    : "Select the receiving watch group"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {watchGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} · {group.community}
                  {group.ward ? ` · ${group.ward}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {watchGroupsError && (
            <p role="alert" className="text-xs text-destructive">
              {watchGroupsError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Dispatch sends this incident to the selected group only. Member
            opt-ins and configured delivery providers determine which channels
            can be used.
          </p>
        </div>
      )}

      <Button
        className="w-full"
        onClick={handleAdvanceStatus}
        disabled={
          !nextStatus ||
          (requiresTeam &&
            (!incident.assignedTeamId ||
              !canDispatch ||
              !watchGroupId ||
              watchGroupsLoading ||
              watchGroups.length === 0)) ||
          mutationState?.phase === "saving" ||
          incident.origin !== "database"
        }
      >
        {mutationState?.phase === "saving" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          requiresTeam && !canDispatch
            ? "Dispatch permission required"
            : requiresTeam && !incident.assignedTeamId
              ? "Assign a response team first"
              : requiresTeam && !watchGroupId
                ? "Select Community Watch group"
                : NEXT_STATUS_LABEL[incident.status]
        )}
      </Button>

      {dispatchError && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 p-2 text-xs text-destructive"
        >
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
