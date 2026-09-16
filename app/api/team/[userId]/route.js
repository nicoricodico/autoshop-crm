import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/supabase/session";

// Deactivate (not hard-delete, so history/jobs/appointments they're
// linked to stay intact) a teammate. Owner/manager only, and only within
// their own org — organization_id is checked server-side before touching
// anything, never trusted from the URL alone.
export async function DELETE(request, { params }) {
  const auth = await requireRole(["owner", "manager"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { userId } = await params;
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!target || target.organization_id !== auth.session.profile.organization_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (target.role === "owner") {
    return NextResponse.json({ error: "The owner account can't be removed this way." }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update({ status: "inactive" }).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also lock their PIN out immediately rather than waiting on status
  // checks everywhere that touch auth.
  await admin
    .from("user_pins")
    .update({ locked_until: "9999-12-31T00:00:00Z" })
    .eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
