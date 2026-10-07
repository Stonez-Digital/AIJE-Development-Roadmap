import { Link } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock3, MapPin, RefreshCw } from "lucide-react";
import { SafeBenueLayout } from "@/components/safebenue/SafeBenueLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_PATHS } from "@/features/navigation/navigationConfig";
import { useIncidents } from "@/hooks/useIncidents";

const statusLabel: Record<string, string> = {
  pending: "Awaiting verification",
  verified: "Verified",
  dispatched: "Dispatched",
  acknowledged: "Acknowledged",
  responding: "Responding",
  resolved: "Resolved",
};

export default function SafeBenueReports() {
  const { incidents, isLoading, sourceError, refreshIncidents } = useIncidents();

  return (
    <SafeBenueLayout
      title="SafeBenue Reports"
      description="The SafeBenue reporting view uses AIJE's canonical incident record, so reports are verified and tracked in one operational workflow."
    >
      <div className="space-y-4">
        {sourceError ? (
          <Alert variant="destructive">
            <AlertTitle>Reports could not be synchronized</AlertTitle>
            <AlertDescription>{sourceError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {incidents.length} incident{incidents.length === 1 ? "" : "s"} visible to your current access scope.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void refreshIncidents()} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild size="sm">
              <Link to={APP_PATHS.incidentReport}>Submit incident</Link>
            </Button>
          </div>
        </div>

        {isLoading && incidents.length === 0 ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading incident reports…</CardContent></Card>
        ) : incidents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
              <p className="mt-3 font-medium">No incidents currently visible</p>
              <p className="mt-1 text-sm text-muted-foreground">New reports will appear here after they enter AIJE's incident workflow.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {incidents.map((incident) => {
              const status = statusLabel[incident.status] ?? incident.status;
              const location = incident.location.manualEntry ?? incident.location.address ?? "Location not specified";
              const evidenceCount = (incident.imageUrls?.length ?? 0) + (incident.videoUrls?.length ?? 0);
              return (
                <Card key={incident.id} className="border-border bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{incident.title}</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(incident.reportedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline">{status}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-6 text-muted-foreground">{incident.description}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{location}</span>
                      <Badge variant="secondary">{incident.priority}</Badge>
                      {evidenceCount > 0 ? <Badge variant="secondary">{evidenceCount} evidence item{evidenceCount === 1 ? "" : "s"}</Badge> : null}
                    </div>
                    {(incident.imageUrls?.length ?? 0) + (incident.videoUrls?.length ?? 0) > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold">Report evidence</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(incident.imageUrls ?? []).map((url, index) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border">
                              <img src={url} alt={`Evidence image ${index + 1}`} className="h-28 w-full object-cover" loading="lazy" />
                            </a>
                          ))}
                          {(incident.videoUrls ?? []).map((url, index) => (
                            <video key={url} src={url} controls playsInline preload="metadata" className="h-28 w-full rounded-md border object-cover" aria-label={`Evidence video ${index + 1}`} />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {incident.status === "pending" ? (
                      <p className="flex items-center gap-2 text-xs text-warning">
                        <Clock3 className="h-3.5 w-3.5" /> Awaiting authorized verification.
                      </p>
                    ) : incident.status === "resolved" ? (
                      <p className="flex items-center gap-2 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Response workflow completed.
                      </p>
                    ) : incident.status === "responding" || incident.status === "dispatched" || incident.status === "acknowledged" ? (
                      <p className="flex items-center gap-2 text-xs text-primary">
                        <AlertCircle className="h-3.5 w-3.5" /> Active response workflow.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </SafeBenueLayout>
  );
}
