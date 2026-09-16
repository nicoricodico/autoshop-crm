"use client";
/* ==========================================================================
   Page 7 — Vehicle History. Ported verbatim from the prototype's
   page-vehicles.js — only the top imports changed.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { Drawer, EmptyState, StatusPill } from "./ui";
import {
  findById, fmtDateShort, fmtMoney, computeTotals, effectiveInvoiceStatus,
  statusLabel, startOfDay, JOB_STATUSES, INVOICE_STATUSES, FOLLOWUP_TYPES
} from "@/lib/crm/helpers";

export function VehicleDrawer(props) {
  const { db, actions, ui, vehicleId, onClose, onOpenCustomer, onOpenJob, onOpenInvoice } = props;
  const v = findById(db.vehicles, vehicleId);
  const [tab, setTab] = React.useState("history");
  if (!v) return null;
  const owner = findById(db.customers, v.customerId);

  const jobEvents = db.jobs.filter(j => j.vehicleId === v.id).map(j => ({
    date: new Date(j.createdAt), kind: "job", job: j
  }));
  const fuEvents = db.followUps.filter(f => f.vehicleId === v.id).map(f => ({
    date: new Date(f.createdAt || f.dueDate), kind: "followup", fu: f
  }));
  const events = jobEvents.concat(fuEvents).sort((a, b) => b.date - a.date);

  const invoices = db.invoices.filter(i => i.vehicleId === v.id);

  function iconFor(kind, job) {
    if (kind === "followup") return "bell";
    if (job && job.status === "completed") return "checkCircle";
    return "wrench";
  }

  return React.createElement(Drawer, {
    title: v.year + " " + v.make + " " + v.model, subtitle: owner ? "Owner: " + owner.name : "", wide: true, onClose,
    headerExtra: owner && React.createElement("button", { className: "btn btn-ghost btn-sm", style: { marginTop: 6, padding: "4px 0" }, onClick: () => onOpenCustomer(v.customerId) }, "View owner ", React.createElement(Icon, { name: "arrowRight", size: 13 })),
    tabs: [{ key: "overview", label: "Overview" }, { key: "history", label: "History" }, { key: "invoices", label: "Invoices (" + invoices.length + ")" }],
    activeTab: tab, onTab: setTab
  },
    tab === "overview" && React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Vehicle details"),
      React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "VIN"), React.createElement("span", { className: "v mono" }, v.vin || "—")),
      React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Plate"), React.createElement("span", { className: "v mono" }, v.plate || "—")),
      React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Color"), React.createElement("span", { className: "v" }, v.color || "—")),
      React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Trim"), React.createElement("span", { className: "v" }, v.trim || "—")),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Current mileage (km)"),
        React.createElement("input", { type: "number", className: "input", value: v.mileage, onChange: e => actions.updateVehicle(v.id, { mileage: Number(e.target.value) }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Notes"),
        React.createElement("textarea", { className: "input", rows: 3, value: v.notes || "", onChange: e => actions.updateVehicle(v.id, { notes: e.target.value }) }))
    ),

    tab === "history" && (events.length === 0 ? React.createElement(EmptyState, { icon: "history", title: "No history yet" }) :
      React.createElement("div", { className: "timeline" },
        events.map((ev, i) => {
          if (ev.kind === "job") {
            const j = ev.job;
            const tech = findById(db.team, j.technicianId);
            const totals = computeTotals(j.lineItems, 0, "percent", db.settings.taxRate, []);
            return React.createElement("div", { key: "j" + j.id, className: "timeline-item" },
              React.createElement("div", { className: "timeline-dot" }, React.createElement(Icon, { name: iconFor("job", j), size: 14 })),
              React.createElement("div", { className: "timeline-content clickable", onClick: () => onOpenJob(j.id) },
                React.createElement("div", { className: "timeline-title-row" },
                  React.createElement("span", { className: "timeline-title" }, j.concern),
                  React.createElement("span", { className: "timeline-date" }, fmtDateShort(j.createdAt))
                ),
                React.createElement("div", { className: "timeline-desc" }, j.diagnosis || "No diagnosis notes."),
                React.createElement("div", { className: "hstack", style: { marginTop: 6, gap: 8 } },
                  React.createElement(StatusPill, { status: j.status, list: JOB_STATUSES }),
                  tech && React.createElement("span", { className: "faint", style: { fontSize: 11.5 } }, tech.name),
                  j.lineItems.length > 0 && React.createElement("span", { className: "faint mono", style: { fontSize: 11.5 } }, fmtMoney(totals.total))
                )
              )
            );
          }
          const f = ev.fu;
          const overdue = f.status === "open" && new Date(f.dueDate) < startOfDay(new Date());
          return React.createElement("div", { key: "f" + f.id, className: "timeline-item" },
            React.createElement("div", { className: "timeline-dot" }, React.createElement(Icon, { name: "bell", size: 14 })),
            React.createElement("div", { className: "timeline-content" },
              React.createElement("div", { className: "timeline-title-row" },
                React.createElement("span", { className: "timeline-title" }, statusLabel(FOLLOWUP_TYPES, f.type)),
                React.createElement("span", { className: "timeline-date" }, fmtDateShort(f.dueDate))
              ),
              React.createElement("div", { className: "timeline-desc" }, f.notes),
              React.createElement("span", { className: "pill", style: f.status === "done" ? { color: "var(--status-ready)", background: "var(--status-ready-bg)" } : overdue ? { color: "var(--status-overdue)", background: "var(--status-overdue-bg)" } : { color: "var(--text-faint)", background: "var(--surface-3)" } }, f.status === "done" ? "Done" : overdue ? "Overdue" : "Open")
            )
          );
        })
      )
    ),

    tab === "invoices" && (invoices.length === 0 ? React.createElement(EmptyState, { icon: "receipt", title: "No invoices for this vehicle" }) :
      React.createElement("div", { className: "list-plain" },
        invoices.map(inv => { const totals = computeTotals(inv.lineItems, inv.discountValue, inv.discountType, inv.taxRate, inv.payments); return React.createElement("div", { key: inv.id, className: "list-item clickable", onClick: () => onOpenInvoice(inv.id) },
          React.createElement("div", { className: "vstack" }, React.createElement("span", { style: { fontWeight: 700 } }, inv.invoiceNumber), React.createElement("span", { className: "faint", style: { fontSize: 11.5 } }, fmtDateShort(inv.date))),
          React.createElement("div", { className: "hstack" }, React.createElement("span", { className: "mono", style: { fontWeight: 700 } }, fmtMoney(totals.total)), React.createElement(StatusPill, { status: effectiveInvoiceStatus(inv), list: INVOICE_STATUSES }))
        ); })
      )
    )
  );
}

export function VehiclesPage(props) {
  const { db, onOpenVehicle, onOpenCustomer, onOpenJob, onOpenInvoice, actions, ui } = props;
  const [query, setQuery] = React.useState("");
  const [openVehicle, setOpenVehicle] = React.useState(null);

  const rows = db.vehicles.filter(v => {
    if (!query.trim()) return true;
    const owner = findById(db.customers, v.customerId);
    const q = query.toLowerCase();
    return (v.make + v.model + (v.plate || "") + (v.vin || "") + (owner ? owner.name : "")).toLowerCase().includes(q);
  }).sort((a, b) => (a.make + a.model).localeCompare(b.make + b.model));

  return React.createElement("div", { className: "section-stack" },
    React.createElement("div", { className: "input-with-icon" }, React.createElement(Icon, { name: "search", size: 14 }), React.createElement("input", { className: "input", placeholder: "Search by make, model, plate, VIN, or owner", value: query, onChange: e => setQuery(e.target.value), style: { width: 340 } })),
    React.createElement("div", { className: "card", style: { padding: 0 } },
      rows.length === 0 ? React.createElement(EmptyState, { icon: "car", title: "No vehicles found" }) :
      React.createElement("div", { className: "table-wrap", style: { border: "none" } },
        React.createElement("table", { className: "data-table" },
          React.createElement("thead", null, React.createElement("tr", null,
            React.createElement("th", null, "Vehicle"), React.createElement("th", null, "Owner"), React.createElement("th", null, "Plate"),
            React.createElement("th", null, "Mileage"), React.createElement("th", null, "Open Jobs")
          )),
          React.createElement("tbody", null,
            rows.map(v => {
              const owner = findById(db.customers, v.customerId);
              const openJobs = db.jobs.filter(j => j.vehicleId === v.id && j.status !== "completed" && j.status !== "cancelled").length;
              return React.createElement("tr", { key: v.id, className: "row-click", onClick: () => setOpenVehicle(v.id) },
                React.createElement("td", { style: { fontWeight: 700 } }, v.year + " " + v.make + " " + v.model, React.createElement("div", { className: "cell-sub" }, v.color)),
                React.createElement("td", null, owner ? owner.name : "—"),
                React.createElement("td", { className: "mono" }, v.plate || "—"),
                React.createElement("td", { className: "mono" }, v.mileage.toLocaleString() + " km"),
                React.createElement("td", null, openJobs > 0 ? React.createElement("span", { className: "pill pill-in_progress" }, openJobs) : "—")
              );
            })
          )
        )
      )
    ),
    openVehicle && React.createElement(VehicleDrawer, { db, actions, ui, vehicleId: openVehicle, onClose: () => setOpenVehicle(null), onOpenCustomer, onOpenJob, onOpenInvoice })
  );
}
