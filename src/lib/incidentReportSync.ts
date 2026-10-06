// Offline-safe submission path for citizen incident reports.
//
// Reports are sent to the configured operational intake and queued in IndexedDB
// (see lib/syncEngine.ts) when the server cannot confirm receipt.

import { supabase } from "@/integrations/supabase/client";
import { enqueue, registerSyncHandler } from "./syncEngine";
import type {
  EmergencyReport,
  IncidentSubmissionResult,
} from "@/types/report";

export const INCIDENT_REPORT_COLLECTION = "incident_reports";

let registered = false;

export function registerIncidentReportSync() {
  if (registered) return;
  registered = true;

  registerSyncHandler<EmergencyReport>(
    INCIDENT_REPORT_COLLECTION,
    async (report) => {
      const { data, error } = await supabase.functions.invoke(
        "submit-incident-report",
        { body: report },
      );
      if (error) throw error;
      if (!data || data.accepted !== true) {
        throw new Error("The incident intake endpoint rejected the report");
      }
    },
  );
}

/** Submit to the server when possible; otherwise persist an offline retry. */
export async function submitIncidentReport(
  report: EmergencyReport,
): Promise<IncidentSubmissionResult> {
  registerIncidentReportSync();
  const reportForDelivery: EmergencyReport = {
    ...report,
    images: (report.images ?? []).map((img) => ({ ...img, dataUrl: "" })),
  };

  if (navigator.onLine) {
    try {
      const { data, error } = await supabase.functions.invoke(
        "submit-incident-report",
        { body: reportForDelivery },
      );
      if (!error && data?.accepted === true) {
        return { status: "received", receiptId: report.id };
      }
    } catch {
      // Persist below; the sync handler will retry with the same idempotency ID.
    }
  }

  await enqueue(INCIDENT_REPORT_COLLECTION, reportForDelivery);
  return { status: "queued", receiptId: report.id };
}
