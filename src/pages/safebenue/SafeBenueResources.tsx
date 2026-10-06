import { MapPin, Phone, RefreshCw, ShieldCheck } from "lucide-react";
import { SafeBenueLayout } from "@/components/safebenue/SafeBenueLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useResources } from "@/hooks/useResources";

const categoryLabel: Record<string, string> = {
  hospital: "Hospital",
  clinic: "Clinic",
  police_station: "Police",
  fire_service: "Fire service",
  ambulance_service: "Ambulance",
  safe_shelter: "Safe shelter",
  idp_camp: "IDP camp",
  relief_warehouse: "Relief centre",
  community_hall: "Community resource",
  watch_group_base: "Community watch",
  command_centre: "Command centre",
};

const statusLabel: Record<string, string> = {
  active: "Available",
  busy: "Limited",
  full: "Full",
  closed: "Closed",
  under_maintenance: "Maintenance",
  temporarily_unavailable: "Unavailable",
  damaged: "Damaged",
};

export default function SafeBenueResources() {
  const { resources, isLoading } = useResources();

  return (
    <SafeBenueLayout
      title="SafeBenue Resources"
      description="Verified emergency resources and operational availability available to SafeBenue communities."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {resources.length} resource{resources.length === 1 ? "" : "s"} available from verified local data and connected feeds.
          </p>
          <Button size="sm" variant="outline" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Synchronising" : "Up to date"}
          </Button>
        </div>

        {resources.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No verified emergency resources are currently available.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resources.map((resource) => (
              <Card key={resource.id} className="border-border bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{resource.name}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {categoryLabel[resource.category] ?? resource.category}
                      </p>
                    </div>
                    <Badge variant={resource.status === "active" ? "default" : "outline"}>
                      {statusLabel[resource.status ?? "temporarily_unavailable"] ?? resource.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{resource.address}</span>
                  </div>
                  {resource.services?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {resource.services.slice(0, 5).map((service) => (
                        <Badge key={service} variant="secondary" className="text-xs">
                          {service.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {resource.phone ? (
                    <a
                      href={`tel:${resource.phone}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {resource.phone}
                    </a>
                  ) : null}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {resource.verificationStatus === "verified" ? "Verified resource" : "Verification status not confirmed"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </SafeBenueLayout>
  );
}
