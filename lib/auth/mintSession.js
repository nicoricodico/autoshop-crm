import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";

// This is the piece that turns "verified 6-digit PIN" into a real,
// persistent Supabase Auth session, without the user ever typing a
// password or an email. It's Supabase's documented pattern for custom
// (non-password) sign-in:
//   1. Server (secret key) asks Supabase Auth for a one-time magic-link
//      token for that user's email — the user never sees this token or
//      the email it would otherwise be sent in.
//   2. Server (regular client, bound to *this* request/response's
//      cookies) redeems that token via verifyOtp(), which is exactly
//      what happens when a real magic-link email is clicked — Supabase
//      returns a full session (access + refresh token) and our cookie
//      adapter (lib/supabase/server.js) writes it into the response.
// From that point on it's an entirely ordinary Supabase session: it
// persists across browser restarts and auto-refreshes via proxy.js,
// exactly like any other Supabase Auth login.
export async function mintSessionForEmail(email) {
  const admin = createAdminClient();

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    return { error: linkError?.message || "Could not start a session." };
  }

  const supabase = await createServerClient();
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyError || !verifyData?.session) {
    return { error: verifyError?.message || "Could not start a session." };
  }

  return { session: verifyData.session, user: verifyData.user };
}
