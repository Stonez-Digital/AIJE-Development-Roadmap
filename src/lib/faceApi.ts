/**
 * Lazy loader + helpers for @vladmandic/face-api.
 * All matching is on-device. Only 128-d descriptors leave the browser
 * (synced to Cloud), never raw images.
 */
const MODEL_URL = "https://vladmandic.github.io/face-api/model";

let loadPromise: Promise<void> | null = null;
let faceApiPromise: Promise<typeof import("@vladmandic/face-api")> | null =
  null;

function loadFaceApi() {
  faceApiPromise ??= import("@vladmandic/face-api");
  return faceApiPromise;
}

export async function ensureFaceModels(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const faceapi = await loadFaceApi();
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  })();
  return loadPromise;
}

export type Descriptor = number[];

export async function describeFromImage(
  img: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
): Promise<Descriptor | null> {
  await ensureFaceModels();
  const faceapi = await loadFaceApi();
  const result = await faceapi
    .detectSingleFace(
      img as HTMLImageElement,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.5,
      }),
    )
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!result) return null;
  return Array.from(result.descriptor);
}

export async function describeAllFromVideo(
  video: HTMLVideoElement,
): Promise<Descriptor[]> {
  await ensureFaceModels();
  const faceapi = await loadFaceApi();
  const results = await faceapi
    .detectAllFaces(
      video,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 224,
        scoreThreshold: 0.5,
      }),
    )
    .withFaceLandmarks()
    .withFaceDescriptors();
  return results.map((r) => Array.from(r.descriptor));
}

/** Euclidean distance between two 128-d face descriptors. */
export function descriptorDistance(a: Descriptor, b: Descriptor): number {
  if (a.length !== b.length) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Returns best match or null. Lower distance = better. threshold ≈ 0.5–0.6. */
export function findBestMatch(
  descriptor: Descriptor,
  candidates: Array<{ id: string; label: string; descriptor: Descriptor }>,
  threshold: number,
): { id: string; label: string; distance: number } | null {
  let best: { id: string; label: string; distance: number } | null = null;
  for (const c of candidates) {
    const d = descriptorDistance(descriptor, c.descriptor);
    if (!best || d < best.distance)
      best = { id: c.id, label: c.label, distance: d };
  }
  if (!best || best.distance > threshold) return null;
  return best;
}
