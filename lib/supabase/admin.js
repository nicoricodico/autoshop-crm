// Service-role ("secret key") Supabase client. This BYPASSES Row Level
// Security entirely, so it must only ever be imported from server-only
// code (API routes under app/api/**) — never from a Client Component,
// never from anything that ships to the browser.
//
// What it's used for, specifically:
//   - Creating a brand-new organization + its first owner (setup route)
//   - Creating a real Supabase Auth user for a new employee (invite route)
//   - Reading/writing the user_pins table (which has zero RLS policies —
//     it is unreachable any other way)
//   - Minting a session from a verified PIN (generateLink + verifyOtp)
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

let adminClient = null;

export function createAdminClient() {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY — check your environment variables."
    );
  }

  adminClient = createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return adminClient;
}
