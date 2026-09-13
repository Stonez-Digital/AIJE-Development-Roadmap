# Deployment environments

Use separate Supabase projects and provider accounts for development, staging,
and production. Never point a local build at production by default.

The canonical production Supabase project is `sznafsdzdwiwhcgrfzcb` at
`https://sznafsdzdwiwhcgrfzcb.supabase.co`. Production frontend variables,
migrations, and Edge Function deployments must all be verified against that
project before release.

## Frontend variables

Copy `.env.example` to an ignored `.env` and configure the environment's
publishable Supabase URL and key. No service-role or provider secret may use a
`VITE_` prefix.

## Edge Function secrets

Configure only the providers enabled for that environment:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `PAYSTACK_SECRET_KEY`
- `ALLOWED_CALLBACK_ORIGINS` as a comma-separated exact origin allowlist for
  every deployed frontend that may start a payment. Include the Cloudflare
  custom-domain origin (for example, `https://app.example.com`) and, during a
  controlled transition, the old origin if it must remain usable. Production
  origins are never implicitly trusted by the function.
- `SMS_PROVIDER` (`termii` or `twilio`)
- `TERMII_API_KEY`, `TERMII_SENDER_ID`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`,
  `TWILIO_WHATSAPP_FROM`
- `CRON_SECRET` and `ALERT_CRON_SECRET`
- `OSIRIS_UPSTREAM_BASE_URL`, optional `OSIRIS_UPSTREAM_TOKEN`, and
  `OSIRIS_ADAPTER_ALLOWED_ORIGINS`. The
  `osiris-adapter` requires a valid Supabase user JWT; do not create a browser
  token or expose the upstream URL through a `VITE_` variable.
- `SAFEBENUE_UPSTREAM_BASE_URL`, optional `SAFEBENUE_UPSTREAM_TOKEN`, and
  `SAFEBENUE_ADAPTER_ALLOWED_ORIGINS`. The `safebenue-adapter` also requires a
  valid Supabase user JWT. Keep incident and missing-person feeds private.

## Release sequence

1. Create a pull request from a feature branch.
2. Require formatting, lint, strict and project TypeScript, unit coverage, and
   production build checks.
3. Apply migrations to staging and run `supabase db lint`.
4. Deploy staging Edge Functions and exercise incident reporting, alert
   dispatch, payment initialization, payment verification, and webhook retry.
5. Review logs using correlation IDs and verify no sensitive payloads appear.
6. Back up production, apply migrations, deploy functions, then deploy the UI.
7. Smoke-test production with non-sensitive test records and monitor failures.

## Cloudflare Pages

The repository includes Cloudflare Pages routing and response-header rules in
`public/_redirects` and `public/_headers`. Vite copies them into `dist` during
the build. The redirect rule serves `index.html` for client-side routes such as
`/auth`, `/control-panel`, and `/billing/callback`, so refreshing or opening a
deep link does not return a Cloudflare 404.

Create or connect a Pages project with these settings:

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22`
- Root directory: the repository root

The current production Pages origin is
`https://aije-development-roadmap.pages.dev`. Include this exact origin in the
`ALLOWED_CALLBACK_ORIGINS` Supabase Edge Function secret so Paystack can return
to `/account/billing/callback`.

Configure these production build variables in Cloudflare Pages:

- `VITE_DEPLOYMENT_ENV=production`
- `VITE_COMMUNITY_SYNC_MODE=live`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- Any enabled integration variables documented in `.env.example`

After the custom domain is active, complete the hostname cutover outside the
frontend repository:

1. In Supabase Authentication URL Configuration, set **Site URL** to the new
   canonical `https://` origin and add the required callback paths (or a scoped
   wildcard for that origin) to **Redirect URLs**.
2. Set the `ALLOWED_CALLBACK_ORIGINS` Supabase Edge Function secret to the new
   exact origin, then redeploy `paystack-initialize`.
3. Add the custom domain to the Cloudflare Pages project. Redirect the old
   hostname to the canonical hostname only after authentication and payment
   callbacks have been verified.
4. Test a direct visit and browser refresh on `/auth`, `/reset-password`, and
   `/billing/callback`, then test sign-in email and Paystack return flows.

Do not put Supabase service-role keys, Paystack secrets, or provider tokens in
Cloudflare variables whose names begin with `VITE_`; Vite exposes those values
to browsers.

## Authenticated lifecycle verification

The `Incident Lifecycle E2E` workflow starts an ephemeral local Supabase stack,
applies every migration, and creates temporary operator and isolation tenants.
It verifies the complete lifecycle and cross-tenant audit isolation without
hosted staging resources or persistent test credentials. The stack and fixture
accounts are destroyed when the job finishes.

## Branch protection

Protect `main`; require pull requests, at least one approval, resolved review
conversations, the `Quality / verify` check, and the Paystack E2E check when its
paths change. Disable administrator bypass for routine releases.
