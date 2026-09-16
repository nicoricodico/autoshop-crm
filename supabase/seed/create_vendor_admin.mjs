#!/usr/bin/env node
/* ==========================================================================
   Creates the first Vendor/Automation Admin account — a role='vendor_admin'
   profile with no organization_id, which is what real (not-hidden-behind-
   a-keystroke) access to /vendor-admin requires.

   There is no public sign-up for this role on purpose: platform staff
   accounts are provisioned out-of-band by whoever runs the project, using
   this script (or the equivalent SQL) — never through a form a shop owner
   could reach.

   Usage:
     node supabase/seed/create_vendor_admin.mjs "Full Name" email@example.com
   A random 6-digit access code is generated and printed once. Run this
   again with a different email to add more platform admins.
   ========================================================================== */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { randomUUID, randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const [, , name, email] = process.argv;
if (!name || !email) {
  console.error("Usage: node supabase/seed/create_vendor_admin.mjs \"Full Name\" email@example.com");
  process.exit(1);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.local.example to .env.local and fill it in first.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function genPin() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

async function main() {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: existing } = await admin.from("profiles").select("id").eq("email", normalizedEmail).maybeSingle();
  if (existing) {
    console.error("An account with that email already exists.");
    process.exit(1);
  }

  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: normalizedEmail, email_confirm: true, password: randomUUID() + randomUUID(),
    user_metadata: { name },
  });
  if (authErr) throw authErr;

  const { error: profileErr } = await admin.from("profiles").insert({
    id: authUser.user.id, organization_id: null, name, email: normalizedEmail,
    phone: "", role: "vendor_admin",
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    throw profileErr;
  }

  const pin = genPin();
  const pinHash = await bcrypt.hash(pin, 10);
  const { error: pinErr } = await admin.from("user_pins").insert({ user_id: authUser.user.id, pin_hash: pinHash });
  if (pinErr) throw pinErr;

  console.log("\n✅ Vendor admin created: " + name + " <" + normalizedEmail + ">");
  console.log("   Access code (Vendor Admin console at /vendor-admin/login): " + pin);
  console.log("   Save this now — it will not be shown again.\n");
}

main().catch(err => {
  console.error("\n❌ Failed:", err.message || err);
  process.exit(1);
});
