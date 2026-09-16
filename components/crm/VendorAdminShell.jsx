"use client";
/* ==========================================================================
   Minimal shell for the Vendor/Automation Admin area — deliberately not
   the shop Sidebar/TopBar (a vendor admin isn't inside any shop), just a
   thin header with who's signed in and a logout button, then the console
   itself.
   ========================================================================== */
import React from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import { VendorAutomationsPage } from "./page-vendor-automations";
import { createClient } from "@/lib/supabase/client";

export function VendorAdminShell({ profileName }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-shell" style={{ gridTemplateColumns: "1fr" }}>
      <div className="main-col">
        <header className="topbar">
          <div className="topbar-title-wrap">
            <h1 className="topbar-title">Vendor / Automation Admin</h1>
            <div className="topbar-sub">Platform staff console</div>
          </div>
          <div className="topbar-actions hstack" style={{ gap: 10 }}>
            {profileName && <span className="faint" style={{ fontSize: 12.5 }}>{profileName}</span>}
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              <Icon name="logout" size={14} /> Log out
            </button>
          </div>
        </header>
        <div className="page-content">
          <VendorAutomationsPage />
        </div>
      </div>
    </div>
  );
}
