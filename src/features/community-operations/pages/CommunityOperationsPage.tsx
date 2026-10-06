// components/CommunityDashboard.tsx

import { useMemo, useState } from "react";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  MapPin,
  Radio,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { useLanguage } from "@/hooks/useLanguage";
import { useCommunityIntegration } from "@/contexts/CommunityIntegrationContext";

import { useIncidents } from "@/hooks/useIncidents";
import { useResources } from "@/hooks/useResources";

import { filterIncidents, sortByMostRecent } from "@/lib/incidentUtils";

import { buildDashboardIntelligence } from "@/services/dashboardIntelligence";

import { EmergencyStatusBoard } from "@/components/EmergencyStatusBoard";
import { AlertFeed } from "@/components/AlertFeed";
import { AlertFilters } from "@/components/AlertFilters";
import { IncidentTimeline } from "@/components/IncidentTimeline";
import { ResponseTracking } from "@/components/ResponseTracking";
import { UnifiedOperationsMap } from "@/components/UnifiedOperationsMap";
import { ResourceDetails } from "@/components/ResourceDetails";
import { NearbyResources } from "@/components/NearbyResources";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { IncidentFilters } from "@/types/incident";
import type { EnrichedIncident } from "@/types/enrichedIncident";
import type { EmergencyResource } from "@/types/resource";
import { RoleResourceLinks } from "@/features/access/RoleResourceLinks";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { APP_PATHS } from "@/features/navigation/navigationConfig";
import { IntegrationTrustBanner } from "@/components/IntegrationTrustBanner";
import { IncidentAuditHistory } from "@/components/IncidentAuditHistory";
import { IncidentTeamAssignment } from "@/components/IncidentTeamAssignment";
import { OperationalRiskPanel } from "@/components/OperationalRiskPanel";
import { SyncStatusPanel } from "@/components/SyncStatusPanel";
import { EmergencyTeamsPanel } from "@/components/EmergencyTeamsPanel";
import { DispatchReportPanel } from "@/components/DispatchReportPanel";

function formatIntegrationState(state: string | undefined): string {
  if (!state) {
    return "Not Configured";
  }

  return state
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getHealthTextClass(state: string | undefined): string {
  switch (state) {
    case "connected":
    case "healthy":
      return "text-green-600 dark:text-green-400";

    case "degraded":
    case "syncing":
      return "text-yellow-600 dark:text-yellow-400";

    case "disconnected":
    case "error":
      return "text-red-600 dark:text-red-400";

    default:
      return "text-muted-foreground";
  }
}

function getHealthDotClass(state: string | undefined): string {
  switch (state) {
    case "connected":
    case "healthy":
      return "bg-green-500";

    case "degraded":
    case "syncing":
      return "bg-yellow-500";

    case "disconnected":
    case "error":
      return "bg-red-500";

    default:
      return "bg-muted-foreground";
  }
}

export default function CommunityOperationsPage() {
  const { t } = useLanguage();

  const {
    snapshot,
    mode,
    isLoading: syncLoading,
    isRefreshing,
    error: syncError,
    refresh,
  } = useCommunityIntegration();

  const {
    incidents,
    isLoading: incidentsLoading,
    sourceError,
    mutationByIncident,
    updateIncidentStatus,
    refreshIncidents,
  } = useIncidents();

  const { resources, isLoading: resourcesLoading } = useResources();

  const [filters, setFilters] = useState<IncidentFilters>({});

  const [selectedIncident, setSelectedIncident] =
    useState<EnrichedIncident | null>(null);

  const [selectedResource, setSelectedResource] =
    useState<EmergencyResource | null>(null);

  const filteredIncidents = useMemo(
    () =>
      sortByMostRecent(
        filterIncidents(incidents, filters),
      ) as EnrichedIncident[],
    [incidents, filters],
  );

  const stats = useMemo(
    () => buildDashboardIntelligence(incidents),
    [incidents],
  );

  const safeBenueHealth = snapshot?.health.safeBenue;

  const osirisHealth = snapshot?.health.osiris;

  const safeBenueState = safeBenueHealth?.state;

  const osirisState = osirisHealth?.state;

  const safeBenueConnected = safeBenueState === "connected";

  const osirisConnected = osirisState === "connected";

  const anyIntegrationConnected = safeBenueConnected || osirisConnected;

  const systemOperational =
    !syncError && (mode === "demo" || anyIntegrationConnected || syncLoading);

  const lastSync = snapshot?.synchronizedAt
    ? new Date(snapshot.synchronizedAt).toLocaleTimeString()
    : "Not yet synchronised";

  const safeBenueIncidentCount = snapshot?.safeBenue.incidents.length ?? 0;

  const safeBenueResourceCount = snapshot?.safeBenue.resources.length ?? 0;

  const safeBenueMissingPersonCount =
    snapshot?.safeBenue.missingPersons.length ?? 0;

  const osirisAssessmentCount = snapshot?.osiris.assessments.length ?? 0;

  const osirisHotspotCount = snapshot?.osiris.hotspots.length ?? 0;

  // Keep selected records synchronised with live updates.
  const selectedLiveIncident = selectedIncident
    ? (incidents.find((incident) => incident.id === selectedIncident.id) ??
      null)
    : null;

  const selectedLiveResource = selectedResource
    ? (resources.find((resource) => resource.id === selectedResource.id) ??
      null)
    : null;

  const handleSelectIncident = (incident: EnrichedIncident) => {
    setSelectedIncident(incident);
    setSelectedResource(null);
  };

  const handleSelectResource = (resource: EmergencyResource) => {
    setSelectedResource(resource);
    setSelectedIncident(null);
  };

  const handleCloseResourceDetails = () => {
    setSelectedResource(null);
  };

  const handleRefresh = () => {
    void refresh();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <RoleResourceLinks />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">{t("communityDashboard")}</h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Monitor incidents, emergency resources, intelligence analysis and
            coordinated response operations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
              systemOperational
                ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
                : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />

            {systemOperational ? "System Operational" : "System Degraded"}
          </span>

          <span className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
            {mode.toUpperCase()} MODE
          </span>

          <span className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />

            {syncLoading ? "Synchronising..." : `Last Sync: ${lastSync}`}
          </span>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={syncLoading || isRefreshing}
            className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Refresh SafeBenue and Osiris data"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                syncLoading || isRefreshing ? "animate-spin" : ""
              }`}
            />

            {isRefreshing ? "Refreshing" : "Refresh"}
          </button>
        </div>
      </div>

      <IntegrationTrustBanner
        mode={mode}
        providers={[
          ...(safeBenueHealth ? [safeBenueHealth] : []),
          ...(osirisHealth ? [osirisHealth] : []),
        ]}
      />

      {syncError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

          <div>
            <p className="font-medium">Integration synchronisation error</p>

            <p className="mt-1 text-xs">{syncError}</p>
          </div>
        </div>
      )}

      {sourceError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Operational records unavailable</p>
            <p className="mt-1 text-xs">{sourceError}</p>
          </div>
        </div>
      )}

      <EmergencyStatusBoard
        stats={stats}
        isLoading={incidentsLoading || syncLoading}
      />

      <OperationalRiskPanel
        incidents={incidents}
        failedTransitions={
          Object.values(mutationByIncident).filter(
            (mutation) => mutation.phase === "error",
          ).length
        }
      />

      <SyncStatusPanel />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Tabs defaultValue="feed">
            <TabsList>
              <TabsTrigger value="feed">{t("alertFeed")}</TabsTrigger>

              <TabsTrigger value="map">{t("liveMap")}</TabsTrigger>
              <TabsTrigger value="teams">Emergency Teams</TabsTrigger>
              <TabsTrigger value="dispatch-report">Dispatch Report</TabsTrigger>
            </TabsList>

            <TabsContent value="feed" className="space-y-3">
              <AlertFilters filters={filters} onChange={setFilters} />

              <AlertFeed
                incidents={filteredIncidents}
                selectedId={selectedLiveIncident?.id}
                onSelect={handleSelectIncident}
              />
            </TabsContent>

            <TabsContent value="map">
              {resourcesLoading ? (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    Loading emergency operations map...
                  </CardContent>
                </Card>
              ) : (
                <UnifiedOperationsMap
                  incidents={filteredIncidents}
                  resources={resources}
                  onSelectIncident={handleSelectIncident}
                  onSelectResource={handleSelectResource}
                />
              )}
            </TabsContent>

            <TabsContent value="teams"><EmergencyTeamsPanel /></TabsContent>

            <TabsContent value="dispatch-report"><DispatchReportPanel /></TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <NearbyResources />

          {selectedLiveIncident ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedLiveIncident.title}
                </CardTitle>

                <p className="text-xs text-muted-foreground">
                  {selectedLiveIncident.location.address ??
                    selectedLiveIncident.location.manualEntry ??
                    "Location pending"}
                </p>
              </CardHeader>

              <CardContent className="space-y-5">
                <p className="text-sm">{selectedLiveIncident.description}</p>

                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Intelligence Threat Score
                      </p>

                      <p className="mt-1 text-2xl font-bold">
                        {selectedLiveIncident.intelligence.threatScore}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-medium text-muted-foreground">
                        Confidence
                      </p>

                      <p className="mt-1 text-lg font-semibold">
                        {selectedLiveIncident.intelligence.confidence}%
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedLiveIncident.intelligence.recommendation}
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Timeline</h3>

                  <IncidentTimeline incident={selectedLiveIncident} />
                </div>

                <IncidentTeamAssignment
                  incident={selectedLiveIncident}
                  onSaved={refreshIncidents}
                />

                <div>
                  <h3 className="mb-2 text-sm font-semibold">Response</h3>

                  <ResponseTracking
                    incident={selectedLiveIncident}
                    onUpdateStatus={updateIncidentStatus}
                    mutationState={mutationByIncident[selectedLiveIncident.id]}
                    onSaved={refreshIncidents}
                  />
                </div>

                <IncidentAuditHistory
                  incident={selectedLiveIncident}
                  refreshKey={
                    mutationByIncident[selectedLiveIncident.id]?.phase
                  }
                />
              </CardContent>
            </Card>
          ) : selectedLiveResource ? (
            <ResourceDetails
              resource={selectedLiveResource}
              onClose={handleCloseResourceDetails}
            />
          ) : (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <CardTitle className="text-base">
                      Operations Centre
                    </CardTitle>

                    <p className="mt-1 text-xs text-muted-foreground">
                      No active incident or emergency resource selected.
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <section>
                  <h3 className="mb-3 text-sm font-semibold">
                    Select an operational item
                  </h3>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />

                      <div>
                        <p className="text-sm font-medium">Incident</p>

                        <p className="text-xs text-muted-foreground">
                          Select an incident from the Alert Feed or Live Map.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <MapPin className="h-4 w-4 shrink-0 text-blue-500" />

                      <div>
                        <p className="text-sm font-medium">
                          Emergency Resource
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Select a hospital, police station, shelter or
                          emergency resource.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-3 text-sm font-semibold">
                    Available Operations
                  </h3>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    {[
                      "Review Incident Intelligence",
                      "Review Incident Timeline",
                      "Monitor Response Progress",
                      "Assign Emergency Responders",
                      "Review Resource Information",
                      "Coordinate Community Alerts",
                    ].map((operation) => (
                      <div key={operation} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                        <span>{operation}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-semibold">System Status</h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Activity
                          className={`h-4 w-4 shrink-0 ${
                            systemOperational
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        />
                        Status
                      </span>

                      <span
                        className={`font-medium ${
                          systemOperational
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {systemOperational ? "Operational" : "Degraded"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Database className="h-4 w-4 shrink-0" />
                        Mode
                      </span>

                      <span className="font-medium">{mode.toUpperCase()}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Radio className="h-4 w-4 shrink-0" />
                        Backend
                      </span>

                      <span
                        className={`text-right font-medium ${
                          anyIntegrationConnected
                            ? "text-green-600 dark:text-green-400"
                            : "text-yellow-600 dark:text-yellow-400"
                        }`}
                      >
                        {syncLoading
                          ? "Synchronising"
                          : anyIntegrationConnected
                            ? "Connected"
                            : "Awaiting Live Sync"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Clock3 className="h-4 w-4 shrink-0" />
                        Last Sync
                      </span>

                      <span className="text-right font-medium">{lastSync}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="rounded-md border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${getHealthDotClass(
                              safeBenueState,
                            )}`}
                          />
                          SafeBenue
                        </span>

                        <span
                          className={`text-xs font-medium ${getHealthTextClass(
                            safeBenueState,
                          )}`}
                        >
                          {formatIntegrationState(safeBenueState)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-base font-semibold">
                            {safeBenueIncidentCount}
                          </p>

                          <p className="text-[11px] text-muted-foreground">
                            Incidents
                          </p>
                        </div>

                        <div>
                          <p className="text-base font-semibold">
                            {safeBenueResourceCount}
                          </p>

                          <p className="text-[11px] text-muted-foreground">
                            Resources
                          </p>
                        </div>

                        <div>
                          <p className="text-base font-semibold">
                            {safeBenueMissingPersonCount}
                          </p>

                          <p className="text-[11px] text-muted-foreground">
                            Missing
                          </p>
                        </div>
                      </div>

                      {safeBenueHealth?.lastError && (
                        <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                          {safeBenueHealth.lastError}
                        </p>
                      )}
                    </div>

                    <div className="rounded-md border bg-background p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${getHealthDotClass(
                              osirisState,
                            )}`}
                          />
                          Osiris Intelligence
                        </span>

                        <span
                          className={`text-xs font-medium ${getHealthTextClass(
                            osirisState,
                          )}`}
                        >
                          {formatIntegrationState(osirisState)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                        <div>
                          <p className="text-base font-semibold">
                            {osirisAssessmentCount}
                          </p>

                          <p className="text-[11px] text-muted-foreground">
                            Assessments
                          </p>
                        </div>

                        <div>
                          <p className="text-base font-semibold">
                            {osirisHotspotCount}
                          </p>

                          <p className="text-[11px] text-muted-foreground">
                            Hotspots
                          </p>
                        </div>
                      </div>

                      {osirisHealth?.lastError && (
                        <p className="mt-3 text-xs text-red-600 dark:text-red-400">
                          {osirisHealth.lastError}
                        </p>
                      )}
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                      >
                        <Link to={APP_PATHS.intelligence}>
                          Open intelligence workspace
                        </Link>
                      </Button>
                    </div>
                  </div>
                </section>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
