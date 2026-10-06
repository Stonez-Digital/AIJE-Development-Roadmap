import { beforeEach, describe, expect, it, vi } from "vitest";

const { enqueue, invoke, registerSyncHandler } = vi.hoisted(() => ({
  enqueue: vi.fn(),
  invoke: vi.fn(),
  registerSyncHandler: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

vi.mock("@/lib/syncEngine", () => ({
  enqueue,
  registerSyncHandler,
}));

import { submitIncidentReport } from "@/lib/incidentReportSync";
import type { EmergencyReport } from "@/types/report";

const report: EmergencyReport = {
  id: "a0d62aa0-1653-4c85-8e2a-384bd46f4239",
  title: "Market fire",
  category: "fire",
  description: "Smoke and flames are visible near the market entrance.",
  timestamp: "2026-10-06T10:00:00.000Z",
  location: { address: "Central market" },
  images: [
    {
      id: "image-1",
      dataUrl: "data:image/jpeg;base64,private-image-content",
      fileName: "scene.jpg",
      sizeBytes: 42,
    },
  ],
  syncStatus: "pending",
};

describe("citizen incident report delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    enqueue.mockResolvedValue("queue-item-1");
  });

  it("reports receipt only after the server confirms operational intake", async () => {
    invoke.mockResolvedValue({
      data: { accepted: true, receiptId: report.id },
      error: null,
    });

    await expect(submitIncidentReport(report)).resolves.toEqual({
      status: "received",
      receiptId: report.id,
    });
    expect(invoke).toHaveBeenCalledWith(
      "submit-incident-report",
      expect.objectContaining({
        body: expect.objectContaining({
          id: report.id,
          images: [
          expect.objectContaining({ dataUrl: report.images?.[0]?.dataUrl }),
        ],
        }),
      }),
    );
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("queues failures locally and does not claim delivery", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("offline") });

    await expect(submitIncidentReport(report)).resolves.toEqual({
      status: "queued",
      receiptId: report.id,
    });
    expect(enqueue).toHaveBeenCalledWith(
      "incident_reports",
      expect.objectContaining({
        id: report.id,
        images: [expect.objectContaining({ dataUrl: "" })],
      }),
    );
  });

  it("queues offline reports without invoking the endpoint", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await expect(submitIncidentReport(report)).resolves.toMatchObject({
      status: "queued",
      receiptId: report.id,
    });
    expect(invoke).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledOnce();
  });
});
