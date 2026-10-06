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
  images?: unknown[];
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
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 32_000)
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
        `${forwardedFor ?? "unknown"}:${request.headers.get("user-agent") ?? "unknown"}`,
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
        _image_count: Math.min(
          Array.isArray(payload.images) ? payload.images.length : 0,
          5,
        ),
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
