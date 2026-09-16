import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/supabase/session";
import { VendorAdminShell } from "@/components/crm/VendorAdminShell";

// This is the real replacement for the prototype's "vampadmin" keystroke
// hack. Access is decided here, server-side, from the authenticated
// user's `profiles.role` — never from anything the client sends or from
// a hidden UI toggle. A normal shop user (owner, manager, technician,
// etc.) who guesses this URL is bounced straight back to their shop; RLS
// on the `automations`/`automation_logs` tables would also refuse them
// even if this check were somehow skipped.
export default async function VendorAdminPage() {
  const { user, profile } = await getCurrentSession();

  if (!user) redirect("/vendor-admin/login");
  if (!profile || profile.role !== "vendor_admin") redirect("/");

  return <VendorAdminShell profileName={profile.name} />;
}
