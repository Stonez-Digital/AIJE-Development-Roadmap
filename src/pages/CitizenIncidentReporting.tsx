import { useEffect } from "react";
import { Header } from "@/components/dashboard/Header";
import { EmergencyReportForm } from "@/components/EmergencyReportForm";
import { SyncStatusPanel } from "@/components/SyncStatusPanel";
import {
  registerIncidentReportSync,
  submitIncidentReport,
} from "@/lib/incidentReportSync";
import type { EmergencyReport } from "@/types/report";

export default function CitizenIncidentReporting() {
  useEffect(() => {
    registerIncidentReportSync();
  }, []);

  function handleSubmitReport(report: EmergencyReport) {
    return submitIncidentReport(report);
  }

  return (
    <>
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Citizen Incident Reporting
          </h1>

          <p className="mt-2 max-w-3xl text-muted-foreground">
            Report attacks, kidnappings, fires, flooding, medical emergencies,
            accidents, and other incidents within your community. Online reports
            are sent to the configured incident intake organization; offline
            reports remain on this device until delivery can be confirmed.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <EmergencyReportForm onSubmitReport={handleSubmitReport} />
          <SyncStatusPanel />
        </div>
      </main>
    </>
  );
}
