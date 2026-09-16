// Server-side Supabase client for Server Components, Server Actions, and
// Route Handlers — reads/writes the session via Next.js cookies() so the
// user stays signed in across requests without anything touching
// localStorage. Uses the publishable key; the *user's own session* (not
// this key) is what RLS evaluates, so this client only ever sees what
// that user is allowed to see.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (e) {
            // Called from a Server Component that can't set cookies (no
            // response to attach them to). Harmless as long as proxy.js
            // is also refreshing the session on every request.
          }
        },
      },
    }
  );
}
