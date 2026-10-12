import { mapIncidentReportsToSafeBenue, mapSafeBenueFeeds } from "./mapper.ts";

const CACHE_TTL_MS = 30_000;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_UPSTREAM_BYTES = 1_000_000;

type Snapshot = ReturnType<typeof mapSafeBenueFeeds> & {
  synchronizedAt: string;
  sources: Record<string, "connected" | "unavailable">;
};

let cached: { expiresAt: number; value: Snapshot } | null = null;
let inFlight: Promise<Snapshot> | null = null;

const allowedOrigins = () =>
  (Deno.env.get("SAFEBENUE_ADAPTER_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const corsHeaders = (request: Request) => {
  const origin = request.headers.get("origin");
  const allowed = allowedOrigins();
  const selected = origin && allowed.includes(origin) ? origin : "null";
  return {
    "Access-Control-Allow-Origin": selected,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
};

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=15",
    },
  });

async function fetchFeed(baseUrl: string, name: string): Promise<unknown> {
  const token = Deno.env.get("SAFEBENUE_UPSTREAM_TOKEN")?.trim();
  const response = await fetch(`${baseUrl}/${name}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AIJE-SafeBenue-Adapter/1.0",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    console.error("[safebenue-adapter] upstream HTTP error", {
      source: name,
      status: response.status,
      statusText: response.statusText.slice(0, 120),
    });
    throw new Error(name + " returned HTTP " + response.status);
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPSTREAM_BYTES)
    throw new Error(`${name} exceeded the response-size limit`);
  const body = await response.text();
  if (body.length > MAX_UPSTREAM_BYTES)
    throw new Error(`${name} exceeded the response-size limit`);
  return JSON.parse(body) as unknown;
}

async function createUpstreamSnapshot(): Promise<Snapshot> {
  const configuredBaseUrl = Deno.env.get("SAFEBENUE_UPSTREAM_BASE_URL")?.trim();
  if (!configuredBaseUrl)
    throw new Error("SafeBenue upstream is not configured");
  const upstreamUrl = new URL(configuredBaseUrl);
  if (upstreamUrl.protocol !== "https:")
    throw new Error("SafeBenue upstream must use HTTPS");
  const baseUrl = upstreamUrl.toString().replace(/\/+$/, "");
  const names = ["incidents", "resources", "missing-persons"] as const;
  const results = await Promise.allSettled(
    names.map((name) => fetchFeed(baseUrl, name)),
  );
  const feeds: Record<string, unknown> = {};
  const sources: Snapshot["sources"] = {};
  names.forEach((name, index) => {
    const result = results[index];
    sources[name] = result.status === "fulfilled" ? "connected" : "unavailable";
    if (result.status === "fulfilled") feeds[name] = result.value;
    else
      console.error("[safebenue-adapter] upstream unavailable", {
        source: name,
        error: String(result.reason),
      });
  });
  if (results.every((result) => result.status === "rejected"))
    throw new Error("All SafeBenue feeds are unavailable");
  return {
    ...mapSafeBenueFeeds({
      incidents: feeds.incidents,
      resources: feeds.resources,
      missingPersons: feeds["missing-persons"],
    }),
    synchronizedAt: new Date().toISOString(),
    sources,
  };
}

async function fetchInternalSnapshot(request: Request): Promise<Snapshot> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/+$/, "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !anonKey || !authorization) {
    throw new Error("Authenticated Supabase fallback is not configured");
  }
  const fields = [
    "id",
    "title",
    "description",
    "category",
    "status",
    "occurred_at",
    "updated_at",
    "latitude",
    "longitude",
    "address",
    "manual_location",
  ].join(",");
  const response = await fetch(
    `${supabaseUrl}/rest/v1/incident_reports?select=${fields}&order=occurred_at.desc&limit=500`,
    {
      headers: {
        Accept: "application/json",
        apikey: anonKey,
        Authorization: authorization,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase incident fallback returned ${response.status}`);
  }
  const payload = await response.json();
  return {
    ...mapIncidentReportsToSafeBenue(payload),
    synchronizedAt: new Date().toISOString(),
    sources: {
      incidents: "connected",
      resources: "unavailable",
      "missing-persons": "unavailable",
    },
  };
}

async function getSnapshot(request: Request) {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (!inFlight) {
    inFlight = createUpstreamSnapshot()
      .then((value) => {
        cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
        return value;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  try {
    return await inFlight;
  } catch (upstreamError) {
    console.warn("[safebenue-adapter] using Supabase incident fallback", {
      error: String(upstreamError),
    });
    // Do not cache organization-scoped fallback records in module state. Each
    // request must pass through PostgREST with the caller JWT so RLS applies.
    return await fetchInternalSnapshot(request);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== "GET")
    return json(request, { error: "Method not allowed" }, 405);
  try {
    return json(request, await getSnapshot(request));
  } catch (error) {
    console.error("[safebenue-adapter] request failed", {
      error: String(error),
    });
    return json(request, { error: "SafeBenue upstream unavailable" }, 503);
  }
});
