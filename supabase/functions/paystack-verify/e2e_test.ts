// End-to-end test for the Paystack billing flow.
//
// Covers:
//   1. paystack-initialize   → real call to Paystack sandbox, expects checkout URL
//   2. paystack-webhook      → HMAC-signed charge.success event (the source of truth
//                              the /billing/callback page ultimately relies on)
//   3. subscriptions row     → confirmed active with correct plan + period
//   4. paystack-verify       → callback endpoint is reachable & auth-gated; returns
//                              success:false for an unpaid reference (expected)
//
// Requires (all available in edge-function env):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, PAYSTACK_SECRET_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "node:crypto";
import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON =
  Deno.env.get("SUPABASE_ANON_KEY") ??
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PAYSTACK = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const FN_BASE = `${SUPABASE_URL}/functions/v1`;

Deno.test({
  name: "paystack billing flow: init → webhook → active subscription → callback verify",
  // Supabase client keeps internal intervals (realtime/auth refresh) alive; safe to ignore here.
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    assert(SUPABASE_URL && ANON && SERVICE && PAYSTACK, "env vars must be set");

    const admin = createClient(SUPABASE_URL, SERVICE);

    const email = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@aegis-test.dev`;
    const password = crypto.randomUUID();
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (cErr) throw cErr;
    const userId = created.user!.id;

    try {
      // Sign in as the ephemeral user to obtain a JWT for the invoker endpoints.
      const anon = createClient(SUPABASE_URL, ANON);
      const { data: sess, error: sErr } = await anon.auth.signInWithPassword({
        email,
        password,
      });
      if (sErr) throw sErr;
      const jwt = sess.session!.access_token;

      // Pick a real, non-custom plan.
      const { data: plan, error: pErr } = await admin
        .from("plans")
        .select("*")
        .eq("code", "starter")
        .single();
      if (pErr) throw pErr;
      assert(plan, "starter plan exists");

      // 1) paystack-initialize — hits Paystack sandbox for a real checkout URL.
      const initRes = await fetch(`${FN_BASE}/paystack-initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: ANON,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: plan.id,
          callback_url:
            "https://aije-development-roadmap.pages.dev/account/billing/callback",
        }),
      });
      const initJson = await initRes.json();
      assertEquals(
        initRes.status,
        200,
        `init failed: ${JSON.stringify(initJson)}`,
      );
      assert(
        typeof initJson.authorization_url === "string" &&
          initJson.authorization_url.includes("paystack"),
        `expected checkout URL, got ${initJson.authorization_url}`,
      );
      assert(typeof initJson.reference === "string", "reference returned");
      const reference: string = initJson.reference;

      // 2) paystack-webhook — signed charge.success (what the callback trusts).
      const evt = {
        event: "charge.success",
        data: {
          id: Date.now(),
          reference,
          status: "success",
          customer: { customer_code: `CUS_e2e_${userId.slice(0, 8)}` },
          metadata: { user_id: userId, plan_id: plan.id, plan_code: plan.code },
        },
      };
      const raw = JSON.stringify(evt);
      const sig = createHmac("sha512", PAYSTACK).update(raw).digest("hex");
      const wRes = await fetch(`${FN_BASE}/paystack-webhook`, {
        method: "POST",
        headers: {
          apikey: ANON,
          "Content-Type": "application/json",
          "x-paystack-signature": sig,
        },
        body: raw,
      });
      const wBody = await wRes.text();
      assertEquals(wRes.status, 200, `webhook failed: ${wBody}`);

      // 3) subscriptions row flipped to active.
      const { data: sub, error: subErr } = await admin
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();
      if (subErr) throw subErr;
      assert(sub, "subscription row exists");
      assertEquals(sub.status, "active");
      assertEquals(sub.plan_id, plan.id);
      assertEquals(sub.cancel_at_period_end, false);
      assert(
        sub.current_period_end && new Date(sub.current_period_end) > new Date(),
        "current_period_end is in the future",
      );

      // 4) paystack-verify — callback endpoint. The reference wasn't actually paid
      // in Paystack's sandbox, so it must return success:false gracefully (proves
      // the function is reachable, JWT-gated, and handles the negative path).
      const vRes = await fetch(`${FN_BASE}/paystack-verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          apikey: ANON,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reference }),
      });
      const vJson = await vRes.json();
      assertEquals(vRes.status, 409, `verify failed: ${JSON.stringify(vJson)}`);
      assertEquals(
        vJson.success,
        false,
        "unpaid reference returns success:false",
      );

      // Unauthenticated verify must be rejected.
      const unauthRes = await fetch(`${FN_BASE}/paystack-verify`, {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      await unauthRes.text();
      assertEquals(
        unauthRes.status,
        401,
        "verify rejects unauthenticated caller",
      );
    } finally {
      // Cleanup — order matters (children before user).
      await admin.from("payment_events").delete().eq("user_id", userId);
      await admin.from("subscriptions").delete().eq("user_id", userId);
      await admin.auth.admin.deleteUser(userId);
    }
  },
});
