"use client";
/* ==========================================================================
   First-time shop owner setup: enter shop info -> create owner account ->
   choose a 6-digit PIN -> enter CRM. Zero exposure to Supabase, org ids,
   or tokens — those are all handled server-side by /api/auth/setup. This
   is the ONLY place a new organization gets created; every other shop in
   the system is created the same way, through this same form.
   ========================================================================== */
import React from "react";
import { useRouter } from "next/navigation";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = React.useState({ shopName: "", ownerName: "", ownerEmail: "", ownerPhone: "", pin: "", pinConfirm: "" });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  function patch(p) { setForm(f => ({ ...f, ...p })); }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.shopName.trim() || !form.ownerName.trim() || !form.ownerEmail.trim()) {
      setError("Shop name, your name, and an email are required."); return;
    }
    if (!/^\d{6}$/.test(form.pin)) { setError("Choose a 6-digit access code."); return; }
    if (form.pin !== form.pinConfirm) { setError("Access codes don't match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: form.shopName, ownerName: form.ownerName,
          ownerEmail: form.ownerEmail, ownerPhone: form.ownerPhone, pin: form.pin,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Could not set up your shop."); return; }

      try {
        localStorage.setItem("vamp_last_shop_slug", data.slug);
        localStorage.setItem("vamp_last_shop_name", form.shopName);
      } catch (e2) { /* ignore */ }

      if (data.autoSignedIn) {
        router.push("/");
        router.refresh();
      } else {
        router.push("/login");
      }
    } catch (e3) {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loading-screen" style={{ flexDirection: "column", padding: "40px 16px" }}>
      <form className="card" style={{ width: 420 }} onSubmit={submit}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: "0.04em", marginBottom: 4, textAlign: "center" }}>Set up your shop</div>
        <p className="faint" style={{ fontSize: 12.5, marginTop: 0, marginBottom: 18, textAlign: "center" }}>
          This creates your shop's own private space in the CRM — nothing here is shared with any other shop.
        </p>

        <div className="field">
          <label>Shop name</label>
          <input className="input" value={form.shopName} onChange={e => patch({ shopName: e.target.value })} placeholder="e.g. ABC Auto Repair" autoFocus />
        </div>
        <div className="field">
          <label>Your name (shop owner)</label>
          <input className="input" value={form.ownerName} onChange={e => patch({ ownerName: e.target.value })} />
        </div>
        <div className="field-row">
          <div className="field">
            <label>Your email</label>
            <input className="input" type="email" value={form.ownerEmail} onChange={e => patch({ ownerEmail: e.target.value })} />
          </div>
          <div className="field">
            <label>Your phone (optional)</label>
            <input className="input" value={form.ownerPhone} onChange={e => patch({ ownerPhone: e.target.value })} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <label>Choose a 6-digit access code</label>
            <input className="input mono" value={form.pin} onChange={e => patch({ pin: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} placeholder="••••••" />
          </div>
          <div className="field">
            <label>Confirm access code</label>
            <input className="input mono" value={form.pinConfirm} onChange={e => patch({ pinConfirm: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" maxLength={6} placeholder="••••••" />
          </div>
        </div>
        <p className="faint" style={{ fontSize: 11.5, margin: "2px 0 14px" }}>
          You'll use this code to sign in every day, along with your shop name. You can change it later, and each employee you add gets their own code.
        </p>

        {error && <p style={{ color: "var(--status-overdue)", fontSize: 12.5, margin: "6px 0" }}>{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? "Setting up…" : "Create shop & enter CRM"}
        </button>
        <p className="faint" style={{ fontSize: 11.5, marginTop: 14, textAlign: "center" }}>
          Already have a shop? <a href="/login" style={{ color: "var(--accent)" }}>Sign in</a>
        </p>
      </form>
    </div>
  );
}
