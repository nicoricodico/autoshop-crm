import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPin, isValidPinFormat, makeUniqueSlug } from "@/lib/auth/pin";
import { mintSessionForEmail } from "@/lib/auth/mintSession";

// First-time shop setup: creates the organization, its default settings,
// the owner's real (but PIN-hidden) Supabase Auth account, and signs them
// straight in. Everything Supabase-shaped (auth users, org ids, tokens)
// happens here on the server — the owner never sees any of it.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { shopName, ownerName, ownerEmail, ownerPhone, pin } = body;

  if (!shopName?.trim() || !ownerName?.trim() || !ownerEmail?.trim()) {
    return NextResponse.json({ error: "Shop name, your name, and an email are required." }, { status: 400 });
  }
  if (!isValidPinFormat(pin)) {
    return NextResponse.json({ error: "Choose a 6-digit access code." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Reject if this email already has an account anywhere on the platform.
  const { data: existingByEmail } = await admin
    .from("profiles")
    .select("id")
    .eq("email", ownerEmail.trim().toLowerCase())
    .maybeSingle();
  if (existingByEmail) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const slug = await makeUniqueSlug(shopName);

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({ name: shopName.trim(), slug })
    .select()
    .single();
  if (orgError) {
    return NextResponse.json({ error: "Could not create the shop: " + orgError.message }, { status: 500 });
  }

  const { error: settingsError } = await admin.from("org_settings").insert({
    organization_id: org.id,
    business_name: shopName.trim(),
    email: ownerEmail.trim().toLowerCase(),
  });
  if (settingsError) {
    return NextResponse.json({ error: "Could not create shop settings: " + settingsError.message }, { status: 500 });
  }

  // The real Supabase Auth credential is a strong random password that is
  // never shown to anyone and never used again — day-to-day sign-in is
  // always through the PIN -> mintSessionForEmail path below, not this
  // password. It only needs to exist because createUser requires *some*
  // credential.
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: ownerEmail.trim().toLowerCase(),
    email_confirm: true,
    password: randomUUID() + randomUUID(),
    user_metadata: { name: ownerName.trim() },
  });
  if (authError || !authUser?.user) {
    await admin.from("organizations").delete().eq("id", org.id);
    return NextResponse.json({ error: "Could not create your account: " + (authError?.message || "unknown error") }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    organization_id: org.id,
    name: ownerName.trim(),
    email: ownerEmail.trim().toLowerCase(),
    phone: ownerPhone?.trim() || "",
    role: "owner",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    await admin.from("organizations").delete().eq("id", org.id);
    return NextResponse.json({ error: "Could not create your profile: " + profileError.message }, { status: 500 });
  }

  const pinHash = await hashPin(pin);
  const { error: pinError } = await admin.from("user_pins").insert({
    user_id: authUser.user.id,
    pin_hash: pinHash,
  });
  if (pinError) {
    return NextResponse.json({ error: "Could not save your access code: " + pinError.message }, { status: 500 });
  }

  const { session, error: sessionError } = await mintSessionForEmail(ownerEmail.trim().toLowerCase());
  if (sessionError || !session) {
    // Account exists and is fully set up — just couldn't auto-sign-in.
    // They can sign in normally with shop name + PIN from /login.
    return NextResponse.json({ ok: true, slug, autoSignedIn: false });
  }

  return NextResponse.json({ ok: true, slug, autoSignedIn: true });
}
