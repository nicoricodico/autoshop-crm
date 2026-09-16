#!/usr/bin/env node
/* One-off helper: resets a shop team member's PIN to a known value so you
   can log in and test. Usage:
     node supabase/seed/reset_pin.mjs <shop-slug> [new-6-digit-pin]
   Defaults to the shop's owner account and PIN 112233 if not given. */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const [, , slugArg, pinArg] = process.argv;
const slug = slugArg || "vamp-auto";
const pin = pinArg || "112233";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: org, error: orgErr } = await admin.from("organizations").select("id, name, slug").eq("slug", slug).single();
if (orgErr || !org) { console.error("Shop not found:", orgErr?.message || slug); process.exit(1); }

const { data: profiles, error: profErr } = await admin
  .from("profiles")
  .select("id, name, role")
  .eq("organization_id", org.id)
  .neq("status", "inactive")
  .order("role", { ascending: true });
if (profErr || !profiles?.length) { console.error("No active team members found."); process.exit(1); }

const target = profiles.find(p => p.role === "owner") || profiles[0];
const pinHash = await bcrypt.hash(pin, 10);
const { error: updErr } = await admin
  .from("user_pins")
  .update({ pin_hash: pinHash, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
  .eq("user_id", target.id);
if (updErr) { console.error("Failed to update PIN:", updErr.message); process.exit(1); }

console.log(`\n✅ Reset login for ${target.name} (${target.role}) at "${org.name}"`);
console.log(`   Shop name to enter:  ${org.slug}`);
console.log(`   Access code:         ${pin}\n`);
