// lib/imageUtils.ts
import imageCompression from "browser-image-compression";
import type { ReportImage } from "../types/report";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1280,
  useWebWorker: true,
};

const MAX_VIDEO_BYTES = 3 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Unable to read evidence file"));
    reader.onerror = () =>
      reject(reader.error ?? new Error("Unable to read evidence file"));
    reader.readAsDataURL(file);
  });
}

export async function fileToReportImage(file: File): Promise<ReportImage> {
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO_BYTES) {
      throw new Error("Each video evidence clip must be 3 MB or smaller.");
    }
    return {
      id: crypto.randomUUID(),
      dataUrl: await fileToDataUrl(file),
      fileName: file.name,
      sizeBytes: file.size,
      kind: "video",
    };
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only images and videos can be attached as report evidence.");
  }

  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
  return {
    id: crypto.randomUUID(),
    dataUrl: await imageCompression.getDataUrlFromFile(compressed),
    fileName: file.name,
    sizeBytes: compressed.size,
    kind: "image",
  };
}

export async function filesToReportImages(
  files: FileList | File[],
): Promise<ReportImage[]> {
  const fileArray = Array.from(files);
  const evidence = await Promise.all(fileArray.map(fileToReportImage));
  const totalBytes = evidence.reduce((sum, item) => sum + item.sizeBytes, 0);
  if (totalBytes > 4 * 1024 * 1024) {
    throw new Error("Report evidence is limited to 4 MB per report.");
  }
  return evidence;
}
