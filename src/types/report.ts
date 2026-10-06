// types/report.ts
//
// This is the CONTRACT between the Citizen Incident Reporting module (Christopher)
// and the Offline Synchronization module (Samuel).
//
// The form's job: produce a valid EmergencyReport object and hand it off.
// Samuel's job: persist it (IndexedDB), queue it, sync it, retry it, and update syncStatus.
//
// Do not add sync/storage logic here — only the shape of the data.

export type EmergencyCategoryId =
  | "attack"
  | "kidnapping"
  | "fire"
  | "flood"
  | "medical"
  | "accident"
  | "crime"
  | "building_collapse"
  | "missing_person"
  | "road_damage"
  | "power_outage"
  | "water_issue";

export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface ReportLocation {
  lat?: number;
  lng?: number;
  accuracyMetres?: number;
  address?: string; // reverse-geocoded, if available
  manualEntry?: string; // used when GPS is denied/unavailable
}

export interface ReportImage {
  id: string;
  dataUrl: string;
  fileName: string;
  sizeBytes: number;
}

export interface EmergencyReport {
  id: string; // client-generated UUID (crypto.randomUUID())
  title: string;
  category: EmergencyCategoryId;
  description: string;
  timestamp: string; // ISO 8601, auto-generated at submit time
  location: ReportLocation;
  contact?: string;
  images: ReportImage[];
  syncStatus: SyncStatus;
}

export interface IncidentSubmissionResult {
  status: "received" | "queued";
  receiptId: string;
}

export interface EmergencyReportFormValues {
  title: string;
  category: EmergencyCategoryId;
  description: string;
  contact?: string;
  location: ReportLocation;
  images: ReportImage[];
}
