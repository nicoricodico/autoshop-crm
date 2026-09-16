// Server-side helpers for reading "who is this and what shop are they in"
// from the authenticated Supabase session. Used by Server Components and
// API routes to decide what to render/allow — the frontend only ever
// shows UI *after* this has resolved, per the "authorization must also be
// enforced at the database level" requirement (RLS backs every one of
// these reads up independently).
import { createClient } from "./server";

// Returns { user, profile, organization } or { user: null } if signed out.
// profile.role is one of: owner, manager, service_advisor, technician,
// apprentice, receptionist, vendor_admin. profile.organization_id is null
// only for vendor_admin.
export async function getCurrentSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null, organization: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return { user, profile: null, organization: null };

  let organization = null;
  if (profile.organization_id) {
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", profile.organization_id)
      .single();
    organization = org || null;
  }

  return { user, profile, organization };
}

export async function requireRole(allowedRoles) {
  const session = await getCurrentSession();
  if (!session.user || !session.profile) {
    return { ok: false, status: 401, error: "Not signed in.", session };
  }
  if (!allowedRoles.includes(session.profile.role)) {
    return { ok: false, status: 403, error: "You don't have permission to do that.", session };
  }
  return { ok: true, session };
}
