# Vamp Auto — Shop Manager (multi-tenant)

This is the original Vamp Auto CRM prototype (single shop, no backend, an
in-memory `db` object, and a "vampadmin" keystroke hack for the automations
page) converted into a production-shaped multi-tenant SaaS app. Every page,
workflow, and piece of UI from the prototype is preserved — Daily
Operations, Scheduling, Invoicing & Line Items, Team Management, Customer
Management, Follow-Ups, Vehicle History, Settings — the only things that
changed are the data layer (Supabase/Postgres instead of a JS array) and
the authentication/authorization model (real accounts instead of nothing).

## Architecture

```
app.crm.com
  │
  ├─ /setup, /login          → shop owner onboarding + everyday "shop name
  │                             + 6-digit code" sign-in
  ├─ /                       → the CRM itself (Daily Ops, Scheduling,
  │                             Invoicing, Team, Customers, Follow-Ups,
  │                             Vehicles, Settings) — one shop at a time,
  │                             scoped to whoever is signed in
  ├─ /vendor-admin/login,
  │  /vendor-admin           → separate platform-staff console (Automations)
  │
  Next.js 16 (App Router) ── Vercel
        │
        ▼
  ONE Supabase project (Auth + Postgres + RLS) for the whole platform
        │
        ├─ organizations        (one row per shop — "Shop A", "Shop B", …)
        ├─ profiles              (every human: shop staff + vendor admins)
        ├─ user_pins             (hashed 6-digit codes; never plaintext)
        └─ customers, vehicles, appointments, jobs, job_line_items,
           invoices, invoice_line_items, payments, follow_ups,
           line_item_library, automations, automation_logs
           (every row carries organization_id)
```

There is **one** Supabase project, **one** app, and **many** shops
(organizations). A new shop never means a new codebase or a new database —
it means a new row in `organizations` plus a new owner account, both
created through `/setup`. A scheduling improvement ships to every shop at
once; a labour rate or custom line item only ever affects the shop that
set it.

### Why this is safe, not just "hidden"

Every shop-owned table has Row Level Security enabled
(`supabase/migrations/0002_rls_policies.sql`) that filters every read and
write to `organization_id = <the signed-in user's own org>`. On top of
that:

- A `BEFORE INSERT` trigger (`force_own_org_id`) overwrites
  `organization_id` on every new row with the caller's own org, server
  side, no matter what the client sent. A modified/compromised frontend
  cannot write into another shop.
- `user_pins` (the hashed access codes) has RLS enabled with **zero**
  policies — it is unreachable from the browser under any circumstance,
  only from server-only API routes using the Supabase secret key.
- The Vendor/Automation Admin area is gated by `profiles.role =
  'vendor_admin'`, checked server-side on every request (`app/vendor-admin/
  page.jsx`) and enforced again independently by RLS on the `automations`
  / `automation_logs` tables — there is no UI toggle to bypass, unlike the
  prototype's keystroke unlock.

`supabase/seed/test_shop_isolation.mjs` exercises all of this end to end
with two real throwaway shops and real (non-service-role) Supabase
sessions — see **Testing shop isolation** below.

## One-time project setup

1. **Create a Supabase project.** In the dashboard, go to Project Settings
   → API and copy the Project URL, the **publishable** key (`sb_publishable_…`,
   sometimes still labeled "anon"), and the **secret** key (`sb_secret_…`,
   sometimes still labeled "service_role").
2. **Run the schema.** In the Supabase SQL Editor, run
   `supabase/migrations/0001_schema.sql`, then
   `supabase/migrations/0002_rls_policies.sql`, in that order.
3. **Set environment variables.** Copy `.env.local.example` to `.env.local`
   and fill in the three Supabase values from step 1
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
   `SUPABASE_SECRET_KEY`), plus `NEXT_PUBLIC_SITE_URL` (your local dev URL
   or your deployed origin).
4. **Install dependencies.**
   ```
   npm install
   ```
5. **Seed Shop A** with the CRM's original sample data (same customers,
   vehicles, jobs, invoices, team, automations the prototype always
   shipped with — this is "the current shop becomes Organization / Shop
   A," not a fake generic shop):
   ```
   npm run seed
   ```
   This prints a table of real sign-in credentials (shop name: `vamp-auto`,
   plus a random 6-digit code per team member) — **save that output**, it
   is only shown once. Each teammate can change their own code afterward
   from Settings → Your Access Code.
6. **Create the first Vendor/Automation Admin account.** There is no
   public sign-up for this role by design — it's provisioned out of band:
   ```
   npm run create-vendor-admin -- "Your Name" you@example.com
   ```
   This prints a one-time 6-digit code for `/vendor-admin/login`.
7. **Run it locally:**
   ```
   npm run dev
   ```

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel, "Import Project" from that repo.
3. Add the same four environment variables from `.env.local` under
   Project → Settings → Environment Variables. Use **separate Supabase
   projects for Preview and Production** if you want a safe staging
   environment — never point a Preview deployment at production shop
   data.
4. Deploy. `proxy.js` (Next 16's routing middleware) keeps every signed-in
   session refreshed automatically and redirects signed-out visitors away
   from protected pages — no separate configuration needed.

## Adding a new shop

Every new shop goes through `/setup` — there is no separate "admin creates
a shop" flow, and no reason for one. The owner enters their shop name,
their own name/email/phone, and picks a 6-digit access code; the app
creates their `organizations` row, `org_settings`, a real Supabase Auth
account, and their `owner` profile, then signs them straight in. From
there they add employees from Team Management, each with their own login
and code — nobody ever shares credentials.

## Roles

| Role | Created from | Can do |
|---|---|---|
| Owner | `/setup` (exactly one per shop) | Everything in their shop, including Team Management and Settings |
| Manager | Team Management (by an owner/manager) | Everything except removing the owner |
| Service Advisor, Technician, Apprentice, Receptionist | Team Management | Day-to-day CRM use, scoped to their shop |
| Vendor / Automation Admin | `npm run create-vendor-admin` only | The `/vendor-admin` console — automations across every shop, nothing shop-specific |

## Testing shop isolation

Before trusting this with more than one real shop, run:

```
npm run test:isolation
```

This creates two throwaway shops with real owners/employees, signs in as
each one with a genuine Supabase session (not the service-role key, which
would bypass RLS and prove nothing), and asserts — for customers,
vehicles, jobs, appointments, invoices, employees, and shop settings —
that each shop can read and modify only its own data. It also checks that
a vendor admin can see every shop's automations, that a normal shop user
(owner included) is refused by the automations tables entirely, that a
maliciously-crafted insert (`organization_id` set to another shop) still
lands in the caller's own shop, and that the PIN lockout mechanism engages
after 5 wrong attempts. It cleans up everything it creates and exits
non-zero if anything fails.

A few things that genuinely need a browser and aren't practical to script:

- **"Keep me signed in" / session persistence.** Sign in, close the tab,
  reopen the app — you should land in the CRM without re-entering a code.
  `proxy.js` refreshes the session cookie on every request, so this
  should just work; verify it once after your first deploy.
- **The actual login screen's lockout UX.** The isolation test verifies
  the lockout *mechanism* (the database rows) directly; also try entering
  a wrong code 5 times in the real `/login` screen once and confirm you
  get a rate-limit response, not a 6th silent attempt.
- **Forgot-code / recovery.** Currently: an owner or manager resets an
  employee's code by removing and re-adding them from Team Management. If
  an owner forgets their own code, reset it directly in Supabase
  (`user_pins` table) or extend `/api/auth/change-pin` with an
  email-based recovery flow before relying on this in production.

## What changed from the prototype, and what didn't

**Unchanged:** every page's UI, layout, and workflow — Daily Operations,
Scheduling (calendar + month views, create-job flow), Invoicing & Line
Items (estimates, invoices, payments, the line-item library), Team
Management, Customer Management, Follow-Ups (the kanban board), Vehicle
History, and Settings (business info, hours, rates & tax, payment
methods, notifications, team roles). The component code was ported
essentially verbatim from the original build files — the automotive
design system, the styling, the interactions are all the same.

**Changed:**
- The in-memory `db` object → Supabase Postgres, scoped by
  `organization_id` and enforced by RLS.
- No auth at all → real Supabase Auth accounts, day-to-day sign-in via a
  6-digit PIN that resolves to a genuine, persistent session
  (`lib/auth/mintSession.js`), never a plaintext or frontend-only check.
- The `"vampadmin"` keystroke hack → a real `vendor_admin` role, checked
  server-side, with its own login and route, and RLS backing it up
  independently.
- `actions.resetDemoData()` (the prototype's "reset sample data" button)
  was removed — there's no meaning to "reset demo data" against a real
  shop's live records. Use `npm run seed` against a fresh project instead.
- Line items moved from an embedded JSON array to normalized
  `job_line_items` / `invoice_line_items` tables — the data layer
  (`lib/crm/queries.js`) re-assembles them into the exact same
  `lineItems: [...]` shape the UI already expects, so no page component
  needed to change for this.

## Project layout

```
app/
  layout.jsx, page.jsx          root layout + the "/" routing decision
  login/, setup/                shop sign-in / first-time owner onboarding
  vendor-admin/                 platform staff console (+ its own login)
  api/auth/                     setup, pin-login, vendor-login, change-pin
  api/team/                     invite / remove employees
components/crm/
  page-*.jsx                    the 8 shop CRM pages, ported from the prototype
  page-vendor-automations.jsx   the relocated Automations console
  AppShell.jsx, VendorAdminShell.jsx
  ui.jsx, icons.jsx              shared UI kit, ported from the prototype
lib/
  crm/                          helpers, Supabase queries + actions (the data layer)
  auth/                         PIN hashing/lockout, session minting
  supabase/                     browser/server/admin Supabase clients, session helpers
supabase/
  migrations/                   schema + RLS (run these in order)
  seed/                         seed Shop A, create a vendor admin, isolation test
proxy.js                        session refresh + route protection (Next 16 middleware)
```
