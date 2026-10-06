import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-correlation-id",
};
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

type Channel = "sms" | "whatsapp";

function json(body: Record<string, unknown>, status = 200, correlationId?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    },
  });
}

function normalizePhone(value: string) {
  const normalized = value.replace(/[\s()-]/g, "");
  return PHONE_PATTERN.test(normalized) ? normalized : null;
}

async function deliver(channel: Channel, to: string, message: string) {
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
        sms: message.slice(0, 480),
        type: "plain",
        channel: "generic",
      }),
    });
    if (!response.ok) throw new Error(`Termii rejected delivery (${response.status})`);
    const result = await response.json();
    return { provider: "termii", id: String(result.message_id ?? "") };
  }

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
  if (!response.ok) throw new Error(`Twilio rejected delivery (${response.status})`);
  const result = await response.json();
  return { provider: "twilio", id: String(result.sid ?? "") };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

  let body: { incidentId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, correlationId);
  }

  const incidentId = typeof body.incidentId === "string" ? body.incidentId : "";
  if (!incidentId) return json({ error: "incidentId is required" }, 422, correlationId);

  const userClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });

  const { data: incident, error: incidentError } = await admin
    .from("incident_reports")
    .select("id,organization_id,title,category,address,manual_location,status,occurred_at")
    .eq("id", incidentId)
    .maybeSingle();

  if (incidentError || !incident)
    return json({ error: "Incident not found" }, 404, correlationId);

  const { data: allowed } = await userClient.rpc("current_user_has_permission", {
    _organization_id: incident.organization_id,
    _permission: "alerts.dispatch",
  });
  if (allowed !== true)
    return json({ error: "Alert dispatch permission required" }, 403, correlationId);

  if (incident.status !== "dispatched")
    return json({ error: "Incident must be dispatched before fallback notification" }, 409, correlationId);

  const { data: assignments } = await admin
    .from("responder_assignments")
    .select("membership_id")
    .eq("incident_report_id", incident.id)
    .in("status", ["assigned", "acknowledged", "responding"]);

  const membershipIds = [...new Set((assignments ?? []).map((row) => row.membership_id))];
  if (membershipIds.length === 0)
    return json({ delivered: 0, failed: 0, skipped: 0, reason: "no_responders" }, 200, correlationId);

  const { data: contacts } = await admin
    .from("responder_contacts")
    .select("membership_id,phone,whatsapp_target,sms_enabled,whatsapp_enabled")
    .eq("organization_id", incident.organization_id)
    .in("membership_id", membershipIds);

  const location = incident.address ?? incident.manual_location ?? "Location not provided";
  const message =
    `[AIJE DISPATCH] ${incident.title} — ${incident.category}. Location: ${location}. Open AIJE to acknowledge and respond.`;
  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const contact of contacts ?? []) {
    const whatsapp = contact.whatsapp_enabled
      ? normalizePhone(contact.whatsapp_target ?? "")
      : null;
    const sms = contact.sms_enabled ? normalizePhone(contact.phone ?? "") : null;

    let sent = false;

    if (whatsapp) {
      try {
        const result = await deliver("whatsapp", whatsapp, message);
        await admin.from("incident_notification_deliveries").insert({
          organization_id: incident.organization_id,
          incident_report_id: incident.id,
          membership_id: contact.membership_id,
          channel: "whatsapp",
          recipient: whatsapp,
          provider: result.provider,
          provider_message_id: result.id,
          status: "sent",
        });
        delivered++;
        sent = true;
      } catch (error) {
        await admin.from("incident_notification_deliveries").insert({
          organization_id: incident.organization_id,
          incident_report_id: incident.id,
          membership_id: contact.membership_id,
          channel: "whatsapp",
          recipient: whatsapp,
          status: "failed",
          error: error instanceof Error ? error.message : "WhatsApp delivery failed",
        });
      }
    }

    if (!sent && sms) {
      try {
        const result = await deliver("sms", sms, message);
        await admin.from("incident_notification_deliveries").insert({
          organization_id: incident.organization_id,
          incident_report_id: incident.id,
          membership_id: contact.membership_id,
          channel: "sms",
          recipient: sms,
          provider: result.provider,
          provider_message_id: result.id,
          status: "sent",
        });
        delivered++;
        sent = true;
      } catch (error) {
        await admin.from("incident_notification_deliveries").insert({
          organization_id: incident.organization_id,
          incident_report_id: incident.id,
          membership_id: contact.membership_id,
          channel: "sms",
          recipient: sms,
          status: "failed",
          error: error instanceof Error ? error.message : "SMS delivery failed",
        });
      }
    }

    if (!sent) {
      skipped++;
      await admin.from("incident_notification_deliveries").insert({
        organization_id: incident.organization_id,
        incident_report_id: incident.id,
        membership_id: contact.membership_id,
        channel: "sms",
        recipient: sms ?? whatsapp ?? "unconfigured",
        status: "skipped",
        error: "No usable configured fallback channel",
      });
    }
  }

  return json({ delivered, failed, skipped }, 200, correlationId);
});
