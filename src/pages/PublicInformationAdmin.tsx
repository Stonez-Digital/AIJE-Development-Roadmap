import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FilePlus2, Pencil, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITIES,
  categoryLabel,
  formatAnnouncementDate,
  priorityLabel,
  type AnnouncementCategory,
  type AnnouncementPriority,
  type AnnouncementStatus,
  type PublicAnnouncement,
} from "@/types/publicInformation";

type Draft = {
  title: string;
  summary: string;
  body: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  status: AnnouncementStatus;
  publishing_authority: string;
  language_code: string;
  published_at: string;
  expires_at: string;
  person_name: string;
  person_photo_url: string;
  last_known_location: string;
  last_seen_at: string;
  person_description: string;
  contact_information: string;
  person_status: "missing" | "found" | "closed" | "";
};

const blankDraft = (): Draft => ({
  title: "", summary: "", body: "", category: "community_notice", priority: "informational",
  status: "draft", publishing_authority: "", language_code: "en", published_at: "",
  expires_at: "", person_name: "", person_photo_url: "", last_known_location: "",
  last_seen_at: "", person_description: "", contact_information: "", person_status: "missing",
});

const toLocalDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function PublicInformationAdmin() {
  const [items, setItems] = useState<PublicAnnouncement[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.from("emergency_public_announcements").select("*").order("updated_at", { ascending: false }).limit(200);
    if (error) {
      setLoadError("You may not have publishing permission, or the announcements table has not been migrated yet.");
      setItems([]);
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const setField = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const startEdit = (item: PublicAnnouncement) => {
    setEditingId(item.id);
    setDraft({
      title: item.title, summary: item.summary, body: item.body,
      category: item.category as AnnouncementCategory, priority: item.priority as AnnouncementPriority,
      status: item.status as AnnouncementStatus, publishing_authority: item.publishing_authority,
      language_code: item.language_code, published_at: toLocalDateTime(item.published_at),
      expires_at: toLocalDateTime(item.expires_at), person_name: item.person_name ?? "",
      person_photo_url: item.person_photo_url ?? "", last_known_location: item.last_known_location ?? "",
      last_seen_at: toLocalDateTime(item.last_seen_at), person_description: item.person_description ?? "",
      contact_information: item.contact_information ?? "", person_status: (item.person_status as Draft["person_status"]) ?? "missing",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => { setEditingId(null); setDraft(blankDraft()); };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.category === "missing_person" && draft.status === "published" && (!draft.person_name.trim() || !draft.last_known_location.trim() || !draft.last_seen_at || !draft.contact_information.trim())) {
      toast.error("Published missing-person notices need a name, last known location, last-seen time, and contact information.");
      return;
    }
    setSaving(true);
    const publishedAt = draft.status === "published" ? (draft.published_at ? new Date(draft.published_at).toISOString() : new Date().toISOString()) : (draft.published_at ? new Date(draft.published_at).toISOString() : null);
    const payload = {
      title: draft.title.trim(), summary: draft.summary.trim(), body: draft.body.trim(),
      category: draft.category, priority: draft.priority, status: draft.status,
      publishing_authority: draft.publishing_authority.trim(), language_code: draft.language_code.trim() || "en",
      published_at: publishedAt, expires_at: draft.expires_at ? new Date(draft.expires_at).toISOString() : null,
      person_name: draft.category === "missing_person" ? draft.person_name.trim() || null : null,
      person_photo_url: draft.category === "missing_person" ? draft.person_photo_url.trim() || null : null,
      last_known_location: draft.category === "missing_person" ? draft.last_known_location.trim() || null : null,
      last_seen_at: draft.category === "missing_person" && draft.last_seen_at ? new Date(draft.last_seen_at).toISOString() : null,
      person_description: draft.category === "missing_person" ? draft.person_description.trim() || null : null,
      contact_information: draft.category === "missing_person" ? draft.contact_information.trim() || null : null,
      person_status: draft.category === "missing_person" ? draft.person_status || "missing" : null,
    };
    const result = editingId
      ? await supabase.from("emergency_public_announcements").update(payload).eq("id", editingId)
      : await supabase.from("emergency_public_announcements").insert(payload);
    if (result.error) {
      toast.error(result.error.message.includes("row-level security") ? "Your account is not authorized to publish public information." : "Could not save this announcement. Check required fields and publishing permissions.");
    } else {
      toast.success(editingId ? "Announcement updated." : "Announcement saved.");
      reset();
      await loadItems();
    }
    setSaving(false);
  };

  const setStatus = async (item: PublicAnnouncement, status: AnnouncementStatus) => {
    const update = {
      status,
      published_at: status === "published" ? item.published_at ?? new Date().toISOString() : item.published_at,
    };
    const { error } = await supabase.from("emergency_public_announcements").update(update).eq("id", item.id);
    if (error) toast.error("Could not change publication status. Check your permissions.");
    else { toast.success(status === "archived" ? "Announcement archived." : status === "published" ? "Announcement published." : "Announcement returned to draft."); await loadItems(); }
  };

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> AIJE Community Shield</div><h1 className="mt-2 text-3xl font-bold">Public information administration</h1><p className="mt-2 max-w-2xl text-muted-foreground">Draft, schedule, publish, and archive official community information. Only authorized publishers can save changes.</p></div>
        <Button type="button" variant="outline" onClick={() => void loadItems()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />Refresh</Button>
      </header>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2">{editingId ? <Pencil className="h-5 w-5" aria-hidden="true" /> : <FilePlus2 className="h-5 w-5" aria-hidden="true" />}{editingId ? "Edit announcement" : "Create announcement"}</CardTitle><CardDescription>Published notices are public. If a future publication date is selected, the notice stays hidden until that time.</CardDescription></CardHeader>
        <CardContent>
          <form onSubmit={(event) => void save(event)} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="announcement-title">Title</Label><Input id="announcement-title" required minLength={3} maxLength={180} value={draft.title} onChange={(event) => setField("title", event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="announcement-authority">Publishing authority</Label><Input id="announcement-authority" required minLength={2} maxLength={160} placeholder="e.g. Otukpo LGA Emergency Desk" value={draft.publishing_authority} onChange={(event) => setField("publishing_authority", event.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="announcement-summary">Short summary</Label><Textarea id="announcement-summary" required minLength={5} maxLength={360} rows={2} value={draft.summary} onChange={(event) => setField("summary", event.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2"><Label htmlFor="announcement-category">Category</Label><select id="announcement-category" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.category} onChange={(event) => setField("category", event.target.value as AnnouncementCategory)}>{ANNOUNCEMENT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="announcement-priority">Priority</Label><select id="announcement-priority" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.priority} onChange={(event) => setField("priority", event.target.value as AnnouncementPriority)}>{ANNOUNCEMENT_PRIORITIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div className="space-y-2"><Label htmlFor="announcement-status">Status</Label><select id="announcement-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.status} onChange={(event) => setField("status", event.target.value as AnnouncementStatus)}><option value="draft">Draft</option><option value="published">Published / scheduled</option><option value="archived">Archived</option></select></div>
              <div className="space-y-2"><Label htmlFor="announcement-language">Language code</Label><Input id="announcement-language" pattern="[a-z]{2}(-[A-Z]{2})?" value={draft.language_code} onChange={(event) => setField("language_code", event.target.value)} /><p className="text-xs text-muted-foreground">Use en for English; Idoma can be added as a separate language code.</p></div>
            </div>
            <div className="space-y-2"><Label htmlFor="announcement-body">Full message</Label><Textarea id="announcement-body" required minLength={10} maxLength={12000} rows={7} value={draft.body} onChange={(event) => setField("body", event.target.value)} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="announcement-published-at">Publication date and time</Label><Input id="announcement-published-at" type="datetime-local" value={draft.published_at} onChange={(event) => setField("published_at", event.target.value)} /><p className="text-xs text-muted-foreground">Leave blank to publish immediately when status is Published.</p></div>
              <div className="space-y-2"><Label htmlFor="announcement-expires-at">Expiry date and time (optional)</Label><Input id="announcement-expires-at" type="datetime-local" value={draft.expires_at} onChange={(event) => setField("expires_at", event.target.value)} /></div>
            </div>
            {draft.category === "missing_person" && <fieldset className="space-y-4 rounded-lg border p-4"><legend className="px-2 font-semibold">Missing-person notice details</legend><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="person-name">Name</Label><Input id="person-name" value={draft.person_name} onChange={(event) => setField("person_name", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="person-photo">Photograph URL (optional)</Label><Input id="person-photo" type="url" value={draft.person_photo_url} onChange={(event) => setField("person_photo_url", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="person-location">Last known location</Label><Input id="person-location" value={draft.last_known_location} onChange={(event) => setField("last_known_location", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="person-last-seen">Date and time last seen</Label><Input id="person-last-seen" type="datetime-local" value={draft.last_seen_at} onChange={(event) => setField("last_seen_at", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="person-status">Current status</Label><select id="person-status" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.person_status} onChange={(event) => setField("person_status", event.target.value as Draft["person_status"])}><option value="missing">Missing</option><option value="found">Found</option><option value="closed">Closed</option></select></div><div className="space-y-2"><Label htmlFor="person-contact">Contact information</Label><Input id="person-contact" value={draft.contact_information} onChange={(event) => setField("contact_information", event.target.value)} /></div></div><div className="space-y-2"><Label htmlFor="person-description">Description</Label><Textarea id="person-description" rows={3} value={draft.person_description} onChange={(event) => setField("person_description", event.target.value)} /></div><p className="text-xs text-muted-foreground">Only publish missing-person details that the responsible authority is permitted to share publicly.</p></fieldset>}
            <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : <><Save className="mr-2 h-4 w-4" aria-hidden="true" />{editingId ? "Save changes" : "Save announcement"}</>}</Button>{editingId && <Button type="button" variant="outline" onClick={reset}>Cancel edit</Button>}</div>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4"><div><h2 className="text-2xl font-bold">Announcements</h2><p className="text-sm text-muted-foreground">Review publication state, update notices, or archive outdated information.</p></div>
        {loading && <p role="status" className="text-muted-foreground">Loading announcements…</p>}
        {loadError && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">{loadError}</div>}
        {!loading && !loadError && items.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">No announcements yet.</CardContent></Card>}
        <div className="grid gap-3 md:grid-cols-2">{items.map((item) => {
          const expired = Boolean(item.expires_at && new Date(item.expires_at).getTime() <= Date.now());
          const scheduled = item.status === "published" && Boolean(item.published_at && new Date(item.published_at).getTime() > Date.now());
          const stateLabel = expired ? "Expired" : scheduled ? "Scheduled" : item.status;
          return <Card key={item.id}><CardHeader><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border px-2 py-1 text-xs">{categoryLabel(item.category)}</span><span className="rounded-full border px-2 py-1 text-xs">{priorityLabel(item.priority)}</span><span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{stateLabel}</span></div><CardTitle className="text-lg">{item.title}</CardTitle><CardDescription>{item.summary}</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">By {item.publishing_authority} · Published: {formatAnnouncementDate(item.published_at)}{item.expires_at ? ` · Expires: ${formatAnnouncementDate(item.expires_at)}` : ""}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}><Pencil className="mr-2 h-4 w-4" aria-hidden="true" />Edit</Button>{item.status !== "published" && <Button type="button" size="sm" onClick={() => void setStatus(item, "published")}>Publish</Button>}{item.status !== "draft" && <Button type="button" size="sm" variant="outline" onClick={() => void setStatus(item, "draft")}>Unpublish</Button>}{item.status !== "archived" && <Button type="button" size="sm" variant="destructive" onClick={() => void setStatus(item, "archived")}>Archive</Button>}</div></CardContent></Card>;
        })}</div>
      </section>
    </main>
  );
}
