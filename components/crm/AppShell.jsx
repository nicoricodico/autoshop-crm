"use client";
/* ==========================================================================
   App shell: global Job detail drawer, page routing, search, and the
   Supabase-backed data/actions wiring. Ported from the prototype's app.js
   with one deliberate removal: the hidden "vampadmin" keystroke listener
   and the isAdmin/Automations routing branch are gone entirely. Vendor/
   Automation Admin is now a real, separately-routed page
   (/vendor-admin) gated by a database role checked on the server —
   there is nothing left here to unlock from the shop UI.
   ========================================================================== */
import React from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";
import {
  Sidebar, TopBar, Drawer, StatusPill, LineItemsEditor, TotalsBox,
  UIProvider, useUI, buildSearchIndex, searchRows
} from "./ui";
import {
  findById, computeTotals, fmtDateTime, addDays, startOfDay, JOB_STATUSES
} from "@/lib/crm/helpers";
import { useOrgData } from "@/lib/crm/queries";
import { createActions } from "@/lib/crm/actions";
import { createClient } from "@/lib/supabase/client";

import { DashboardPage } from "./page-dashboard";
import { SchedulingPage } from "./page-scheduling";
import { InvoicingPage, InvoiceDrawer } from "./page-invoicing";
import { TeamPage } from "./page-team";
import { CustomersPage, CustomerDrawer } from "./page-customers";
import { FollowUpsPage } from "./page-followups";
import { VehiclesPage, VehicleDrawer } from "./page-vehicles";
import { SettingsPage } from "./page-settings";

const PAGE_META = {
  dashboard: { title: "Daily Operations", subtitle: "Today at a glance" },
  scheduling: { title: "Scheduling", subtitle: "The shop's calendar" },
  invoicing: { title: "Invoicing & Line Items", subtitle: "Estimates, invoices & payments" },
  team: { title: "Team Management", subtitle: "Roster & availability" },
  customers: { title: "Customer Management", subtitle: "Every customer, one place" },
  followups: { title: "Follow-Ups", subtitle: "Who needs a call today" },
  vehicles: { title: "Vehicle History", subtitle: "Full repair history, per vehicle" },
  settings: { title: "Settings", subtitle: "Shop configuration" }
};

function JobDrawer(props) {
  const { db, actions, ui, jobId, onClose, onOpenCustomer, onOpenVehicle, onOpenInvoice } = props;
  const job = findById(db.jobs, jobId);
  if (!job) return null;
  const customer = findById(db.customers, job.customerId);
  const vehicle = findById(db.vehicles, job.vehicleId);
  const appt = job.appointmentId ? findById(db.appointments, job.appointmentId) : null;
  const invoice = db.invoices.find(i => i.jobId === job.id);
  const totals = computeTotals(job.lineItems, 0, "percent", db.settings.taxRate, []);
  const techs = db.team.filter(t => t.role === "Technician" || t.role === "Apprentice" || t.role === "Owner");

  function patch(p) { actions.updateJob(job.id, p); }

  function markComplete() {
    actions.updateJob(job.id, { status: "completed", completedAt: new Date() });
    if (job.appointmentId) actions.updateAppointment(job.appointmentId, { status: "completed" });
    const hasReminder = db.followUps.some(f => f.vehicleId === job.vehicleId && f.type === "maintenance_reminder" && f.status === "open");
    if (!hasReminder) {
      actions.addFollowUp({
        type: "maintenance_reminder", customerId: job.customerId, vehicleId: job.vehicleId, jobId: job.id,
        dueDate: addDays(new Date(), 180), assignedTo: job.technicianId || (db.team[0] && db.team[0].id),
        notes: "Routine follow-up: schedule next maintenance visit (auto-generated from completed job).", status: "open"
      });
      ui.toast("Job marked complete — a maintenance reminder was scheduled.");
    } else {
      ui.toast("Job marked complete.");
    }
  }

  function convertToInvoice() {
    const id = actions.convertJobToInvoice(job.id);
    ui.toast("Invoice created from this job.");
    onOpenInvoice(id);
  }

  return React.createElement(Drawer, {
    title: job.concern, subtitle: (customer ? customer.name : "") + (vehicle ? " · " + vehicle.year + " " + vehicle.make + " " + vehicle.model : ""), wide: true, onClose,
    headerExtra: React.createElement("div", { style: { marginTop: 10 } }, React.createElement(StatusPill, { status: job.status, list: JOB_STATUSES }))
  },
    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Linked records"),
      React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Customer"), React.createElement("span", { className: "v link-cell", onClick: () => onOpenCustomer(job.customerId) }, customer ? customer.name : "—")),
      React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Vehicle"), React.createElement("span", { className: "v link-cell", onClick: () => onOpenVehicle(job.vehicleId) }, vehicle ? vehicle.year + " " + vehicle.make + " " + vehicle.model : "—")),
      appt && React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Appointment"), React.createElement("span", { className: "v" }, fmtDateTime(appt.start))),
      invoice && React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Invoice"), React.createElement("span", { className: "v link-cell", onClick: () => onOpenInvoice(invoice.id) }, invoice.invoiceNumber))
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Status & assignment"),
      React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Job status"),
          React.createElement("select", { className: "input", value: job.status, onChange: e => patch({ status: e.target.value }) },
            JOB_STATUSES.map(s => React.createElement("option", { key: s.value, value: s.value }, s.label)))),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Approval"),
          React.createElement("select", { className: "input", value: job.approvalStatus, onChange: e => patch({ approvalStatus: e.target.value }) },
            React.createElement("option", { value: "pending" }, "Pending"), React.createElement("option", { value: "approved" }, "Approved"), React.createElement("option", { value: "declined" }, "Declined"))),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Technician"),
          React.createElement("select", {
            className: "input", value: job.technicianId || "", onChange: e => { patch({ technicianId: e.target.value }); if (job.appointmentId) actions.updateAppointment(job.appointmentId, { technicianId: e.target.value }); }
          }, React.createElement("option", { value: "" }, "Unassigned"), techs.map(t => React.createElement("option", { key: t.id, value: t.id }, t.name))))
      )
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Concern & diagnosis"),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Customer concern"), React.createElement("textarea", { className: "input", rows: 2, value: job.concern, onChange: e => patch({ concern: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Diagnosis"), React.createElement("textarea", { className: "input", rows: 2, value: job.diagnosis, onChange: e => patch({ diagnosis: e.target.value }) }))
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Line items & estimate"),
      React.createElement(LineItemsEditor, { items: job.lineItems, onChange: items => patch({ lineItems: items }), library: db.lineItemLibrary, taxRateDefault: db.settings.taxRate }),
      React.createElement(TotalsBox, { totals })
    ),

    React.createElement("div", { className: "field" }, React.createElement("label", null, "Notes"), React.createElement("textarea", { className: "input", rows: 2, value: job.notes, onChange: e => patch({ notes: e.target.value }) })),

    React.createElement("div", { className: "hstack" },
      job.status !== "completed" && job.status !== "cancelled" && React.createElement("button", { className: "btn btn-secondary btn-block", onClick: markComplete }, React.createElement(Icon, { name: "checkCircle", size: 14 }), "Mark Complete"),
      !invoice && job.approvalStatus === "approved" && React.createElement("button", { className: "btn btn-primary btn-block", onClick: convertToInvoice }, React.createElement(Icon, { name: "receipt", size: 14 }), "Convert to Invoice"),
      invoice && React.createElement("button", { className: "btn btn-secondary btn-block", onClick: () => onOpenInvoice(invoice.id) }, React.createElement(Icon, { name: "receipt", size: 14 }), "View Invoice")
    )
  );
}

function AppInner() {
  const ui = useUI();
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const { loading, error, db, profile, refetch } = useOrgData();
  const actions = React.useMemo(() => createActions({ supabase, ui, refetch }), [supabase, ui, refetch]);

  const [page, setPage] = React.useState("dashboard");
  const [collapsed, setCollapsed] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const [openJobId, setOpenJobId] = React.useState(null);
  const [openCustomerId, setOpenCustomerId] = React.useState(null);
  const [openVehicleId, setOpenVehicleId] = React.useState(null);
  const [openInvoiceId, setOpenInvoiceId] = React.useState(null);

  const searchIndex = React.useMemo(() => db ? buildSearchIndex(db) : [], [db]);
  const searchResults = React.useMemo(() => searchRows(searchIndex, search), [searchIndex, search]);

  function onSelectResult(r) {
    setSearch("");
    if (r.entity === "customer") setOpenCustomerId(r.id);
    else if (r.entity === "vehicle") setOpenVehicleId(r.id);
    else if (r.entity === "job") setOpenJobId(r.id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return React.createElement("div", { className: "loading-screen" }, React.createElement("span", { className: "faint" }, "Loading your shop…"));
  }
  if (error === "signed_out") {
    router.replace("/login");
    return React.createElement("div", { className: "loading-screen" }, React.createElement("span", { className: "faint" }, "Redirecting to sign in…"));
  }
  if (profile && profile.role === "vendor_admin") {
    return React.createElement("div", { className: "loading-screen vstack", style: { gap: 12 } },
      React.createElement("span", null, "This account is a Vendor / Automation Admin account and isn't attached to a shop."),
      React.createElement("a", { className: "btn btn-primary", href: "/vendor-admin" }, "Go to Vendor Admin"),
      React.createElement("button", { className: "btn btn-secondary", onClick: handleLogout }, "Log out")
    );
  }
  if (error || !db) {
    return React.createElement("div", { className: "loading-screen" }, React.createElement("span", { style: { color: "var(--status-overdue)" } }, "No shop found for this account."));
  }

  const followupsDue = db.followUps.filter(f => f.status === "open" && new Date(f.dueDate) <= startOfDay(addDays(new Date(), 1))).length;

  const shared = {
    db, actions, ui, navigate: setPage,
    onOpenCustomer: setOpenCustomerId, onOpenVehicle: setOpenVehicleId, onOpenJob: setOpenJobId, onOpenInvoice: setOpenInvoiceId
  };

  let pageEl;
  if (page === "dashboard") pageEl = React.createElement(DashboardPage, shared);
  else if (page === "scheduling") pageEl = React.createElement(SchedulingPage, shared);
  else if (page === "invoicing") pageEl = React.createElement(InvoicingPage, shared);
  else if (page === "team") pageEl = React.createElement(TeamPage, shared);
  else if (page === "customers") pageEl = React.createElement(CustomersPage, shared);
  else if (page === "followups") pageEl = React.createElement(FollowUpsPage, shared);
  else if (page === "vehicles") pageEl = React.createElement(VehiclesPage, shared);
  else if (page === "settings") pageEl = React.createElement(SettingsPage, shared);
  else pageEl = React.createElement(SettingsPage, shared);

  const meta = PAGE_META[page];

  return React.createElement("div", { className: "app-shell" },
    React.createElement(Sidebar, { collapsed, onToggle: () => setCollapsed(c => !c), active: page, onNavigate: setPage, followupsDue, shopName: db.settings.businessName }),
    React.createElement("div", { className: "main-col" },
      React.createElement(TopBar, {
        title: meta.title, subtitle: meta.subtitle, search, onSearchChange: setSearch, searchResults, onSelectResult
      },
        React.createElement("div", { className: "hstack", style: { gap: 10 } },
          profile && React.createElement("span", { className: "faint", style: { fontSize: 12.5 } }, profile.name + " · " + (profile.role || "")),
          React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: handleLogout }, React.createElement(Icon, { name: "logout", size: 14 }), "Log out")
        )
      ),
      React.createElement("div", { className: "page-content" }, pageEl)
    ),
    openJobId && React.createElement(JobDrawer, { db, actions, ui, jobId: openJobId, onClose: () => setOpenJobId(null), onOpenCustomer: setOpenCustomerId, onOpenVehicle: setOpenVehicleId, onOpenInvoice: setOpenInvoiceId }),
    openCustomerId && React.createElement(CustomerDrawer, { db, actions, ui, customerId: openCustomerId, onClose: () => setOpenCustomerId(null), onOpenVehicle: setOpenVehicleId, onOpenJob: setOpenJobId, onOpenInvoice: setOpenInvoiceId }),
    openVehicleId && React.createElement(VehicleDrawer, { db, actions, ui, vehicleId: openVehicleId, onClose: () => setOpenVehicleId(null), onOpenCustomer: setOpenCustomerId, onOpenJob: setOpenJobId, onOpenInvoice: setOpenInvoiceId }),
    openInvoiceId && React.createElement(InvoiceDrawer, { db, actions, ui, invoiceId: openInvoiceId, onClose: () => setOpenInvoiceId(null), onOpenCustomer: setOpenCustomerId, onOpenVehicle: setOpenVehicleId, onOpenJob: setOpenJobId })
  );
}

export function AppShell() {
  return React.createElement(UIProvider, null, React.createElement(AppInner));
}
