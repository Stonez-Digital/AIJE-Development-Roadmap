import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  ShieldAlert,
  MapPin,
  CheckCircle2,
  Loader2,
  Users,
  LocateFixed,
  Clock3,
  Check,
  X,
  Send,
} from "lucide-react";
import { Link } from "react-router-dom";
import { SafeBenueLayout } from "@/components/safebenue/SafeBenueLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { APP_PATHS } from "@/features/navigation/navigationConfig";
import {
  useEarlyWarnings,
  type WarningSeverity,
  type WarningStatus,
} from "@/hooks/useEarlyWarnings";

const CATEGORIES = [
  "security",
  "flood",
  "fire",
  "medical",
  "missing_person",
  "infrastructure",
  "other",
];

const STATUS_LABELS: Record<WarningStatus, string> = {
  pending: "Awaiting verification",
  active: "Verified alert",
  resolved: "Resolved",
  false_alarm: "False alarm",
};

const severityTone: Record<WarningSeverity, string> = {
  critical: "border-destructive/40 text-destructive",
  high: "border-destructive/30 text-destructive",
  medium: "border-warning/30 text-warning",
  low: "border-primary/30 text-primary",
};

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function SafeBenueCommunityWatch() {
  const {
    warnings,
    loading,
    error,
    userId,
    isModerator,
    confirmationCounts,
    myConfirmations,
    postWarning,
    toggleConfirmation,
    setStatus,
  } = useEarlyWarnings();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [community, setCommunity] = useState("");
  const [ward, setWard] = useState("");
  const [category, setCategory] = useState("security");
  const [severity, setSeverity] = useState<WarningSeverity>("medium");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | WarningStatus>("active");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const stats = useMemo(() => {
    const active = warnings.filter((w) => w.status === "active").length;
    const pending = warnings.filter((w) => w.status === "pending").length;
    const confirmations = Array.from(confirmationCounts.values()).reduce(
      (sum, count) => sum + count,
      0,
    );
    return { active, pending, confirmations };
  }, [warnings, confirmationCounts]);

  const visible = warnings.filter(
    (warning) =>
      (statusFilter === "all" || warning.status === statusFilter) &&
      (categoryFilter === "all" || warning.category === categoryFilter),
  );

  function captureLocation() {
    if (!navigator.geolocation) {
      toast({
        title: "Location unavailable",
        description: "This device does not provide browser location services.",
        variant: "destructive",
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationAccuracy(position.coords.accuracy);
        setGettingLocation(false);
        toast({
          title: "Location attached",
          description: "Your approximate incident location will be included with this warning.",
        });
      },
      (locationError) => {
        setGettingLocation(false);
        toast({
          title: "Could not get location",
          description: locationError.message,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await postWarning({
        title,
        description,
        community,
        ward,
        category,
        severity,
        latitude,
        longitude,
        location_accuracy_m: locationAccuracy,
      });
      setTitle("");
      setDescription("");
      setWard("");
      setLatitude(null);
      setLongitude(null);
      setLocationAccuracy(null);
      toast({
        title: "Community warning submitted",
        description:
          "The signal is now pending verification. Nearby community members can confirm what they see, while authorized AIJE moderators decide whether it becomes an active alert.",
      });
    } catch (submitError) {
      toast({
        title: "Could not post warning",
        description: submitError instanceof Error ? submitError.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function guard(action: () => Promise<void>) {
    try {
      await action();
    } catch (actionError) {
      toast({
        title: "Action failed",
        description: actionError instanceof Error ? actionError.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  async function moderate(
    warningId: string,
    status: "active" | "false_alarm",
  ) {
    const note = window.prompt(
      status === "active"
        ? "Optional verification note"
        : "Why is this being marked as a false alarm?",
      "",
    );
    if (note === null) return;
    await guard(() => setStatus(warningId, status, note));
  }

  return (
    <SafeBenueLayout
      title="Community Watch"
      description="A local early-warning network where residents report what they see, nearby members confirm sightings, and authorized AIJE moderators verify signals before they become active alerts."
    >
      <div className="space-y-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Verified alerts</p>
              <p className="mt-1 text-2xl font-semibold">{stats.active}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Awaiting verification</p>
              <p className="mt-1 text-2xl font-semibold">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Community confirmations</p>
              <p className="mt-1 text-2xl font-semibold">{stats.confirmations}</p>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Report what you see</CardTitle>
              <p className="text-sm text-muted-foreground">
                New reports start as community signals and do not become official alerts until verified.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ew-title">Headline</Label>
                  <Input
                    id="ew-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Suspicious movement near market road"
                    minLength={3}
                    maxLength={160}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ew-desc">What is happening?</Label>
                  <Textarea
                    id="ew-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    minLength={3}
                    maxLength={2000}
                    placeholder="Describe only what you directly observed."
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ew-community">Community</Label>
                    <Input
                      id="ew-community"
                      value={community}
                      onChange={(e) => setCommunity(e.target.value)}
                      placeholder="Wurukum"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ew-ward">Ward</Label>
                    <Input id="ew-ward" value={ward} onChange={(e) => setWard(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((value) => (
                          <SelectItem key={value} value={value} className="capitalize">
                            {value.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Severity</Label>
                    <Select
                      value={severity}
                      onValueChange={(value) => setSeverity(value as WarningSeverity)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(["low", "medium", "high", "critical"] as WarningSeverity[]).map((value) => (
                          <SelectItem key={value} value={value} className="capitalize">
                            {value}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="rounded-lg border border-dashed p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Incident location</p>
                      <p className="text-xs text-muted-foreground">
                        Optional. Attach an approximate GPS point to help responders map the signal.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={captureLocation}
                      disabled={gettingLocation}
                    >
                      {gettingLocation ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <LocateFixed className="mr-2 h-4 w-4" />
                      )}
                      {latitude !== null ? "Update location" : "Use my location"}
                    </Button>
                  </div>
                  {latitude !== null && longitude !== null ? (
                    <p className="mt-2 text-xs text-success">
                      Location attached · accuracy about {Math.round(locationAccuracy ?? 0)} m
                    </p>
                  ) : null}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Submit community warning
                </Button>
                <p className="text-xs text-muted-foreground">
                  Do not confront suspected offenders. Use the main incident report flow for urgent emergencies or evidence.
                </p>
                <Button asChild type="button" variant="outline" className="w-full">
                  <Link to={APP_PATHS.incidentReport}>Open full incident report</Link>
                </Button>
                {!userId ? (
                  <p className="text-xs text-muted-foreground">
                    Sign in to post warnings and confirm sightings.
                  </p>
                ) : null}
              </form>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Radio className="h-4 w-4 text-primary" />
                  Community signal feed
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | WarningStatus)}>
                    <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      {(Object.keys(STATUS_LABELS) as WarningStatus[]).map((value) => (
                        <SelectItem key={value} value={value}>{STATUS_LABELS[value]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {CATEGORIES.map((value) => (
                        <SelectItem key={value} value={value} className="capitalize">
                          {value.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="rounded-lg bg-secondary/40 p-3 text-sm text-muted-foreground">
                <strong className="text-foreground">How Community Watch works:</strong>{" "}
                Report → community confirmations → moderator verification → active alert → resolved or false alarm.
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading community signals…</p>
              ) : error ? (
                <p className="text-sm text-muted-foreground">
                  Feed unavailable. Sign in to view community early warnings.
                </p>
              ) : visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No signals match the selected filters.
                </p>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {visible.map((warning) => {
                      const resolved = warning.status === "resolved" || warning.status === "false_alarm";
                      const pending = warning.status === "pending";
                      const tone = resolved
                        ? "border-success/30 text-success"
                        : pending
                          ? "border-warning/30 text-warning"
                          : severityTone[warning.severity];
                      const Icon = resolved ? CheckCircle2 : pending ? Clock3 : ShieldAlert;
                      const confirmed = myConfirmations.has(warning.id);
                      const confirmationsForWarning = confirmationCounts.get(warning.id) ?? 0;

                      return (
                        <motion.article
                          key={warning.id}
                          layout
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 8 }}
                          transition={{ duration: 0.25 }}
                          className={`rounded-lg border bg-secondary/30 p-3 ${tone.split(" ")[0]}`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone.split(" ")[1]}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">{warning.title}</p>
                                <Badge variant="outline" className="capitalize">
                                  {warning.category.replace("_", " ")}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {warning.severity}
                                </Badge>
                                <Badge variant="outline">{STATUS_LABELS[warning.status]}</Badge>
                              </div>
                              <p className="mt-1 text-sm leading-snug text-muted-foreground">
                                {warning.description}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {warning.community}
                                  {warning.ward ? ` · ${warning.ward}` : ""}
                                </span>
                                <span>•</span>
                                <span className="font-mono">{timeAgo(warning.created_at)}</span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {confirmationsForWarning} confirmed
                                </span>
                                {warning.latitude !== null && warning.longitude !== null ? (
                                  <>
                                    <span>•</span>
                                    <span>GPS attached</span>
                                  </>
                                ) : null}
                              </div>
                              {warning.verified_at ? (
                                <p className="mt-2 text-xs text-success">
                                  Verified by an authorized moderator {timeAgo(warning.verified_at)}.
                                  {warning.moderator_note ? ` ${warning.moderator_note}` : ""}
                                </p>
                              ) : null}

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant={confirmed ? "secondary" : "outline"}
                                  onClick={() => void guard(() => toggleConfirmation(warning.id))}
                                  disabled={resolved}
                                >
                                  {confirmed ? <Check className="mr-1.5 h-3.5 w-3.5" /> : null}
                                  {confirmed ? "Confirmed by you" : "I can confirm this"}
                                </Button>

                                {warning.author_id === userId && warning.status === "active" ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void guard(() => setStatus(warning.id, "resolved"))}
                                  >
                                    Mark resolved
                                  </Button>
                                ) : null}

                                {warning.author_id === userId && warning.status === "pending" ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void guard(() => setStatus(warning.id, "false_alarm"))}
                                  >
                                    Mark false alarm
                                  </Button>
                                ) : null}

                                {isModerator && pending ? (
                                  <>
                                    <Button
                                      size="sm"
                                      onClick={() => void moderate(warning.id, "active")}
                                    >
                                      <Check className="mr-1.5 h-3.5 w-3.5" />
                                      Verify alert
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => void moderate(warning.id, "false_alarm")}
                                    >
                                      <X className="mr-1.5 h-3.5 w-3.5" />
                                      Reject
                                    </Button>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </SafeBenueLayout>
  );
}
