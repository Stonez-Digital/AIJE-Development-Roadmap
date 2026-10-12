import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  contactMatchesIncidentType,
  normalizeIncidentType,
} from "../_shared/incident-type.ts";
import { logJson } from "../_shared/structured-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
};
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
const MAX_TARGETS = 100;
const MAX_ALERTS_PER_MINUTE = 5;

type AlertChannel = "sms" | "whatsapp";
type ThreatLevel = "low" | "medium" | "high" | "critical";
type AlertDraft = {
  idempotencyKey: string;
  organizationId?: string;
  incidentId?: string;
  incidentType: string;
  summary: string;
  location: string;
  threatLevel: ThreatLevel;
  instructions: string;
  occurredAt: string;
  channels: AlertChannel[];
  groupIds: string[];
  contactIds: string[];
  language: string;
  media?: Array<{ type: "image" | "map"; url: string; caption?: string }>;
};
type Recipient = {
  phone: string;
  whatsapp_target: string | null;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
};

function json(
  body: Record<string, unknown>,
  status = 200,
  correlationId?: string,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseString(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= min && normalized.length <= max
    ? normalized
    : null;
}

function parseUuidArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_TARGETS) return null;
  const unique = [...new Set(value)];
  return unique.every(
    (item) => typeof item === "string" && UUID_PATTERN.test(item),
  )
    ? (unique as string[])
    : null;
}

function parseDraft(value: unknown): AlertDraft | null {
  if (!isRecord(value)) return null;
  const incidentType = normalizeIncidentType(value.incidentType);
  const summary = parseString(value.summary, 3, 500);
  const location = parseString(value.location, 2, 300);
  const instructions = parseString(value.instructions, 0, 1000);
  const language = parseString(value.language, 2, 10);
  const groupIds = parseUuidArray(value.groupIds);
  const contactIds = parseUuidArray(value.contactIds);
  const channels = Array.isArray(value.channels)
    ? [...new Set(value.channels)]
    : [];
  const occurredAt =
    typeof value.occurredAt === "string" ? new Date(value.occurredAt) : null;
  const threatLevels: ThreatLevel[] = ["low", "medium", "high", "critical"];
  const allowedChannels: AlertChannel[] = ["sms", "whatsapp"];

  if (
    !incidentType ||
    !summary ||
    location === null ||
    instructions === null ||
    !language ||
    !groupIds ||
    !contactIds ||
    groupIds.length + contactIds.length === 0 ||
    channels.length === 0 ||
    !channels.every((channel): channel is AlertChannel =>
      allowedChannels.includes(channel as AlertChannel),
    ) ||
    !threatLevels.includes(value.threatLevel as ThreatLevel) ||
    !occurredAt ||
    Number.isNaN(occurredAt.getTime()) ||
    occurredAt.getTime() > Date.now() + 300_000
  )
    return null;

  const idempotencyKey =
    typeof value.idempotencyKey === "string" &&
    UUID_PATTERN.test(value.idempotencyKey)
      ? value.idempotencyKey
      : crypto.randomUUID();

  return {
    idempotencyKey,
    organizationId:
      typeof value.organizationId === "string" &&
      UUID_PATTERN.test(value.organizationId)
        ? value.organizationId
        : undefined,
    incidentId: parseString(value.incidentId, 1, 100) ?? undefined,
    incidentType,
    summary,
    location,
    threatLevel: value.threatLevel as ThreatLevel,
    instructions,
    occurredAt: occurredAt.toISOString(),
    channels: channels as AlertChannel[],
    groupIds,
    contactIds,
    language,
  };
}

function normalizePhone(value: string): string | null {
  const normalized = value.replace(/[\s()-]/g, "");
  return PHONE_PATTERN.test(normalized) ? normalized : null;
}

function smsText(draft: AlertDraft) {
  return `[AIJE ${draft.threatLevel.toUpperCase()}] ${draft.incidentType} — ${draft.location}. ${new Date(draft.occurredAt).toLocaleString("en-NG")}. ${draft.instructions}`.slice(
    0,
    480,
  );
}

function whatsappText(draft: AlertDraft) {
  return `*AIJE VERIFIED ALERT*\n${draft.summary}\nLocation: ${draft.location}\nThreat: ${draft.threatLevel.toUpperCase()}\nTime: ${new Date(draft.occurredAt).toLocaleString("en-NG")}`;
}

async function deliver(channel: AlertChannel, to: string, message: string) {
  if (channel === "sms" && Deno.env.get("SMS_PROVIDER") === "termii") {
    const apiKey = Deno.env.get("TERMII_API_KEY");
    if (!apiKey) throw new Error("Termii is not configured");
    const response = await fetch("https://api.ng.termii.com/api/sms/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        to,
        from: Deno.env.get("TERMII_SENDER_ID") ?? "AIJE",
        sms: message,
        type: "plain",
        channel: "generic",
      }),
    });
    if (!response.ok)
      throw new Error(`Termii rejected delivery (${response.status})`);
    const result = await response.json();
    return { provider: "termii", id: String(result.message_id ?? "") };
  }

  if (
    (channel === "sms" && Deno.env.get("SMS_PROVIDER") === "twilio") ||
    channel === "whatsapp"
  ) {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from =
      channel === "whatsapp"
        ? Deno.env.get("TWILIO_WHATSAPP_FROM")
        : Deno.env.get("TWILIO_SMS_FROM");
    if (!sid || !token || !from) throw new Error("Twilio is not configured");
    const body = new URLSearchParams({
      To: channel === "whatsapp" ? `whatsapp:${to}` : to,
      From: from,
      Body: message,
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    if (!response.ok)
      throw new Error(`Twilio rejected delivery (${response.status})`);
    const result = await response.json();
    return { provider: "twilio", id: String(result.sid ?? "") };
  }
  throw new Error(`No ${channel} provider configured`);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  const correlationId =
    request.headers.get("x-correlation-id") ?? crypto.randomUUID();
  if (request.method !== "POST")
    return json({ error: "Method not allowed" }, 405, correlationId);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey)
    return json({ error: "Service unavailable" }, 500, correlationId);
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer "))
    return json({ error: "Authentication required" }, 401, correlationId);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(authorization.slice(7));
  if (authError || !user)
    return json({ error: "Invalid or expired session" }, 401, correlationId);

  const userClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, correlationId);
  }
  const draft = parseDraft(rawBody);
  if (!draft)
    return json({ error: "Invalid alert payload" }, 422, correlationId);

  // If an alert references a canonical AIJE incident, verify that it belongs
  // to the selected organization and has reached dispatched status first.
  if (draft.incidentId && UUID_PATTERN.test(draft.incidentId) && draft.organizationId) {
    const { data: linkedIncident, error: linkedIncidentError } = await admin
      .from("incident_reports")
      .select("id,organization_id,status,title,category,address,manual_location,occurred_at")
      .eq("id", draft.incidentId)
      .maybeSingle();
    if (linkedIncidentError)
      return json({ error: "Unable to validate linked incident" }, 500, correlationId);
    if (!linkedIncident)
      return json({ error: "Linked incident not found in the selected organization" }, 404, correlationId);
    if (linkedIncident.organization_id !== draft.organizationId)
      return json({ error: "Linked incident organization mismatch" }, 403, correlationId);
    if (linkedIncident.status !== "dispatched")
      return json({ error: "Linked incident must be verified and dispatched before watch alerting" }, 409, correlationId);

    // Canonical incident fields are authoritative; do not trust altered client
    // summary, location, or timestamp for a linked incident alert.
    draft.incidentType = normalizeIncidentType(linkedIncident.category);
    draft.summary = linkedIncident.title;
    draft.location = linkedIncident.address ?? linkedIncident.manual_location ?? draft.location;
    draft.occurredAt = linkedIncident.occurred_at;
  }

  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await admin
    .from("community_alerts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .gte("created_at", minuteAgo);
  if ((recentCount ?? 0) >= MAX_ALERTS_PER_MINUTE)
    return json({ error: "Alert rate limit exceeded" }, 429, correlationId);

  let canDispatchForOrganization = false;
  if (draft.organizationId) {
    const { data, error } = await userClient.rpc(
      "current_user_has_permission",
      {
        _organization_id: draft.organizationId,
        _permission: "alerts.dispatch",
      },
    );
    if (error || data !== true)
      return json(
        { error: "Alert dispatch permission required" },
        403,
        correlationId,
      );
    canDispatchForOrganization = true;
  }

  const { data: ownedGroups, error: groupError } = draft.groupIds.length
    ? await admin
        .from("community_watch_groups")
        .select("id, owner_id, organization_id, escalation_minutes")
        .in("id", draft.groupIds)
    : { data: [], error: null };
  if (groupError)
    return json(
      { error: "Unable to validate alert groups" },
      500,
      correlationId,
    );
  const groupsAccessible = (ownedGroups ?? []).every(
    (group) =>
      group.owner_id === user.id ||
      (canDispatchForOrganization &&
        group.organization_id === draft.organizationId),
  );
  if ((ownedGroups ?? []).length !== draft.groupIds.length || !groupsAccessible)
    return json(
      { error: "One or more groups are not accessible" },
      403,
      correlationId,
    );

  const intervalMinutes = (ownedGroups ?? [])
    .map((group) => group.escalation_minutes)
    .filter(
      (minutes): minutes is number =>
        typeof minutes === "number" && minutes > 0,
    );
  const escalationMinutes = Math.min(...intervalMinutes, 15);
  const { data: alert, error: alertError } = await admin
    .from("community_alerts")
    .insert({
      owner_id: user.id,
      organization_id: draft.organizationId ?? null,
      incident_id: draft.incidentId,
      incident_type: draft.incidentType,
      summary: draft.summary,
      location: draft.location,
      threat_level: draft.threatLevel,
      instructions: draft.instructions,
      occurred_at: draft.occurredAt,
      language: draft.language,
      idempotency_key: draft.idempotencyKey,
      next_escalation_at: new Date(
        Date.now() + escalationMinutes * 60_000,
      ).toISOString(),
    })
    .select("id")
    .single();

  if (alertError?.code === "23505") {
    const { data: existing } = await admin
      .from("community_alerts")
      .select("id")
      .eq("owner_id", user.id)
      .eq("idempotency_key", draft.idempotencyKey)
      .maybeSingle();
    return json(
      {
        alertId: existing?.id ?? null,
        queued: 0,
        delivered: 0,
        failed: 0,
        duplicate: true,
      },
      200,
      correlationId,
    );
  }
  if (alertError || !alert) {
    logJson("error", "community_alert.insert_failed", {
      correlation_id: correlationId,
      user_id: user.id,
      error: alertError?.message,
    });
    return json({ error: "Unable to create alert" }, 500, correlationId);
  }

  if (draft.groupIds.length) {
    await admin.from("community_alert_targets").insert(
      draft.groupIds.map((groupId) => ({
        alert_id: alert.id,
        group_id: groupId,
      })),
    );
  }

  const { data: members } = draft.groupIds.length
    ? await admin
        .from("community_group_members")
        .select("phone, whatsapp_target, sms_enabled, whatsapp_enabled")
        .in("group_id", draft.groupIds)
    : { data: [] };
  let contactQuery = admin
    .from("emergency_contacts")
    .select("phone, whatsapp_target, incident_types")
    .eq("active", true);
  contactQuery =
    draft.organizationId && canDispatchForOrganization
      ? contactQuery.eq("organization_id", draft.organizationId)
      : contactQuery.eq("owner_id", user.id);
  if (draft.contactIds.length)
    contactQuery = contactQuery.in("id", draft.contactIds);
  const { data: contactRows } = await contactQuery;
  const contacts = (contactRows ?? []).filter(
    (contact) =>
      draft.contactIds.length > 0 ||
      contactMatchesIncidentType(contact.incident_types, draft.incidentType),
  );
  const recipients: Recipient[] = [
    ...((members ?? []) as Recipient[]),
    ...contacts.map((contact) => ({
      ...contact,
      sms_enabled: true,
      whatsapp_enabled: Boolean(contact.whatsapp_target),
    })),
  ];
  const deliveries = new Map<
    string,
    { channel: AlertChannel; recipient: string }
  >();
  for (const recipient of recipients) {
    for (const channel of draft.channels) {
      const rawTarget =
        channel === "sms" && recipient.sms_enabled
          ? recipient.phone
          : channel === "whatsapp" && recipient.whatsapp_enabled
            ? recipient.whatsapp_target
            : null;
      if (!rawTarget) continue;
      const target = normalizePhone(rawTarget);
      if (target)
        deliveries.set(`${channel}:${target}`, { channel, recipient: target });
    }
  }

  let delivered = 0;
  let failed = 0;
  for (const item of deliveries.values()) {
    try {
      const result = await deliver(
        item.channel,
        item.recipient,
        item.channel === "sms" ? smsText(draft) : whatsappText(draft),
      );
      await admin.from("alert_deliveries").upsert(
        {
          alert_id: alert.id,
          delivery_key: `${item.channel}:${item.recipient}`,
          channel: item.channel,
          recipient: item.recipient,
          provider: result.provider,
          provider_message_id: result.id,
          status: "sent",
          attempts: 1,
        },
        { onConflict: "alert_id,delivery_key" },
      );
      delivered++;
    } catch (error) {
      await admin.from("alert_deliveries").upsert(
        {
          alert_id: alert.id,
          delivery_key: `${item.channel}:${item.recipient}`,
          channel: item.channel,
          recipient: item.recipient,
          provider: "configured",
          status: "failed",
          error: error instanceof Error ? error.message : "Delivery failed",
          attempts: 1,
        },
        { onConflict: "alert_id,delivery_key" },
      );
      failed++;
    }
  }

  logJson("info", "community_alert.dispatched", {
    correlation_id: correlationId,
    user_id: user.id,
    alert_id: alert.id,
    delivered,
    failed,
  });
  return json(
    { alertId: alert.id, queued: 0, delivered, failed },
    200,
    correlationId,
  );
});
