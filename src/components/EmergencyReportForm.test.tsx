import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { EmergencyReportForm } from "./EmergencyReportForm";

const getUserMedia = vi.fn();

vi.mock("../hooks/useGeolocation", () => ({
  useGeolocation: () => ({
    status: "idle",
    location: {},
    requestLocation: vi.fn(),
  }),
}));

vi.mock("../lib/imageUtils", () => ({
  filesToReportImages: vi.fn(),
  fileToReportImage: vi.fn(async (file: File) => ({
    id: "video-1",
    kind: "video",
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    dataUrl: "data:video/webm;base64,AA==",
  })),
}));

class MockMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  mimeType = "video/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

  start() {
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob(["test-video"], { type: "video/webm" }) });
      this.stop();
    });
  }

  stop() {
    this.onstop?.();
  }
}

describe("EmergencyReportForm video recording", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    getUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    });
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: MockMediaRecorder,
    });
  });

  it("starts the recorder when Record Video is clicked", async () => {
    render(<EmergencyReportForm onSubmitReport={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("e.g. Armed men entering Ochekwu village"), { target: { value: "Test incident" } });
    fireEvent.change(screen.getByPlaceholderText("Describe what you see or know"), { target: { value: "This is a test incident description." } });
    fireEvent.click(screen.getByRole("button", { name: /Attack/i }));
    fireEvent.change(screen.getByPlaceholderText("Or type the location (e.g. nearest landmark, village)"), { target: { value: "Otukpo" } });

    const recordButton = screen.getByRole("button", { name: "Record Video" });
    fireEvent.click(recordButton);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({ facingMode: { ideal: "environment" } }),
        audio: true,
      }),
    );
  });
});
