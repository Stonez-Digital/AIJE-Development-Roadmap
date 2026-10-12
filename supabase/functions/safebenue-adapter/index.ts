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
    // Inspect only a bounded, non-secret classification of the provider error.
    // Never log the response body, which may contain account or credential data.
    let responseBodyHint = "";
    try {
      const body = (await response.text()).slice(0, 4096).toLowerCase();
      if (/(payment|billing|subscription|plan|credit)/.test(body)) {
        responseBodyHint = "payment_or_plan_required";
      } else if (/(api.?key|token|credential|unauthorized)/.test(body)) {
        responseBodyHint = "authentication_required";
      } else if (/(quota|rate.?limit|too many requests)/.test(body)) {
        responseBodyHint = "quota_or_rate_limit";
      } else if (body.length > 0) {
        responseBodyHint = "provider_error_details_present";
      }
    } catch {
      responseBodyHint = "error_body_unreadable";
    }
    console.error("[safebenue-adapter] upstream HTTP error", {
      source: name,
      status: response.status,
      statusText: response.statusText.slice(0, 120),
      tokenConfigured: Boolean(token),
      responseBodyHint: responseBodyHint || "no_error_details",
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
  const tokenConfigured = Boolean(
    Deno.env.get("SAFEBENUE_UPSTREAM_TOKEN")?.trim(),
  );
  console.info("[safebenue-adapter] upstream configuration", {
    host: upstreamUrl.host,
    tokenConfigured,
  });
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
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\\/+$/, "");
  // Supabase runtime environments may expose either the legacy anon key or
  // the newer publishable key. Forward the caller JWT so RLS remains enforced.
  const apiKey =
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim();
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !apiKey || !authorization) {
    throw new Error("Authenticated Supabase fallback is not configured");
  }

  const headers = {
    Accept: "application/json",
    apikey: apiKey,
    Authorization: authorization,
  };
  const fetchRows = async (table: string, query: string) => {
    const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
      headers,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      // Keep provider details out of logs and responses; surface only table/status.
      throw new Error(`${table} fallback returned ${response.status}`);
    }
    const body = await response.text();
    if (body.length > MAX_UPSTREAM_BYTES) {
      throw new Error(`${table} fallback exceeded the response-size limit`);
    }
    const parsed: unknown = JSON.parse(body);
    if (!Array.isArray(parsed)) throw new Error(`${table} fallback returned invalid data`);
    return parsed as Record<string, unknown>[];
  };

  const [incidentRows, resourceRows] = await Promise.all([
    fetchRows(
      "incident_reports",
      new URLSearchParams({
        select: "id,title,description,category,status,occurred_at,updated_at,latitude,longitude,address,manual_location",
        order: "occurred_at.desc",
        limit: "500",
      }).toString(),
    ),
    fetchRows(
      "emergency_resources",
      new URLSearchParams({
        select: "id,name,category,status,verification_status,address,community,lga,lat,lng,phone,available_capacity,updated_at",
        verification_status: "eq.verified",
        order: "updated_at.desc",
        limit: "500",
      }).toString(),
    ),
  ]);

  const mappedIncidents = mapIncidentReportsToSafeBenue(incidentRows);
  const resources = resourceRows.flatMap((row) => {
    const id = typeof row.id === "string" ? row.id : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const rawCategory = typeof row.category === "string" ? row.category.toLowerCase() : "";
    const categoryAliases: Record<string, string> = {
      hospital: "hospital",
      medical: "hospital",
      clinic: "hospital",
      police: "police",
      security: "police",
      fire: "fire_service",
      fire_service: "fire_service",
      shelter: "shelter",
      warehouse: "warehouse",
      ngo: "ngo",
      community_leader: "community_leader",
    };
    const category = categoryAliases[rawCategory];
    const lat = row.lat;
    const lng = row.lng;
    if (
      !id || !name || !category ||
      typeof lat !== "number" || typeof lng !== "number" ||
      typeof row.updated_at !== "string" ||
      lat < 6.2 || lat > 8.5 || lng < 7.2 || lng > 10.2
    ) return [];
    const active = String(row.status ?? "").toLowerCase();
    const capacity = row.available_capacity;
    const availability =
      active === "inactive" || active === "closed" || active === "unavailable"
        ? "unavailable"
        : typeof capacity === "number" && capacity <= 0
          ? "limited"
          : "available";
    return [{
      id,
      name,
      category,
      availability,
      updatedAt: row.updated_at,
      location: {
        latitude: lat,
        longitude: lng,
        ...(typeof row.address === "string" && row.address.trim() ? { address: row.address.trim() } : {}),
        ...(typeof row.community === "string" && row.community.trim() ? { community: row.community.trim() } : {}),
        ...(typeof row.lga === "string" && row.lga.trim() ? { localGovernment: row.lga.trim() } : {}),
      },
      ...(typeof row.phone === "string" && row.phone.trim() ? { phone: row.phone.trim() } : {}),
    }];
  });

  return {
    incidents: mappedIncidents.incidents,
    resources,
    // No consent-aware missing-person registry exists; never infer or fabricate records.
    missingPersons: [],
    synchronizedAt: new Date().toISOString(),
    sources: {
      incidents: "connected",
      resources: "connected",
      "missing-persons": "connected",
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
