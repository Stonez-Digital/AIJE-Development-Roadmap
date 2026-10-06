import { createClient } from "npm:@supabase/supabase-js@2";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const required = (name: string): string => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

interface LifecycleFixture {
  email: string;
  password: string;
  organizationId: string;
  otherOrganizationId: string;
}

async function createEphemeralFixture(
  url: string,
  serviceRoleKey: string,
): Promise<LifecycleFixture> {
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const marker = crypto.randomUUID();
  const password = `E2e-${crypto.randomUUID()}-Aa1!`;
  const email = `e2e-operator-${marker}@example.invalid`;
  const otherEmail = `e2e-other-${marker}@example.invalid`;

  const { data: operator, error: operatorError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: "E2E Operator",
        requested_login_category: "organization_admin",
      },
    });
  if (operatorError || !operator.user)
    throw operatorError ?? new Error("Failed to create E2E operator");

  const { data: other, error: otherError } = await admin.auth.admin.createUser({
    email: otherEmail,
    password: `E2e-${crypto.randomUUID()}-Bb2!`,
    email_confirm: true,
    user_metadata: {
      display_name: "E2E Isolation Tenant",
      requested_login_category: "resident",
    },
  });
  if (otherError || !other.user)
    throw otherError ?? new Error("Failed to create isolation tenant");

  const organizationFor = async (userId: string) => {
    const { data, error } = await admin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .single();
    if (error || !data)
      throw error ?? new Error("User organization was not provisioned");
    return data.organization_id as string;
  };

  return {
    email,
    password,
    organizationId: await organizationFor(operator.user.id),
    otherOrganizationId: await organizationFor(other.user.id),
  };
}

Deno.test(
  "authenticated incident lifecycle persists audit and isolates tenants",
  async () => {
    const url = required("SUPABASE_URL");
    const anonKey = required("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    const fixture = serviceRoleKey
      ? await createEphemeralFixture(url, serviceRoleKey)
      : {
          email: required("E2E_OPERATOR_EMAIL"),
          password: required("E2E_OPERATOR_PASSWORD"),
          organizationId: required("E2E_ORGANIZATION_ID"),
          otherOrganizationId: required("E2E_OTHER_ORGANIZATION_ID"),
        };
    const client = createClient(url, anonKey, {
      auth: { persistSession: false },
    });

    const { data: session, error: signInError } =
      await client.auth.signInWithPassword({
        email: fixture.email,
        password: fixture.password,
      });
    if (signInError || !session.user)
      throw signInError ?? new Error("Operator sign-in failed");

    const marker = crypto.randomUUID();
    const { data: incident, error: insertError } = await client
      .from("incident_reports")
      .insert({
        reporter_id: session.user.id,
        organization_id: fixture.organizationId,
        client_id: `e2e-${marker}`,
        title: `[E2E] Lifecycle ${marker}`,
        category: "security",
        description: "Automated staging verification record",
        status: "pending",
      })
      .select("id,status,organization_id")
      .single();
    if (insertError) throw insertError;

    for (const status of [
      "verified",
      "dispatched",
      "acknowledged",
      "responding",
      "resolved",
    ] as const) {
      const { data, error } = await client.rpc("transition_incident", {
        _incident_id: incident.id,
        _to_status: status,
        _note: `E2E transition to ${status}`,
      });
      if (error) throw error;
      assertEquals(data.status, status);
      assertEquals(data.organization_id, fixture.organizationId);
    }

    const { data: audit, error: auditError } = await client
      .from("incident_audit_log")
      .select("action,to_status,organization_id")
      .eq("incident_report_id", incident.id)
      .order("created_at");
    if (auditError) throw auditError;
    assertEquals(
      audit?.map((row) => row.to_status),
      ["verified", "dispatched", "acknowledged", "responding", "resolved"],
    );
    assertEquals(
      audit?.every((row) => row.organization_id === fixture.organizationId),
      true,
    );

    const { data: dispatchNotifications, error: dispatchNotificationError } =
      await client
        .from("notifications")
        .select("id")
        .eq("user_id", session.user.id)
        .contains("metadata", {
          incidentId: incident.id,
          event: "response_dispatched",
        });
    if (dispatchNotificationError) throw dispatchNotificationError;
    assertEquals((dispatchNotifications?.length ?? 0) > 0, true);

    const { data: resolutionNotifications, error: resolutionNotificationError } =
      await client
        .from("notifications")
        .select("id")
        .eq("user_id", session.user.id)
        .contains("metadata", {
          incidentId: incident.id,
          event: "incident_resolved",
        });
    if (resolutionNotificationError) throw resolutionNotificationError;
    assertEquals((resolutionNotifications?.length ?? 0) > 0, true);

    const { data: crossTenantAudit, error: crossTenantError } = await client
      .from("incident_audit_log")
      .select("id")
      .eq("organization_id", fixture.otherOrganizationId)
      .limit(1);
    if (crossTenantError) throw crossTenantError;
    assertEquals(crossTenantAudit, []);
  },
);
