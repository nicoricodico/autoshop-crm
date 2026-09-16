"use client";
/* ==========================================================================
   Page 8 — Settings. Ported from the prototype's page-settings.js with one
   deliberate removal: the "Reset demo data" card/action is dropped, since
   actions.resetDemoData() has no meaning against a real Supabase-backed
   organization (there is no "demo data" to reset — this is a real shop's
   live records). Everything else — business info, hours, rates & tax,
   payment methods, notifications, team roles, line-item library pointer —
   is unchanged, just re-pointed at the new imports.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { TEAM_ROLES } from "@/lib/crm/helpers";

const HOURS_DAYS = [["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"]];

function ChangePinCard(props) {
  const { ui } = props;
  const [currentPin, setCurrentPin] = React.useState("");
  const [newPin, setNewPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    if (!/^\d{6}$/.test(newPin)) { ui.toast("Choose a new 6-digit access code.", { danger: true }); return; }
    if (newPin !== confirmPin) { ui.toast("New codes don't match.", { danger: true }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { ui.toast(data.error || "Could not change access code.", { danger: true }); return; }
      ui.toast("Access code updated.");
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
    } finally {
      setSaving(false);
    }
  }

  return React.createElement("div", { className: "card" },
    React.createElement("div", { className: "card-title-row" }, React.createElement("div", { className: "card-title" }, "Your Access Code")),
    React.createElement("p", { className: "muted", style: { fontSize: 12.5, marginTop: 0 } }, "Change the 6-digit code you use to sign in. You'll need your current code."),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Current code"),
        React.createElement("input", { className: "input mono", value: currentPin, onChange: e => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6)), inputMode: "numeric", maxLength: 6, placeholder: "••••••" })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "New code"),
        React.createElement("input", { className: "input mono", value: newPin, onChange: e => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6)), inputMode: "numeric", maxLength: 6, placeholder: "••••••" })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Confirm new code"),
        React.createElement("input", { className: "input mono", value: confirmPin, onChange: e => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6)), inputMode: "numeric", maxLength: 6, placeholder: "••••••" }))
    ),
    React.createElement("button", { className: "btn btn-primary btn-sm", onClick: submit, disabled: saving }, saving ? "Saving…" : "Update access code")
  );
}

export function SettingsPage(props) {
  const { db, actions, ui, navigate } = props;
  const s = db.settings;
  const [newMethod, setNewMethod] = React.useState("");
  const [newRole, setNewRole] = React.useState("");
  const fileRef = React.useRef(null);

  function patch(p) { actions.updateSettings(p); }
  function patchHours(day, val) { actions.updateSettings({ hours: { ...s.hours, [day]: val } }); }

  function handleLogoFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { patch({ logoDataUrl: reader.result }); ui.toast("Logo updated."); };
    reader.readAsDataURL(file);
  }

  return React.createElement("div", { className: "section-stack" },
    React.createElement("div", { className: "grid-2" },
      React.createElement("div", { className: "card" },
        React.createElement("div", { className: "card-title-row" }, React.createElement("div", { className: "card-title" }, "Business Information")),
        React.createElement("div", { className: "hstack", style: { marginBottom: 14 } },
          React.createElement("div", {
            style: { width: 56, height: 56, borderRadius: 12, background: s.logoDataUrl ? "transparent" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }
          }, s.logoDataUrl ? React.createElement("img", { src: s.logoDataUrl, style: { width: "100%", height: "100%", objectFit: "cover" } }) : React.createElement("span", { style: { fontFamily: "var(--font-display)", fontWeight: 700, color: "#fff", fontSize: 18 } }, s.logoText)),
          React.createElement("div", { className: "vstack" },
            React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => fileRef.current && fileRef.current.click() }, "Upload logo"),
            React.createElement("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: handleLogoFile })
          )
        ),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Business name"), React.createElement("input", { className: "input", value: s.businessName, onChange: e => patch({ businessName: e.target.value }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Address"), React.createElement("input", { className: "input", value: s.address, onChange: e => patch({ address: e.target.value }) })),
        React.createElement("div", { className: "field-row" },
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Phone"), React.createElement("input", { className: "input", value: s.phone, onChange: e => patch({ phone: e.target.value }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Email"), React.createElement("input", { className: "input", value: s.email, onChange: e => patch({ email: e.target.value }) }))
        )
      ),

      React.createElement("div", { className: "card" },
        React.createElement("div", { className: "card-title-row" }, React.createElement("div", { className: "card-title" }, "Business Hours")),
        React.createElement("div", { className: "vstack", style: { gap: 8 } },
          HOURS_DAYS.map(([k, label]) => React.createElement("div", { key: k, className: "hstack", style: { justifyContent: "space-between" } },
            React.createElement("span", { style: { fontSize: 13, width: 90 } }, label),
            React.createElement("input", { className: "input", value: s.hours[k], onChange: e => patchHours(k, e.target.value), style: { maxWidth: 220 } })
          ))
        )
      )
    ),

    React.createElement("div", { className: "grid-2" },
      React.createElement("div", { className: "card" },
        React.createElement("div", { className: "card-title-row" }, React.createElement("div", { className: "card-title" }, "Rates & Tax")),
        React.createElement("div", { className: "field-row" },
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Default labour rate ($/hr)"), React.createElement("input", { type: "number", className: "input", value: s.laborRate, onChange: e => patch({ laborRate: Number(e.target.value) }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Default tax rate (%)"), React.createElement("input", { type: "number", className: "input", value: s.taxRate, onChange: e => patch({ taxRate: Number(e.target.value) }) }))
        ),
        React.createElement("div", { className: "field-row" },
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Invoice number prefix"), React.createElement("input", { className: "input", value: s.invoicePrefix, onChange: e => patch({ invoicePrefix: e.target.value }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Next invoice #"), React.createElement("input", { type: "number", className: "input", value: s.nextInvoiceNumber, onChange: e => patch({ nextInvoiceNumber: Number(e.target.value) }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Default due (days)"), React.createElement("input", { type: "number", className: "input", value: s.defaultDueDays, onChange: e => patch({ defaultDueDays: Number(e.target.value) }) }))
        )
      ),

      React.createElement("div", { className: "card" },
        React.createElement("div", { className: "card-title-row" }, React.createElement("div", { className: "card-title" }, "Payment Methods")),
        React.createElement("div", { className: "filter-chip-row", style: { marginBottom: 12 } },
          s.paymentMethods.map(m => React.createElement("div", { key: m, className: "tag", style: { display: "flex", alignItems: "center", gap: 6, padding: "5px 10px" } },
            m, React.createElement("span", { style: { cursor: "pointer" }, onClick: () => patch({ paymentMethods: s.paymentMethods.filter(x => x !== m) }) }, React.createElement(Icon, { name: "x", size: 11 }))
          ))
        ),
        React.createElement("div", { className: "hstack" },
          React.createElement("input", { className: "input", placeholder: "Add a payment method…", value: newMethod, onChange: e => setNewMethod(e.target.value) }),
          React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => { if (newMethod.trim()) { patch({ paymentMethods: [...s.paymentMethods, newMethod.trim()] }); setNewMethod(""); } } }, "Add")
        )
      )
    ),

    React.createElement("div", { className: "grid-2" },
      React.createElement("div", { className: "card" },
        React.createElement("div", { className: "card-title-row" }, React.createElement("div", { className: "card-title" }, "Notifications")),
        React.createElement("div", { className: "vstack", style: { gap: 10 } },
          [["smsReminders", "SMS appointment reminders to customers"], ["emailReceipts", "Email invoice receipts automatically"], ["followUpDigest", "Daily follow-up digest for staff"], ["lowPartsAlerts", "Alert when a job is waiting on parts too long"]].map(([k, label]) =>
            React.createElement("label", { key: k, className: "checkbox-row" },
              React.createElement("input", { type: "checkbox", checked: !!s.notifications[k], onChange: e => patch({ notifications: { ...s.notifications, [k]: e.target.checked } }) }),
              label
            ))
        )
      ),

      React.createElement("div", { className: "card" },
        React.createElement("div", { className: "card-title-row" }, React.createElement("div", { className: "card-title" }, "Team Roles")),
        React.createElement("div", { className: "filter-chip-row", style: { marginBottom: 12 } },
          TEAM_ROLES.map(r => React.createElement("div", { key: r, className: "tag" }, r)),
          (s.customRoles || []).map(r => React.createElement("div", { key: r, className: "tag", style: { display: "flex", alignItems: "center", gap: 6 } },
            r, React.createElement("span", { style: { cursor: "pointer" }, onClick: () => patch({ customRoles: s.customRoles.filter(x => x !== r) }) }, React.createElement(Icon, { name: "x", size: 11 }))
          ))
        ),
        React.createElement("div", { className: "hstack" },
          React.createElement("input", { className: "input", placeholder: "Add a custom role…", value: newRole, onChange: e => setNewRole(e.target.value) }),
          React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => { if (newRole.trim()) { patch({ customRoles: [...(s.customRoles || []), newRole.trim()] }); setNewRole(""); } } }, "Add")
        )
      )
    ),

    React.createElement("div", { className: "card" },
      React.createElement("div", { className: "card-title-row" },
        React.createElement("div", null, React.createElement("div", { className: "card-title" }, "Default Services & Line-Item Library"), React.createElement("div", { className: "card-title-sub" }, db.lineItemLibrary.length + " saved items")),
        React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => navigate("invoicing") }, "Manage library ", React.createElement(Icon, { name: "arrowRight", size: 14 }))
      ),
      React.createElement("p", { className: "muted", style: { fontSize: 12.5, margin: 0 } }, "Reusable parts, labour, and service templates live under Invoicing & Line Items → Line Item Library, so the same list is available when building estimates and invoices.")
    ),

    React.createElement(ChangePinCard, { ui })
  );
}
