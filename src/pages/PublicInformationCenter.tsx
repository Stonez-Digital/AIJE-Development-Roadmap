import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BookOpenText, CalendarClock, CheckCircle2, Info, MapPin, Search, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITIES,
  categoryLabel,
  formatAnnouncementDate,
  priorityLabel,
  type PublicAnnouncement,
} from "@/types/publicInformation";

const preparednessGuides = [
  { title: "During a security incident", text: "Move away from immediate danger if you can do so safely. Follow verified instructions from authorized responders, avoid sharing unconfirmed claims, and contact local emergency services when safe." },
  { title: "Fire safety", text: "Raise the alarm, leave by a safe exit, stay low if there is smoke, and do not re-enter a burning building. Call the local fire service when it is safe." },
  { title: "Flood preparedness", text: "Move people and essential items to higher ground early. Do not walk or drive through floodwater, and follow official evacuation guidance." },
  { title: "Basic first aid", text: "Check that the scene is safe, call for trained medical help, and follow instructions from a qualified dispatcher. Do not move a seriously injured person unless danger makes it necessary." },
  { title: "Family emergency plan", text: "Agree on a safe meeting point, keep important contacts written down, plan for children and people needing assistance, and keep essential supplies ready." },
  { title: "Verify information before sharing", text: "Check the publishing authority and timestamp, compare with official sources, and do not forward unverified names, images, locations, or claims." },
];

const priorityStyles: Record<string, string> = {
  critical: "border-red-300 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  advisory: "border-blue-200 bg-blue-50 text-blue-900",
  informational: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function PublicInformationCenter() {
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [priority, setPriority] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("emergency_public_announcements")
        .select("*")
        .eq("status", "published")
        .lte("published_at", new Date().toISOString())
        .order("published_at", { ascending: false })
        .limit(100);
      if (!active) return;
      if (error) setLoadError("Public updates are temporarily unavailable. Please try again later.");
      else setAnnouncements((data ?? []).filter((item) => !item.expires_at || new Date(item.expires_at).getTime() > Date.now()));
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return announcements.filter((item) => {
      const matchesText = !needle || [item.title, item.summary, item.body, item.publishing_authority, item.last_known_location]
        .some((value) => value?.toLocaleLowerCase().includes(needle));
      return matchesText && (category === "all" || item.category === category) && (priority === "all" || item.priority === priority);
    });
  }, [announcements, search, category, priority]);

  const featured = visible.find((item) => item.priority === "critical");
  const regular = visible.filter((item) => item.id !== featured?.id);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-2xl border bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white sm:p-9">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200"><ShieldCheck className="h-5 w-5" aria-hidden="true" /> AIJE Community Shield</div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Emergency information centre</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-200">Verified community announcements, public safety guidance, shelter updates, and preparedness information. Always check the issuing authority and publication time.</p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-200">
          <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Published updates only</span>
          <span className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4" aria-hidden="true" /> Expired notices are hidden</span>
        </div>
      </section>

      {featured && (
        <section aria-label="Critical emergency announcement" className="rounded-xl border-2 border-red-300 bg-red-50 p-5 text-red-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-6 w-6 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide">Critical public information</p>
              <h2 className="mt-1 text-xl font-bold">{featured.title}</h2>
              <p className="mt-2">{featured.summary}</p>
              <p className="mt-2 text-sm">Issued by {featured.publishing_authority} · {formatAnnouncementDate(featured.published_at)}</p>
              <Button variant="outline" className="mt-3 border-red-300 bg-white text-red-950 hover:bg-red-100" onClick={() => setExpandedId(expandedId === featured.id ? null : featured.id)}>
                {expandedId === featured.id ? "Hide details" : "Read full announcement"}
              </Button>
              {expandedId === featured.id && <p className="mt-3 whitespace-pre-wrap leading-7">{featured.body}</p>}
            </div>
          </div>
        </section>
      )}

      <section aria-labelledby="announcements-heading" className="space-y-4">
        <div>
          <h2 id="announcements-heading" className="text-2xl font-bold">Latest public updates</h2>
          <p className="mt-1 text-muted-foreground">Search and filter active announcements from verified publishing authorities.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input aria-label="Search announcements" className="pl-9" placeholder="Search announcements…" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <select aria-label="Filter by category" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {ANNOUNCEMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select aria-label="Filter by priority" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="all">All priorities</option>
            {ANNOUNCEMENT_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>

        {loading && <p role="status" className="py-8 text-center text-muted-foreground">Loading verified updates…</p>}
        {loadError && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">{loadError}</div>}
        {!loading && !loadError && visible.length === 0 && (
          <Card><CardContent className="flex flex-col items-center py-10 text-center"><Info className="h-8 w-8 text-muted-foreground" aria-hidden="true" /><p className="mt-3 font-semibold">No active announcements found</p><p className="mt-1 text-sm text-muted-foreground">Try another search or check back for verified updates.</p></CardContent></Card>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {regular.map((item) => (
            <Card key={item.id} className="h-full">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border px-2.5 py-1 text-xs font-medium">{categoryLabel(item.category)}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityStyles[item.priority] ?? priorityStyles.informational}`}>{priorityLabel(item.priority)}</span>
                </div>
                <CardTitle className="text-xl">{item.title}</CardTitle>
                <CardDescription>{item.summary}</CardDescription>
              </CardHeader>
              <CardContent>
                {item.category === "missing_person" && (
                  <div className="mb-4 space-y-2 rounded-lg bg-muted/50 p-3 text-sm">
                    {item.person_photo_url && <img src={item.person_photo_url} alt={item.person_name ? `Photograph of ${item.person_name}` : "Missing person"} loading="lazy" className="max-h-56 rounded-md object-contain" />}
                    {item.person_name && <p><strong>Name:</strong> {item.person_name}</p>}
                    {item.last_known_location && <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{item.last_known_location}</span></p>}
                    {item.last_seen_at && <p><strong>Last seen:</strong> {formatAnnouncementDate(item.last_seen_at)}</p>}
                    {item.person_description && <p>{item.person_description}</p>}
                    {item.contact_information && <p><strong>Contact:</strong> {item.contact_information}</p>}
                    {item.person_status && <p><strong>Status:</strong> {item.person_status}</p>}
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-7">{expandedId === item.id ? item.body : item.body.length > 180 ? `${item.body.slice(0, 180)}…` : item.body}</p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                  <span>{item.publishing_authority}</span><span>{formatAnnouncementDate(item.published_at)}</span>
                </div>
                {item.body.length > 180 && <Button variant="link" className="mt-2 h-auto px-0" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>{expandedId === item.id ? "Show less" : "Read more"}</Button>}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="preparedness-heading" className="space-y-4">
        <div className="flex items-center gap-3"><BookOpenText className="h-6 w-6 text-primary" aria-hidden="true" /><div><h2 id="preparedness-heading" className="text-2xl font-bold">Safety and preparedness library</h2><p className="text-sm text-muted-foreground">Short practical guidance designed for mobile and low-bandwidth access.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {preparednessGuides.map((guide) => <Card key={guide.title}><CardHeader><CardTitle className="text-base">{guide.title}</CardTitle></CardHeader><CardContent><p className="text-sm leading-6 text-muted-foreground">{guide.text}</p></CardContent></Card>)}
        </div>
        <p className="text-xs text-muted-foreground">Guidance is general information, not a substitute for instructions from qualified emergency services. Translation-ready content can be added through the language_code field.</p>
      </section>
    </main>
  );
}
