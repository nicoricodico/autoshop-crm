import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/session";
import { hashPin, isValidPinFormat } from "@/lib/auth/pin";

// Owner/manager adds a teammate from Team Management. The employee gets
// their own real Supabase Auth account and their own PIN — never the
// owner's credentials. organization_id is taken from the *caller's own*
// session (never from the request body), so there's no way to add an
// employee into a different shop than your own.
export async function POST(request) {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const { name, email, phone, role, pin } = body || {};

  const allowedRoles = ["manager", "service_advisor", "technician", "apprentice", "receptionist"];
  if (!name?.trim() || !email?.trim() || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Name, email, and a valid role are required." }, { status: 400 });
  }
  if (!isValidPinFormat(pin)) {
    return NextResponse.json({ error: "Choose a 6-digit access code for this teammate." }, { status: 400 });
  }

  const organizationId = auth.session.profile.organization_id;
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Someone already has an account with that email." }, { status: 409 });
  }

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    email_confirm: true,
    password: randomUUID() + randomUUID(),
    user_metadata: { name: name.trim() },
  });
  if (authError || !authUser?.user) {
    return NextResponse.json({ error: "Could not create the account: " + (authError?.message || "unknown error") }, { status: 500 });
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: authUser.user.id,
    organization_id: organizationId,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || "",
    role,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const pinHash = await hashPin(pin);
  const { error: pinError } = await admin.from("user_pins").insert({
    user_id: authUser.user.id,
    pin_hash: pinHash,
  });
  if (pinError) {
    return NextResponse.json({ error: pinError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: authUser.user.id });
}
