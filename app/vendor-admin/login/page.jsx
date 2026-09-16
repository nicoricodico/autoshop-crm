"use client";
/* ==========================================================================
   Vendor/Automation Admin sign-in — a 6-digit access code, same as the
   shop login, but with no shop name to enter (a vendor_admin belongs to
   no shop; see /api/auth/vendor-login). Not linked from anywhere in the
   normal shop UI — this is the real replacement for the old "vampadmin"
   keystroke hack, reachable only by URL and gated server-side by role.
   ========================================================================== */
import React from "react";
import { useRouter } from "next/navigation";

export default function VendorLoginPage() {
  const router = useRouter();
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(pin)) { setError("Enter a 6-digit access code."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/vendor-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not sign in."); setPin(""); return; }
      router.push("/vendor-admin");
      router.refresh();
    } catch (e2) {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loading-screen" style={{ flexDirection: "column" }}>
      <form className="card" style={{ width: 320, textAlign: "center" }} onSubmit={submit}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, letterSpacing: "0.04em", marginBottom: 4 }}>
          Vendor / Automation Admin
        </div>
        <p className="faint" style={{ fontSize: 12.5, marginTop: 0, marginBottom: 16 }}>
          Platform staff only
        </p>
        <input
          className="input mono" style={{ textAlign: "center", fontSize: 22, letterSpacing: "0.4em" }}
          value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="••••••" inputMode="numeric" maxLength={6} autoFocus
        />
        {error && <p style={{ color: "var(--status-overdue)", fontSize: 12.5, margin: "10px 0 0" }}>{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 14 }}>
          {loading ? "Signing in…" : "Enter Console"}
        </button>
      </form>
    </div>
  );
}
