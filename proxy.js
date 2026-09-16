// Next.js 16 renamed the root "middleware.ts" convention to "proxy.ts" —
// this is that file. It runs before every request (matcher below excludes
// static assets) and refreshes the Supabase session cookie so a returning
// user's session stays alive without them re-entering their PIN.
import { updateSession } from "@/lib/supabase/updateSession";

export async function proxy(request) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
