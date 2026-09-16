"use client";
/* ==========================================================================
   Page 6 — Follow-Ups. Ported verbatim from the prototype's
   page-followups.js — only the top imports changed.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { Modal, Avatar } from "./ui";
import {
  findById, fmtDateShort, statusLabel, startOfDay, addDays, FOLLOWUP_TYPES
} from "@/lib/crm/helpers";

function FollowUpModal(props) {
  const { db, actions, ui, followUp, onClose } = props;
  const [form, setForm] = React.useState(() => followUp ? {
    ...followUp, dueDateStr: new Date(followUp.dueDate).toISOString().slice(0, 10)
  } : {
    type: "callback", customerId: db.customers[0] ? db.customers[0].id : "", vehicleId: "", jobId: null,
    dueDateStr: new Date().toISOString().slice(0, 10), assignedTo: db.team[0] ? db.team[0].id : "", notes: "", status: "open"
  });
  function patch(p) { setForm(f => ({ ...f, ...p })); }
  const vehicles = form.customerId ? db.vehicles.filter(v => v.customerId === form.customerId) : [];

  function submit() {
    if (!form.customerId) { ui.toast("Choose a customer.", { danger: true }); return; }
    const payload = { type: form.type, customerId: form.customerId, vehicleId: form.vehicleId || null, dueDate: new Date(form.dueDateStr), assignedTo: form.assignedTo, notes: form.notes, status: form.status };
    if (followUp) { actions.updateFollowUp(followUp.id, payload); ui.toast("Follow-up updated."); }
    else { actions.addFollowUp(payload); ui.toast("Follow-up created."); }
    onClose();
  }

  return React.createElement(Modal, {
    title: followUp ? "Edit Follow-up" : "New Follow-up", onClose,
    footer: React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: submit }, "Save")
    )
  },
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Type"),
      React.createElement("select", { className: "input", value: form.type, onChange: e => patch({ type: e.target.value }) },
        FOLLOWUP_TYPES.map(t => React.createElement("option", { key: t.value, value: t.value }, t.label)))),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Customer"),
        React.createElement("select", { className: "input", value: form.customerId, onChange: e => patch({ customerId: e.target.value, vehicleId: "" }) },
          db.customers.map(c => React.createElement("option", { key: c.id, value: c.id }, c.name)))),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Vehicle (optional)"),
        React.createElement("select", { className: "input", value: form.vehicleId || "", onChange: e => patch({ vehicleId: e.target.value }) },
          React.createElement("option", { value: "" }, "None"),
          vehicles.map(v => React.createElement("option", { key: v.id, value: v.id }, v.year + " " + v.make + " " + v.model))))
    ),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Due date"), React.createElement("input", { type: "date", className: "input", value: form.dueDateStr, onChange: e => patch({ dueDateStr: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Assign to"),
        React.createElement("select", { className: "input", value: form.assignedTo, onChange: e => patch({ assignedTo: e.target.value }) },
          db.team.map(t => React.createElement("option", { key: t.id, value: t.id }, t.name))))
    ),
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Notes"), React.createElement("textarea", { className: "input", rows: 3, value: form.notes, onChange: e => patch({ notes: e.target.value }) }))
  );
}

export function FollowUpsPage(props) {
  const { db, actions, ui, onOpenCustomer } = props;
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [editing, setEditing] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);

  const today = startOfDay(new Date());
  const filtered = db.followUps.filter(f => typeFilter === "all" || f.type === typeFilter);

  const overdue = filtered.filter(f => f.status === "open" && new Date(f.dueDate) < today).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const dueSoon = filtered.filter(f => f.status === "open" && new Date(f.dueDate) >= today && new Date(f.dueDate) <= addDays(today, 7)).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const upcoming = filtered.filter(f => f.status === "open" && new Date(f.dueDate) > addDays(today, 7)).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const done = filtered.filter(f => f.status === "done").sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)).slice(0, 12);

  const columns = [
    { key: "overdue", label: "Overdue", items: overdue, color: "var(--status-overdue)" },
    { key: "soon", label: "Due This Week", items: dueSoon, color: "var(--status-approval)" },
    { key: "upcoming", label: "Upcoming", items: upcoming, color: "var(--status-progress)" },
    { key: "done", label: "Completed", items: done, color: "var(--status-ready)" }
  ];

  function card(f) {
    const c = findById(db.customers, f.customerId);
    const v = f.vehicleId ? findById(db.vehicles, f.vehicleId) : null;
    const tech = findById(db.team, f.assignedTo);
    return React.createElement("div", { key: f.id, className: "kanban-card", onClick: () => setEditing(f) },
      React.createElement("div", { className: "tag", style: { marginBottom: 6 } }, statusLabel(FOLLOWUP_TYPES, f.type)),
      React.createElement("div", { className: "kanban-card-title" }, c ? c.name : "—"),
      React.createElement("div", { className: "faint", style: { fontSize: 11.5 } }, v ? v.year + " " + v.make + " " + v.model : ""),
      f.notes && React.createElement("div", { className: "faint", style: { fontSize: 11.5, marginTop: 4 } }, f.notes.length > 80 ? f.notes.slice(0, 80) + "…" : f.notes),
      React.createElement("div", { className: "kanban-card-meta" },
        React.createElement("span", null, fmtDateShort(f.dueDate)),
        tech && React.createElement(Avatar, { name: tech.name, color: tech.color, size: 20 })
      ),
      f.status === "open" && React.createElement("button", {
        className: "btn btn-secondary btn-sm btn-block", style: { marginTop: 8 },
        onClick: (e) => { e.stopPropagation(); actions.completeFollowUp(f.id); ui.toast("Marked complete."); }
      }, React.createElement(Icon, { name: "check", size: 13 }), "Mark done")
    );
  }

  return React.createElement("div", { className: "section-stack" },
    React.createElement("div", { className: "hstack", style: { justifyContent: "space-between", flexWrap: "wrap", gap: 10 } },
      React.createElement("div", { className: "filter-chip-row" },
        React.createElement("div", { className: "filter-chip" + (typeFilter === "all" ? " active" : ""), onClick: () => setTypeFilter("all") }, "All types"),
        FOLLOWUP_TYPES.map(t => React.createElement("div", { key: t.value, className: "filter-chip" + (typeFilter === t.value ? " active" : ""), onClick: () => setTypeFilter(t.value) }, t.label))
      ),
      React.createElement("button", { className: "btn btn-primary", onClick: () => setShowNew(true) }, React.createElement(Icon, { name: "plus", size: 15 }), "New Follow-up")
    ),

    React.createElement("div", { className: "kanban" },
      columns.map(col => React.createElement("div", { key: col.key },
        React.createElement("div", { className: "kanban-col-head" },
          React.createElement("span", { className: "kanban-col-title" }, col.label),
          React.createElement("span", { className: "badge-count", style: { background: col.color } }, col.items.length)
        ),
        col.items.length === 0 ? React.createElement("div", { className: "faint", style: { fontSize: 12, padding: "6px 2px" } }, "Nothing here.") : col.items.map(card)
      ))
    ),

    editing && React.createElement(FollowUpModal, { db, actions, ui, followUp: editing, onClose: () => setEditing(null) }),
    showNew && React.createElement(FollowUpModal, { db, actions, ui, onClose: () => setShowNew(false) })
  );
}
