// Browser-side Supabase client. Uses the publishable (anon-equivalent) key
// only — safe to ship to the browser. Row Level Security is what actually
// protects data, not the secrecy of this key.
"use client";

import { createBrowserClient } from "@supabase/ssr";

let browserClient = null;

export function createClient() {
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
  return browserClient;
}
