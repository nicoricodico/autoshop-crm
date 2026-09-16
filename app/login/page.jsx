"use client";
/* ==========================================================================
   Login — "Shop/Account name + 6-digit access code + Enter CRM", backed by
   a real Supabase session (see /api/auth/pin-login). No PIN is ever
   compared in the browser; this page only collects the two fields and
   shows whatever the server says.

   The shop slug is remembered in localStorage purely as a device
   convenience (so a returning employee just sees their shop name and
   types their code, matching the "CRM / ABC Auto Repair / Enter your
   6-digit access code" mockup) — it carries no security weight, since the
   server re-derives everything from the PIN match itself.
   ========================================================================== */
import React from "react";
import { useRouter } from "next/navigation";

const LAST_SHOP_KEY = "vamp_last_shop_slug";
const LAST_SHOP_NAME_KEY = "vamp_last_shop_name";

export default function LoginPage() {
  const router = useRouter();
  const [rememberedSlug, setRememberedSlug] = React.useState("");
  const [rememberedName, setRememberedName] = React.useState("");
  const [shopInput, setShopInput] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    try {
      const slug = localStorage.getItem(LAST_SHOP_KEY);
      const name = localStorage.getItem(LAST_SHOP_NAME_KEY);
      if (slug) { setRememberedSlug(slug); setRememberedName(name || slug); }
    } catch (e) { /* ignore */ }
  }, []);

  function switchShop() {
    setRememberedSlug("");
    setRememberedName("");
    try { localStorage.removeItem(LAST_SHOP_KEY); localStorage.removeItem(LAST_SHOP_NAME_KEY); } catch (e) { /* ignore */ }
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    const slug = (rememberedSlug || shopInput).trim();
    if (!slug) { setError("Enter your shop or account name."); return; }
    if (!/^\d{6}$/.test(pin)) { setError("Enter your 6-digit access code."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopSlug: slug, pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not sign in.");
        setPin("");
        return;
      }
      try {
        localStorage.setItem(LAST_SHOP_KEY, slug);
        localStorage.setItem(LAST_SHOP_NAME_KEY, rememberedName || shopInput || slug);
      } catch (e2) { /* ignore */ }
      router.push("/");
      router.refresh();
    } catch (e3) {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loading-screen" style={{ flexDirection: "column" }}>
      <form className="card" style={{ width: 340, textAlign: "center" }} onSubmit={submit}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, letterSpacing: "0.04em", marginBottom: 4 }}>CRM</div>
        {rememberedSlug ? (
          <React.Fragment>
            <div className="card-title" style={{ marginBottom: 2 }}>{rememberedName}</div>
            <p className="faint" style={{ fontSize: 12.5, marginTop: 0, marginBottom: 16 }}>
              Enter your 6-digit access code
            </p>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <p className="faint" style={{ fontSize: 12.5, marginTop: 0, marginBottom: 16 }}>
              Enter your shop name and access code
            </p>
            <div className="field" style={{ textAlign: "left", marginBottom: 10 }}>
              <label>Shop / account name</label>
              <input className="input" value={shopInput} onChange={e => setShopInput(e.target.value)} placeholder="e.g. abc-auto-repair" autoFocus />
            </div>
          </React.Fragment>
        )}
        <div className="field" style={{ textAlign: "left", marginBottom: 6 }}>
          {rememberedSlug && <label>Access code</label>}
          <input
            className="input mono" style={{ textAlign: "center", fontSize: 22, letterSpacing: "0.4em" }}
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••" inputMode="numeric" maxLength={6} autoFocus={!!rememberedSlug}
          />
        </div>
        {error && <p style={{ color: "var(--status-overdue)", fontSize: 12.5, margin: "6px 0" }}>{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 10 }}>
          {loading ? "Signing in…" : "Enter CRM"}
        </button>
        {rememberedSlug && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={switchShop}>
            Not your shop? Switch shop
          </button>
        )}
        <p className="faint" style={{ fontSize: 11.5, marginTop: 18 }}>
          Setting up a new shop? <a href="/setup" style={{ color: "var(--accent)" }}>Create your account</a>
        </p>
      </form>
    </div>
  );
}
