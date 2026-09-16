import "server-only";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCKOUT_MINUTES = 15;

export function isValidPinFormat(pin) {
  return typeof pin === "string" && /^\d{6}$/.test(pin);
}

export async function hashPin(pin) {
  return bcrypt.hash(pin, 10);
}

export async function verifyPinAgainstHash(pin, hash) {
  return bcrypt.compare(pin, hash);
}

// Slugify a shop name into the identifier the login screen matches on,
// guaranteeing uniqueness (append -2, -3, ... on collision).
export async function makeUniqueSlug(name) {
  const admin = createAdminClient();
  const base =
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "shop";

  let candidate = base;
  let suffix = 1;
  for (;;) {
    const { data } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

// Finds which user in an org (if any) this PIN belongs to, honoring
// per-user lockout. Every attempt (success or failure) updates
// failed_attempts / locked_until server-side — never trust a frontend
// retry counter for this.
export async function findUserByOrgAndPin(organizationId, pin) {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, role, organization_id")
    .eq("organization_id", organizationId)
    .neq("status", "inactive");

  if (!profiles || profiles.length === 0) {
    return { error: "No accounts found for this shop." };
  }
  return findUserAmongProfilesByPin(profiles, pin);
}

// Same idea, but for the separate Vendor/Automation Admin sign-in, which
// has no shop/slug to scope by — it matches the PIN against every
// role='vendor_admin' profile instead (there are normally very few).
export async function findVendorAdminByPin(pin) {
  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, role, organization_id")
    .eq("role", "vendor_admin")
    .neq("status", "inactive");

  if (!profiles || profiles.length === 0) {
    return { error: "No vendor admin accounts exist yet." };
  }
  return findUserAmongProfilesByPin(profiles, pin);
}

async function findUserAmongProfilesByPin(profiles, pin) {
  const admin = createAdminClient();
  const { data: pinRows } = await admin
    .from("user_pins")
    .select("user_id, pin_hash, failed_attempts, locked_until")
    .in(
      "user_id",
      profiles.map((p) => p.id)
    );

  const now = new Date();
  const pinByUser = new Map((pinRows || []).map((r) => [r.user_id, r]));

  for (const profile of profiles) {
    const pinRow = pinByUser.get(profile.id);
    if (!pinRow) continue;

    if (pinRow.locked_until && new Date(pinRow.locked_until) > now) {
      continue; // locked out — skip, don't even try comparing
    }

    const matches = await verifyPinAgainstHash(pin, pinRow.pin_hash);
    if (matches) {
      await admin
        .from("user_pins")
        .update({ failed_attempts: 0, locked_until: null, updated_at: now.toISOString() })
        .eq("user_id", profile.id);
      return { profile };
    }
  }

  // No match — record a failed attempt against every *unlocked* candidate
  // in this org so repeated guessing gets rate-limited even though the
  // login screen never reveals which user it might have matched.
  for (const profile of profiles) {
    const pinRow = pinByUser.get(profile.id);
    if (!pinRow) continue;
    if (pinRow.locked_until && new Date(pinRow.locked_until) > now) continue;

    const attempts = (pinRow.failed_attempts || 0) + 1;
    const lockNow = attempts >= PIN_MAX_ATTEMPTS;
    await admin
      .from("user_pins")
      .update({
        failed_attempts: lockNow ? 0 : attempts,
        locked_until: lockNow
          ? new Date(now.getTime() + PIN_LOCKOUT_MINUTES * 60000).toISOString()
          : null,
        updated_at: now.toISOString(),
      })
      .eq("user_id", profile.id);
  }

  return { error: "Incorrect access code." };
}
