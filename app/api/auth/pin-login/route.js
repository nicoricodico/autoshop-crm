import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPinFormat, findUserByOrgAndPin } from "@/lib/auth/pin";
import { mintSessionForEmail } from "@/lib/auth/mintSession";

// The everyday login: "shop name" + "6-digit code" -> a real, persistent
// Supabase session. Nothing here trusts the browser for anything beyond
// "here's a shop slug and a 6-digit string" — every check (which org,
// which user, rate limiting) happens server-side against the database.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { shopSlug, pin } = body;
  if (!shopSlug?.trim() || !isValidPinFormat(pin)) {
    return NextResponse.json({ error: "Enter your shop name and a 6-digit code." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", shopSlug.trim().toLowerCase())
    .maybeSingle();

  if (!org) {
    // Same generic error as a wrong PIN — don't reveal whether the shop
    // name exists.
    return NextResponse.json({ error: "Shop or access code not recognized." }, { status: 401 });
  }

  const { profile, error } = await findUserByOrgAndPin(org.id, pin);
  if (error || !profile) {
    return NextResponse.json({ error: "Shop or access code not recognized." }, { status: 401 });
  }

  const { data: fullProfile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", profile.id)
    .single();

  const { session, error: sessionError } = await mintSessionForEmail(fullProfile.email);
  if (sessionError || !session) {
    // TEMP DIAGNOSTIC: surfacing the real Supabase error. Remove once fixed.
    return NextResponse.json({ error: `Could not start a session: ${sessionError || "unknown error"}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
