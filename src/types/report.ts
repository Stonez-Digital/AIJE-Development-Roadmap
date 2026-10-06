// types/report.ts

export type EmergencyCategoryId =
  | "attack" | "kidnapping" | "fire" | "flood" | "medical" | "accident"
  | "crime" | "building_collapse" | "missing_person" | "road_damage"
  | "power_outage" | "water_issue";

export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface ReportLocation {
  lat?: number;
  lng?: number;
  accuracyMetres?: number;
  address?: string;
  manualEntry?: string;
}

export type ReportEvidenceKind = "image" | "video";

export interface ReportImage {
  id: string;
  dataUrl: string;
  fileName: string;
  sizeBytes: number;
  kind: ReportEvidenceKind;
}

export type ReportEvidence = ReportImage;

export interface EmergencyReport {
  id: string;
  title: string;
  category: EmergencyCategoryId;
  description: string;
  timestamp: string;
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
