import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, ShieldAlert, MapPin, CheckCircle2, Loader2, Users } from "lucide-react";
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
import {
  useEarlyWarnings,
  type WarningSeverity,
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
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "active">("active");

  const visible = warnings.filter((w) => (filter === "active" ? w.status === "active" : true));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await postWarning({ title, description, community, ward, category, severity });
      setTitle("");
      setDescription("");
      setWard("");
      toast({ title: "Community warning submitted", description: "The signal is visible to the community. Confirmations help establish whether it reflects a real local event." });
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

  return (
    <SafeBenueLayout
      title="Community Watch"
      description="Community-driven early warning feed. Reports remain community signals until people confirm what they can see; operational verification stays with authorized AIJE operators."
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Post an early warning</CardTitle>
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
                  <Label htmlFor="ew-ward">Ward (optional)</Label>
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
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit community warning
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
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Radio className="h-4 w-4 text-primary" />
              Live early warning feed
            </CardTitle>
            <div className="flex gap-1">
              {(["active", "all"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? "secondary" : "ghost"}
                  onClick={() => setFilter(value)}
                  className="capitalize"
                >
                  {value}
                </Button>
              ))}
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
                No {filter === "active" ? "active " : ""}community warnings yet — new signals appear here in real time.
              </p>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {visible.map((warning) => {
                    const resolved = warning.status !== "active";
                    const tone = resolved
                      ? "border-success/30 text-success"
                      : severityTone[warning.severity];
                    const Icon = resolved ? CheckCircle2 : ShieldAlert;
                    const confirmed = myConfirmations.has(warning.id);
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
                              {resolved ? (
                                <Badge variant="outline" className="capitalize">
                                  {warning.status.replace("_", " ")}
                                </Badge>
                              ) : null}
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
                                {confirmationCounts.get(warning.id) ?? 0} confirmed
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant={confirmed ? "secondary" : "outline"}
                                onClick={() => void guard(() => toggleConfirmation(warning.id))}
                              >
                                {confirmed ? "Confirmed by you" : "I can confirm this"}
                              </Button>
                              {warning.author_id === userId && !resolved ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void guard(() => setStatus(warning.id, "resolved"))}
                                  >
                                    Mark resolved
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => void guard(() => setStatus(warning.id, "false_alarm"))}
                                  >
                                    False alarm
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
    </SafeBenueLayout>
  );
}
