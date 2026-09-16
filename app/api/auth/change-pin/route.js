import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSession } from "@/lib/supabase/session";
import { hashPin, isValidPinFormat, verifyPinAgainstHash } from "@/lib/auth/pin";

// Must be signed in already (proves identity via the real Supabase
// session) and must know the *current* PIN before setting a new one —
// changing your PIN never happens purely because you're logged in on a
// device, the same way changing a password usually asks for the old one.
export async function POST(request) {
  const { user } = await getCurrentSession();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const { currentPin, newPin } = body || {};
  if (!isValidPinFormat(newPin)) {
    return NextResponse.json({ error: "Choose a new 6-digit access code." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pinRow } = await admin
    .from("user_pins")
    .select("pin_hash, locked_until")
    .eq("user_id", user.id)
    .maybeSingle();

  if (pinRow?.locked_until && new Date(pinRow.locked_until) > new Date()) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const matches = pinRow && (await verifyPinAgainstHash(currentPin || "", pinRow.pin_hash));
  if (!matches) {
    return NextResponse.json({ error: "Current access code is incorrect." }, { status: 401 });
  }

  const newHash = await hashPin(newPin);
  const { error } = await admin
    .from("user_pins")
    .update({ pin_hash: newHash, failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
