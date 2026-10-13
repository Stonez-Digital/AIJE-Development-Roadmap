import type { Database } from "@/integrations/supabase/types";

export type PublicAnnouncement =
  Database["public"]["Tables"]["emergency_public_announcements"]["Row"];

export const ANNOUNCEMENT_CATEGORIES = [
  { value: "security_advisory", label: "Security advisory" },
  { value: "public_safety", label: "Public safety notice" },
  { value: "missing_person", label: "Missing person" },
  { value: "shelter_update", label: "Shelter update" },
  { value: "medical_advisory", label: "Medical advisory" },
  { value: "fire_warning", label: "Fire warning" },
  { value: "flood_warning", label: "Flood warning" },
  { value: "road_closure", label: "Road closure" },
  { value: "community_notice", label: "Community notice" },
  { value: "preparedness", label: "Emergency preparedness" },
] as const;

export const ANNOUNCEMENT_PRIORITIES = [
  { value: "informational", label: "Informational" },
  { value: "advisory", label: "Advisory" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
] as const;

export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number]["value"];
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number]["value"];
export type AnnouncementStatus = "draft" | "published" | "archived";

export function categoryLabel(category: string) {
  return ANNOUNCEMENT_CATEGORIES.find((item) => item.value === category)?.label ?? category;
}

export function priorityLabel(priority: string) {
  return ANNOUNCEMENT_PRIORITIES.find((item) => item.value === priority)?.label ?? priority;
}

export function formatAnnouncementDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
