import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/supabase/session";
import { AppShell } from "@/components/crm/AppShell";

// Root route. A server component so the routing decision (which account
// type goes where) is made before any client JS runs, using the real
// session — not a client-side guess. The proxy (proxy.js) treats "/" as
// public because this is exactly where that decision happens.
export default async function HomePage() {
  const { user, profile } = await getCurrentSession();

  if (!user) redirect("/login");
  if (!profile) redirect("/login");
  if (profile.role === "vendor_admin") redirect("/vendor-admin");

  return <AppShell />;
}
