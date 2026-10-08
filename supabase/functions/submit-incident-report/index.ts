import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface IncidentPayload {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  description?: unknown;
  contact?: unknown;
  timestamp?: unknown;
  location?: {
    address?: unknown;
    lat?: unknown;
    lng?: unknown;
    manualEntry?: unknown;
  };
  images?: Array<{
    id?: unknown;
    dataUrl?: unknown;
    fileName?: unknown;
    sizeBytes?: unknown;
    kind?: unknown;
  }>;
}

async function adminStorageCleanup(paths: string[]) {
  if (paths.length === 0) return;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  await admin.storage.from("incident-evidence").remove(paths);
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function boundedString(value: unknown, min: number, max: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max
    ? normalized
    : null;
}

function parseEvidenceDataUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(
    /^data:(image\/(?:jpeg|png|webp|gif)|video\/(?:mp4|webm|quicktime));base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) return null;
  const contentType = match[1];
  return {
    contentType,
    kind: contentType.startsWith("video/") ? "video" : "image",
    base64: match[2],
  };
}

function extensionForContentType(contentType: string) {
  switch (contentType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    default:
      return "jpg";
  }
}

function decodedBase64Size(base64: string) {
  return (
    Math.floor((base64.length * 3) / 4) -
    (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0)
  );
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405);

  const correlationId = crypto.randomUUID();
  const uploadedPaths: string[] = [];
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 14_000_000)
      return json({ error: "Request too large", correlationId }, 413);

    const payload = (await request.json()) as IncidentPayload;
    const clientId = boundedString(payload.id, 8, 100);
    const title = boundedString(payload.title, 3, 160);
    const category = boundedString(payload.category, 2, 60);
    const description = boundedString(payload.description, 10, 3000);
    if (!clientId || !title || !category || !description) {
      return json({ error: "Invalid incident report", correlationId }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey)
      throw new Error("Service configuration missing");
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    let reporterId: string | null = null;
    if (accessToken) {
      const { data } = await admin.auth.getUser(accessToken);
      reporterId = data.user?.id ?? null;
    }

    const organizationId =
      Deno.env.get("INCIDENT_INTAKE_ORGANIZATION_ID")?.trim() ?? null;
    if (
      !organizationId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        organizationId,
      )
    ) {
      return json(
        {
          error: "Incident intake is not configured for this deployment",
          code: "INCIDENT_INTAKE_NOT_CONFIGURED",
          correlationId,
        },
        503,
      );
    }

    let clientHash: string | null = null;
    if (!reporterId) {
      const forwardedFor = request.headers
        .get("x-forwarded-for")
        ?.split(",")[0]
        ?.trim();
      clientHash = await sha256(
        `${forwardedFor ?? "unknown"}:${
          request.headers.get("user-agent") ?? "unknown"
        }`,
      );
    }

    const occurredAt =
      typeof payload.timestamp === "string" &&
      !Number.isNaN(Date.parse(payload.timestamp))
        ? payload.timestamp
        : new Date().toISOString();
    const contact = boundedString(payload.contact, 0, 100);
    const address = boundedString(payload.location?.address, 0, 300);
    const manualLocation = boundedString(payload.location?.manualEntry, 0, 300);
    const latitude =
      typeof payload.location?.lat === "number" &&
      payload.location.lat >= -90 &&
      payload.location.lat <= 90
        ? payload.location.lat
        : null;
    const longitude =
      typeof payload.location?.lng === "number" &&
      payload.location.lng >= -180 &&
      payload.location.lng <= 180
        ? payload.location.lng
        : null;

    const submittedEvidence = Array.isArray(payload.images)
      ? payload.images.slice(0, 5)
      : [];
    const evidenceUploads = submittedEvidence.map((evidence) => {
      const parsed = parseEvidenceDataUrl(evidence?.dataUrl);
      if (!parsed) throw new Error("Invalid incident evidence file");
      const sizeBytes = decodedBase64Size(parsed.base64);
      const maxBytes = parsed.kind === "video" ? 3 * 1024 * 1024 : 524288;
      if (sizeBytes <= 0 || sizeBytes > maxBytes) {
        throw new Error(
          parsed.kind === "video"
            ? "Incident evidence video exceeds the 3 MB limit"
            : "Incident evidence image exceeds the 512 KB limit",
        );
      }
      return {
        id: boundedString(evidence?.id, 8, 100) ?? crypto.randomUUID(),
        fileName: boundedString(evidence?.fileName, 1, 255) ?? "evidence",
        contentType: parsed.contentType,
        kind: parsed.kind,
        base64: parsed.base64,
        sizeBytes,
      };
    });
    const totalEvidenceBytes = evidenceUploads.reduce(
      (total, evidence) => total + evidence.sizeBytes,
      0,
    );
    if (totalEvidenceBytes > 10 * 1024 * 1024) {
      throw new Error("Incident evidence exceeds the 10 MB total limit");
    }

    const evidencePaths: Array<{
      storagePath: string;
      fileName: string;
      contentType: string;
      sizeBytes: number;
    }> = [];

    for (const image of evidenceUploads) {
      const storagePath = `${organizationId}/${clientId}/${image.id}.${extensionForContentType(
        image.contentType,
      )}`;
      const { error: uploadError } = await admin.storage
        .from("incident-evidence")
        .upload(
          storagePath,
          Uint8Array.from(atob(image.base64), (char) => char.charCodeAt(0)),
          {
            contentType: image.contentType,
            cacheControl: "3600",
            upsert: true,
          },
        );
      if (uploadError) throw uploadError;
      uploadedPaths.push(storagePath);
      evidencePaths.push({
        storagePath,
        fileName: image.fileName,
        contentType: image.contentType,
        sizeBytes: image.sizeBytes,
      });
    }

    const { data: receipt, error: intakeError } = await admin.rpc(
      "accept_citizen_incident_report",
      {
        _organization_id: organizationId,
        _reporter_id: reporterId,
        _client_hash: clientHash,
        _client_id: clientId,
        _title: title,
        _category: category,
        _description: description,
        _contact: contact,
        _address: address,
        _manual_location: manualLocation,
        _latitude: latitude,
        _longitude: longitude,
        _image_count: submittedEvidence.length,
        _occurred_at: occurredAt,
      },
    );
    if (intakeError?.message.includes("PUBLIC_INCIDENT_RATE_LIMIT")) {
      return json(
        { error: "Too many reports. Please try again later.", correlationId },
        429,
      );
    }
    if (intakeError) throw intakeError;

    const reportId = receipt?.report_id ?? null;
    if (reportId && evidencePaths.length > 0) {
      const { error: evidenceError } = await admin
        .from("incident_report_images")
        .upsert(
          evidencePaths.map((evidence) => ({
            incident_report_id: reportId,
            organization_id: organizationId,
            storage_path: evidence.storagePath,
            file_name: evidence.fileName,
            content_type: evidence.contentType,
            size_bytes: evidence.sizeBytes,
          })),
          { onConflict: "storage_path" },
        );
      if (evidenceError) throw evidenceError;
    }

    console.log("[incident-intake] accepted", {
      correlationId,
      category,
      organizationId,
      reporterId,
    });
    return json(
      {
        accepted: true,
        receiptId: clientId,
        reportId: receipt?.report_id ?? null,
        triageNotificationsCreated: receipt?.triage_notifications_created ?? 0,
        correlationId,
      },
      202,
    );
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await adminStorageCleanup(uploadedPaths).catch(() => undefined);
    }
    console.error("[incident-intake] failed", {
      correlationId,
      error: String(error),
    });
    return json(
      { error: "Unable to submit incident report", correlationId },
      500,
    );
  }
});
