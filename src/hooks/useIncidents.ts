import { useCallback, useEffect, useMemo, useState } from "react";
import { useCommunityIntegration } from "@/contexts/CommunityIntegrationContext";
import { useAccess } from "@/features/access/AccessProvider";
import { enrichIncidents } from "@/services/intelligenceEngine";
import {
  fetchOrganizationIncidents,
  fetchOrganizationIncidentAudit,
  fetchIncidentEvidenceUrls,
  mapAuditRow,
  mapIncidentReport,
  queueIncidentTransition,
  registerIncidentLifecycleSync,
  transitionIncident,
} from "@/services/incidentOperations";
import type { EnrichedIncident } from "@/types/enrichedIncident";
import type { IncidentStatus } from "@/types/incident";

export type MutationPhase = "idle" | "saving" | "persisted" | "error";

export interface IncidentMutationState {
  phase: MutationPhase;
  message?: string;
}

interface UseIncidentsResult {
  incidents: EnrichedIncident[];
  isLoading: boolean;
  sourceError: string | null;
  mutationByIncident: Record<string, IncidentMutationState>;
  updateIncidentStatus: (
    id: string,
    status: IncidentStatus,
    note?: string,
  ) => Promise<boolean>;
  refreshIncidents: () => Promise<void>;
}

export function useIncidents(): UseIncidentsResult {
  const { snapshot, isLoading: integrationLoading } = useCommunityIntegration();
  const { activeOrganization, hasPermission } = useAccess();
  const [canonicalIncidents, setCanonicalIncidents] = useState<
    EnrichedIncident[]
  >([]);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [mutationByIncident, setMutationByIncident] = useState<
    Record<string, IncidentMutationState>
  >({});

  const loadCanonicalIncidents = useCallback(async () => {
    if (!activeOrganization) {
      setCanonicalIncidents([]);
      return;
    }
    setDatabaseLoading(true);
    setSourceError(null);
    try {
      const rows = await fetchOrganizationIncidents(activeOrganization.id);
      const [auditRows, evidenceUrls] = await Promise.all([
        hasPermission("audit.view")
          ? fetchOrganizationIncidentAudit(activeOrganization.id)
          : Promise.resolve([]),
        fetchIncidentEvidenceUrls(
          activeOrganization.id,
          rows.map((row) => row.id),
        ),
      ]);
      const incidents = rows.map((row) => {
        const incident = mapIncidentReport(row);
        return {
          ...incident,
          imageUrls: evidenceUrls[row.id] ?? [],
          timeline: [
            ...incident.timeline,
            ...auditRows
              .filter(
                (audit) =>
                  audit.incident_report_id === row.id ||
                  audit.incident_id === row.id,
              )
              .map(mapAuditRow),
          ],
        };
      });
      setCanonicalIncidents(
        enrichIncidents(
          incidents,
          snapshot?.osiris.assessments ?? [],
          snapshot?.osiris.hotspots ?? [],
        ),
      );
    } catch (error) {
      setSourceError(
        error instanceof Error
          ? error.message
          : "Incident records could not be synchronized",
      );
    } finally {
      setDatabaseLoading(false);
    }
  }, [
    activeOrganization,
    snapshot?.osiris.assessments,
    snapshot?.osiris.hotspots,
    hasPermission,
  ]);

  useEffect(() => {
    registerIncidentLifecycleSync();
  }, []);

  useEffect(() => {
    void loadCanonicalIncidents();
  }, [loadCanonicalIncidents]);

  const externalIncidents = useMemo(
    () => snapshot?.intelligence.enrichedIncidents ?? [],
    [snapshot],
  );

  const incidents = useMemo(() => {
    const canonicalIds = new Set(
      canonicalIncidents.map((incident) => incident.id),
    );
    return [
      ...canonicalIncidents,
      ...externalIncidents.filter((incident) => !canonicalIds.has(incident.id)),
    ];
  }, [canonicalIncidents, externalIncidents]);

  const updateIncidentStatus = useCallback(
    async (
      id: string,
      status: IncidentStatus,
      note?: string,
    ): Promise<boolean> => {
      if (!canonicalIncidents.some((incident) => incident.id === id)) {
        setMutationByIncident((current) => ({
          ...current,
          [id]: {
            phase: "error",
            message:
              "External and demo incidents are read-only until their provider exposes a mutation API.",
          },
        }));
        return false;
      }

      setMutationByIncident((current) => ({
        ...current,
        [id]: { phase: "saving", message: "Saving and writing audit history…" },
      }));

      if (!navigator.onLine) {
        await queueIncidentTransition({ incidentId: id, status, note });
        setMutationByIncident((current) => ({
          ...current,
          [id]: {
            phase: "saving",
            message:
              "Queued securely on this device. It will retry when connectivity returns.",
          },
        }));
        return true;
      }
      try {
        await transitionIncident({ incidentId: id, status, note });
        await loadCanonicalIncidents();
        setMutationByIncident((current) => ({
          ...current,
          [id]: {
            phase: "persisted",
            message: "Saved to the operational record and audit history.",
          },
        }));
        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/fetch|network|offline|timeout|connection/i.test(message)) {
          await queueIncidentTransition({ incidentId: id, status, note });
          setMutationByIncident((current) => ({
            ...current,
            [id]: {
              phase: "saving",
              message:
                "Connection dropped. The update is queued and will retry automatically.",
            },
          }));
          return true;
        }
        setMutationByIncident((current) => ({
          ...current,
          [id]: {
            phase: "error",
            message:
              error instanceof Error
                ? error.message
                : "The lifecycle update could not be saved.",
          },
        }));
        return false;
      }
    },
    [canonicalIncidents, loadCanonicalIncidents],
  );

  return {
    incidents,
    isLoading: integrationLoading || databaseLoading,
    sourceError,
    mutationByIncident,
    updateIncidentStatus,
    refreshIncidents: loadCanonicalIncidents,
  };
}
