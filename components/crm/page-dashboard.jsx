"use client";
/* ==========================================================================
   Page 1 — Daily Operations (dashboard). Ported verbatim from the
   prototype's page-dashboard.js — only the top imports changed.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { KPITile, StatusPill, Avatar, EmptyState } from "./ui";
import {
  findById, fmtMoney, fmtDateShort, isSameDay, startOfDay, addDays,
  statusLabel, computeTotals, JOB_STATUSES, FOLLOWUP_TYPES
} from "@/lib/crm/helpers";

export function DashboardPage(props) {
  const { db, onOpenCustomer, onOpenVehicle, onOpenJob, navigate, ui, actions } = props;
  const today = new Date();

  const stats = React.useMemo(() => {
    const apptsToday = db.appointments.filter(a => isSameDay(a.start, today) && a.status !== "cancelled");
    const activeJobs = db.jobs.filter(j => j.status !== "completed" && j.status !== "cancelled");
    const inShop = activeJobs.filter(j => ["in_progress", "waiting_approval", "waiting_parts", "ready_pickup"].includes(j.status));
    const waitingApproval = activeJobs.filter(j => j.status === "waiting_approval");
    const waitingParts = activeJobs.filter(j => j.status === "waiting_parts");
    const readyPickup = activeJobs.filter(j => j.status === "ready_pickup");
    const followUpsDue = db.followUps.filter(f => f.status === "open" && new Date(f.dueDate) <= startOfDay(addDays(today, 1)));
    const unpaidInvoices = db.invoices.filter(i => ["sent", "overdue", "partially_paid"].includes(i.status));
    const unpaidBalance = unpaidInvoices.reduce((s, i) => s + computeTotals(i.lineItems, i.discountValue, i.discountType, i.taxRate, i.payments).balance, 0);

    let todaysRevenue = 0, paidToday = 0, partialToday = 0;
    db.invoices.forEach(inv => {
      (inv.payments || []).forEach(p => {
        if (isSameDay(p.date, today)) {
          todaysRevenue += Number(p.amount) || 0;
          if (inv.status === "paid") paidToday += Number(p.amount) || 0;
          else partialToday += Number(p.amount) || 0;
        }
      });
    });

    return { apptsToday, activeJobs, inShop, waitingApproval, waitingParts, readyPickup, followUpsDue, unpaidInvoices, unpaidBalance, todaysRevenue, paidToday, partialToday };
  }, [db]);

  const linkedFollowUps = React.useMemo(() => {
    return db.followUps
      .filter(f => f.status === "open")
      .map(f => ({ f, job: f.jobId ? findById(db.jobs, f.jobId) : null }))
      .sort((a, b) => new Date(a.f.dueDate) - new Date(b.f.dueDate))
      .slice(0, 6);
  }, [db]);

  function techName(id) { const t = findById(db.team, id); return t ? t.name : "Unassigned"; }
  function techColor(id) { const t = findById(db.team, id); return t ? t.color : "var(--surface-3)"; }

  return React.createElement("div", { className: "section-stack" },
    React.createElement("div", { className: "kpi-grid" },
      React.createElement(KPITile, { icon: "calendar", label: "Scheduled Today", value: stats.apptsToday.length, color: "var(--tech-1)", onClick: () => navigate("scheduling") }),
      React.createElement(KPITile, { icon: "car", label: "Vehicles In Shop", value: stats.inShop.length, color: "var(--tech-2)" }),
      React.createElement(KPITile, { icon: "clock", label: "Waiting Approval", value: stats.waitingApproval.length, color: "var(--status-approval)" }),
      React.createElement(KPITile, { icon: "wrench", label: "Waiting on Parts", value: stats.waitingParts.length, color: "var(--status-parts)" }),
      React.createElement(KPITile, { icon: "checkCircle", label: "Ready for Pickup", value: stats.readyPickup.length, color: "var(--status-ready)" }),
      React.createElement(KPITile, { icon: "bell", label: "Follow-ups Due", value: stats.followUpsDue.length, color: "var(--accent)", onClick: () => navigate("followups") }),
      React.createElement(KPITile, { icon: "receipt", label: "Unpaid Invoices", value: stats.unpaidInvoices.length, sub: fmtMoney(stats.unpaidBalance), color: "var(--status-overdue)", onClick: () => navigate("invoicing") }),
      React.createElement(KPITile, { icon: "dollar", label: "Today's Revenue", value: fmtMoney(stats.todaysRevenue), color: "var(--status-ready)" }),
      React.createElement(KPITile, { icon: "wallet", label: "Paid in Full", value: fmtMoney(stats.paidToday), color: "var(--status-ready)" }),
      React.createElement(KPITile, { icon: "clock", label: "Partial / Deposits", value: fmtMoney(stats.partialToday), color: "var(--status-partial)" })
    ),

    React.createElement("div", { className: "grid-2", style: { gridTemplateColumns: "2fr 1fr" } },
      React.createElement("div", { className: "card" },
        React.createElement("div", { className: "card-title-row" },
          React.createElement("div", null,
            React.createElement("div", { className: "card-title" }, "Active Jobs"),
            React.createElement("div", { className: "card-title-sub" }, stats.activeJobs.length + " jobs in the pipeline")
          ),
          React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => navigate("scheduling") }, "Open Scheduling", React.createElement(Icon, { name: "arrowRight", size: 14 }))
        ),
        stats.activeJobs.length === 0 ? React.createElement(EmptyState, { icon: "wrench", title: "No active jobs", subtitle: "Create a job from Scheduling to see it here." }) :
        React.createElement("div", { className: "table-wrap" },
          React.createElement("table", { className: "data-table" },
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", null, "Customer"), React.createElement("th", null, "Vehicle"), React.createElement("th", null, "Job"),
              React.createElement("th", null, "Status"), React.createElement("th", null, "Est. Cost"), React.createElement("th", null, "Technician")
            )),
            React.createElement("tbody", null,
              stats.activeJobs.map(j => {
                const c = findById(db.customers, j.customerId);
                const v = findById(db.vehicles, j.vehicleId);
                const totals = computeTotals(j.lineItems, 0, "percent", db.settings.taxRate, []);
                return React.createElement("tr", { key: j.id, className: "row-click", onClick: () => onOpenJob(j.id) },
                  React.createElement("td", null, React.createElement("span", { className: "link-cell", onClick: e => { e.stopPropagation(); onOpenCustomer(j.customerId); } }, c ? c.name : "—")),
                  React.createElement("td", null, v ? React.createElement("span", { className: "link-cell", onClick: e => { e.stopPropagation(); onOpenVehicle(j.vehicleId); } }, v.year + " " + v.make + " " + v.model) : "—"),
                  React.createElement("td", null, j.concern),
                  React.createElement("td", null, React.createElement(StatusPill, { status: j.status, list: JOB_STATUSES })),
                  React.createElement("td", { className: "mono" }, fmtMoney(totals.total)),
                  React.createElement("td", null, React.createElement("div", { className: "hstack" },
                    React.createElement(Avatar, { name: techName(j.technicianId), color: techColor(j.technicianId), size: 24 }),
                    React.createElement("span", { style: { fontSize: 12.5 } }, techName(j.technicianId))
                  ))
                );
              })
            )
          )
        )
      ),

      React.createElement("div", { className: "card" },
        React.createElement("div", { className: "card-title-row" },
          React.createElement("div", null,
            React.createElement("div", { className: "card-title" }, "Needs a Follow-up"),
            React.createElement("div", { className: "card-title-sub" }, "Linked to jobs & customers")
          ),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => navigate("followups") }, "View all")
        ),
        linkedFollowUps.length === 0 ? React.createElement(EmptyState, { icon: "bell", title: "All caught up", subtitle: "No open follow-ups right now." }) :
        React.createElement("div", { className: "list-plain" },
          linkedFollowUps.map(({ f, job }) => {
            const c = findById(db.customers, f.customerId);
            const overdue = new Date(f.dueDate) < startOfDay(today);
            return React.createElement("div", { key: f.id, className: "list-item clickable", onClick: () => onOpenCustomer(f.customerId) },
              React.createElement("div", { className: "vstack", style: { minWidth: 0 } },
                React.createElement("span", { style: { fontWeight: 700, fontSize: 13 } }, c ? c.name : "—"),
                React.createElement("span", { className: "faint", style: { fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, f.notes || statusLabel(FOLLOWUP_TYPES, f.type))
              ),
              React.createElement("span", { className: "pill", style: overdue ? { color: "var(--status-overdue)", background: "var(--status-overdue-bg)" } : { color: "var(--text-faint)", background: "var(--surface-3)" } }, overdue ? "Overdue" : fmtDateShort(f.dueDate))
            );
          })
        )
      )
    )
  );
}
