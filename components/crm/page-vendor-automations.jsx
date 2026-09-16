"use client";
/* ==========================================================================
   Vendor/Automation Admin — replaces the prototype's hidden, keystroke-
   unlocked "Vamp Ops Console" (page-automations.js + the "vampadmin"
   listener in app.js). This page is only ever rendered inside the
   /vendor-admin route, which itself checks role==='vendor_admin' on the
   server before rendering anything (see app/vendor-admin/page.jsx) — so
   there is no client-side gate to bypass here, unlike the old build.

   Because a vendor admin isn't scoped to a single shop, this adds one
   thing the original page didn't need: an organization selector, so the
   vendor admin picks which shop's automations they're viewing/editing.
   Everything below that (categories, cards, the edit/new modal) is the
   same UI and logic as the original AutomationsPage/AutomationCard/
   AutomationModal, just reading `automations`/`actions` from
   useVendorAutomations() instead of a shared `db` prop.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { Modal, EmptyState } from "./ui";
import { AUTOMATION_CATEGORIES, AUTOMATION_CHANNELS, statusLabel, fmtDateShort } from "@/lib/crm/helpers";
import { useVendorAutomations } from "@/lib/crm/vendorAutomations";

function AutomationModal(props) {
  const { actions, automation, onClose } = props;
  const [form, setForm] = React.useState(() => automation || {
    name: "", category: "Other Automated Workflows", description: "", trigger: "",
    delayValue: 1, delayUnit: "days", channel: "sms", template: "", enabled: false
  });
  const [saving, setSaving] = React.useState(false);
  function patch(p) { setForm(f => ({ ...f, ...p })); }
  async function submit() {
    if (!form.name.trim()) { window.alert("Give this automation a name."); return; }
    setSaving(true);
    try {
      if (automation) await actions.updateAutomation(automation.id, form);
      else await actions.addAutomation(form);
      onClose();
    } catch (e) {
      window.alert("Could not save automation: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  }
  return React.createElement(Modal, {
    title: automation ? "Edit Automation" : "New Automation", onClose,
    footer: React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: submit, disabled: saving }, saving ? "Saving…" : "Save")
    )
  },
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Name"), React.createElement("input", { className: "input", value: form.name, onChange: e => patch({ name: e.target.value }) })),
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Category"),
      React.createElement("select", { className: "input", value: form.category, onChange: e => patch({ category: e.target.value }) }, AUTOMATION_CATEGORIES.map(c => React.createElement("option", { key: c, value: c }, c)))),
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Description"), React.createElement("textarea", { className: "input", rows: 2, value: form.description, onChange: e => patch({ description: e.target.value }) })),
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Trigger"), React.createElement("input", { className: "input", placeholder: "e.g. After a job is marked completed", value: form.trigger, onChange: e => patch({ trigger: e.target.value }) })),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Delay"), React.createElement("input", { type: "number", min: 0, className: "input", value: form.delayValue, onChange: e => patch({ delayValue: Number(e.target.value) }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Unit"),
        React.createElement("select", { className: "input", value: form.delayUnit, onChange: e => patch({ delayUnit: e.target.value }) },
          React.createElement("option", { value: "hours" }, "Hours"), React.createElement("option", { value: "days" }, "Days"))),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Channel"),
        React.createElement("select", { className: "input", value: form.channel, onChange: e => patch({ channel: e.target.value }) },
          AUTOMATION_CHANNELS.map(c => React.createElement("option", { key: c.value, value: c.value }, c.label))))
    ),
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Message template"),
      React.createElement("textarea", { className: "input mono", rows: 3, value: form.template, onChange: e => patch({ template: e.target.value }) })),
    React.createElement("p", { className: "faint", style: { fontSize: 11.5, margin: 0 } }, "Use placeholders like {{customer_first_name}}, {{shop_name}}, {{vehicle_year_make_model}}, {{appointment_date}}, {{invoice_number}}, {{balance_due}}.")
  );
}

function AutomationCard(props) {
  const { actions, automation, onEdit } = props;
  const a = automation;
  const recentCount = (a.log || []).reduce((s, l) => s + l.count, 0);
  const lastRun = (a.log || []).slice().sort((x, y) => new Date(y.date) - new Date(x.date))[0];

  async function handleDelete() {
    if (!window.confirm('"' + a.name + '" will stop running and its history will be removed. Delete it?')) return;
    await actions.removeAutomation(a.id);
  }

  return React.createElement("div", { className: "card" },
    React.createElement("div", { className: "card-title-row" },
      React.createElement("div", { className: "hstack" },
        React.createElement("label", { className: "switch" },
          React.createElement("input", { type: "checkbox", checked: a.enabled, onChange: e => actions.updateAutomation(a.id, { enabled: e.target.checked }) }),
          React.createElement("span", { className: "switch-track" }, React.createElement("span", { className: "switch-thumb" }))
        ),
        React.createElement("div", null,
          React.createElement("div", { className: "card-title" }, a.name),
          React.createElement("div", { className: "card-title-sub" }, a.trigger)
        )
      ),
      React.createElement("div", { className: "hstack" },
        React.createElement("span", { className: "pill", style: a.enabled ? { color: "var(--status-ready)", background: "var(--status-ready-bg)" } : { color: "var(--text-faint)", background: "var(--surface-3)" } }, a.enabled ? "Active" : "Paused"),
        React.createElement("button", { className: "btn btn-ghost btn-icon", onClick: () => onEdit(a) }, React.createElement(Icon, { name: "edit", size: 14 })),
        React.createElement("button", { className: "btn btn-ghost btn-icon", onClick: handleDelete }, React.createElement(Icon, { name: "trash", size: 14 }))
      )
    ),
    React.createElement("p", { className: "muted", style: { fontSize: 12.5, marginTop: 0 } }, a.description),
    React.createElement("div", { className: "field-row", style: { marginBottom: 12 } },
      React.createElement("div", { className: "detail-row", style: { flex: 1 } }, React.createElement("span", { className: "k" }, "Delay"), React.createElement("span", { className: "v" }, a.delayValue + " " + a.delayUnit)),
      React.createElement("div", { className: "detail-row", style: { flex: 1 } }, React.createElement("span", { className: "k" }, "Channel"), React.createElement("span", { className: "v" }, statusLabel(AUTOMATION_CHANNELS, a.channel))),
      React.createElement("div", { className: "detail-row", style: { flex: 1 } }, React.createElement("span", { className: "k" }, "Last run"), React.createElement("span", { className: "v" }, lastRun ? fmtDateShort(lastRun.date) + " · " + lastRun.count + " sent" : "Never"))
    ),
    React.createElement("div", { style: { background: "var(--surface-3)", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-md)", padding: "10px 12px" } },
      React.createElement("div", { className: "faint", style: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 } }, "Message template"),
      React.createElement("div", { className: "mono", style: { fontSize: 12, lineHeight: 1.5 } }, a.template)
    ),
    recentCount > 0 && React.createElement("div", { className: "faint", style: { fontSize: 11.5, marginTop: 10 } }, recentCount + " sent in the last 30 days")
  );
}

export function VendorAutomationsPage() {
  const { loading, error, organizations, selectedOrgId, setSelectedOrgId, automations, actions } = useVendorAutomations();
  const [editing, setEditing] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);

  if (loading) return React.createElement("div", { className: "section-stack" }, React.createElement("p", { className: "faint" }, "Loading…"));
  if (error) return React.createElement("div", { className: "section-stack" }, React.createElement("p", { style: { color: "var(--status-overdue)" } }, "Could not load: " + (error.message || String(error))));

  const byCategory = AUTOMATION_CATEGORIES.map(cat => ({
    category: cat, items: automations.filter(a => a.category === cat)
  })).filter(g => g.items.length > 0);

  return React.createElement("div", { className: "section-stack" },
    React.createElement("div", { className: "card", style: { borderColor: "var(--accent-soft-border)", background: "linear-gradient(180deg, var(--accent-soft), var(--surface))" } },
      React.createElement("div", { className: "hstack", style: { justifyContent: "space-between", flexWrap: "wrap", gap: 10 } },
        React.createElement("div", { className: "hstack" },
          React.createElement(Icon, { name: "bolt", size: 20, style: { color: "var(--accent)" } }),
          React.createElement("div", null,
            React.createElement("div", { className: "card-title" }, "Vendor / Automation Admin"),
            React.createElement("div", { className: "card-title-sub" }, "Platform staff only — controls the automated messages each shop sends to its customers.")
          )
        ),
        React.createElement("div", { className: "hstack" },
          React.createElement("select", {
            className: "input", style: { minWidth: 220 },
            value: selectedOrgId || "",
            onChange: e => setSelectedOrgId(e.target.value)
          }, organizations.map(o => React.createElement("option", { key: o.id, value: o.id }, o.name))),
          React.createElement("button", { className: "btn btn-primary", onClick: () => setShowNew(true), disabled: !selectedOrgId }, React.createElement(Icon, { name: "plus", size: 15 }), "New Automation")
        )
      )
    ),

    byCategory.length === 0 ? React.createElement(EmptyState, { icon: "bolt", title: "No automations for this shop yet" }) :
    byCategory.map(g => React.createElement("div", { key: g.category, className: "vstack", style: { gap: 12 } },
      React.createElement("div", { className: "faint", style: { fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" } }, g.category),
      g.items.map(a => React.createElement(AutomationCard, { key: a.id, actions, automation: a, onEdit: setEditing }))
    )),

    editing && React.createElement(AutomationModal, { actions, automation: editing, onClose: () => setEditing(null) }),
    showNew && React.createElement(AutomationModal, { actions, onClose: () => setShowNew(false) })
  );
}
