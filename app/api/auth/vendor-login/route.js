import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPinFormat, findVendorAdminByPin } from "@/lib/auth/pin";
import { mintSessionForEmail } from "@/lib/auth/mintSession";

// Sign-in for the separate Vendor/Automation Admin console. Deliberately
// not part of /api/auth/pin-login: a vendor_admin profile has no
// organization_id (see 0001_schema.sql's profiles_org_matches_role
// constraint), so there is no "shop name" to scope the PIN lookup by —
// this checks the PIN against every vendor_admin account instead.
export async function POST(request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { pin } = body;
  if (!isValidPinFormat(pin)) {
    return NextResponse.json({ error: "Enter a 6-digit access code." }, { status: 400 });
  }

  const { profile, error } = await findVendorAdminByPin(pin);
  if (error || !profile) {
    return NextResponse.json({ error: "Access code not recognized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: fullProfile } = await admin.from("profiles").select("email").eq("id", profile.id).single();

  const { session, error: sessionError } = await mintSessionForEmail(fullProfile.email);
  if (sessionError || !session) {
    return NextResponse.json({ error: "Could not start a session. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
