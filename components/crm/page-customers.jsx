"use client";
/* ==========================================================================
   Page 5 — Customer Management. Ported verbatim from the prototype's
   page-customers.js — only the top imports changed.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { Modal, Drawer, EmptyState, StatusPill } from "./ui";
import {
  findById, fmtDate, fmtDateShort, fmtMoney, computeTotals,
  effectiveInvoiceStatus, statusLabel, JOB_STATUSES, INVOICE_STATUSES, FOLLOWUP_TYPES
} from "@/lib/crm/helpers";

function AddVehicleModal(props) {
  const { actions, ui, customerId, onClose, onCreated } = props;
  const [form, setForm] = React.useState({ year: new Date().getFullYear(), make: "", model: "", trim: "", vin: "", plate: "", color: "", mileage: "" });
  function patch(p) { setForm(f => ({ ...f, ...p })); }
  function submit() {
    if (!form.make.trim() || !form.model.trim()) { ui.toast("Enter a make and model.", { danger: true }); return; }
    const id = actions.addVehicle({ customerId, ...form });
    ui.toast("Vehicle added.");
    onCreated ? onCreated(id) : onClose();
  }
  return React.createElement(Modal, {
    title: "Add Vehicle", onClose,
    footer: React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: submit }, "Add Vehicle")
    )
  },
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Year"), React.createElement("input", { type: "number", className: "input", value: form.year, onChange: e => patch({ year: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Make"), React.createElement("input", { className: "input", value: form.make, onChange: e => patch({ make: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Model"), React.createElement("input", { className: "input", value: form.model, onChange: e => patch({ model: e.target.value }) }))
    ),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Trim"), React.createElement("input", { className: "input", value: form.trim, onChange: e => patch({ trim: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Color"), React.createElement("input", { className: "input", value: form.color, onChange: e => patch({ color: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Mileage (km)"), React.createElement("input", { type: "number", className: "input", value: form.mileage, onChange: e => patch({ mileage: e.target.value }) }))
    ),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Plate"), React.createElement("input", { className: "input", value: form.plate, onChange: e => patch({ plate: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "VIN"), React.createElement("input", { className: "input", value: form.vin, onChange: e => patch({ vin: e.target.value }) }))
    )
  );
}

function CustomerModal(props) {
  const { actions, ui, customer, onClose } = props;
  const [form, setForm] = React.useState(() => customer || { name: "", phone: "", email: "", address: "" });
  function patch(p) { setForm(f => ({ ...f, ...p })); }
  function submit() {
    if (!form.name.trim() || !form.phone.trim()) { ui.toast("Enter a name and phone number.", { danger: true }); return; }
    if (customer) { actions.updateCustomer(customer.id, form); ui.toast("Customer updated."); }
    else { actions.addCustomer(form); ui.toast(form.name + " added."); }
    onClose();
  }
  return React.createElement(Modal, {
    title: customer ? "Edit Customer" : "Add Customer", onClose,
    footer: React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: submit }, "Save")
    )
  },
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Full name"), React.createElement("input", { className: "input", value: form.name, onChange: e => patch({ name: e.target.value }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Phone"), React.createElement("input", { className: "input", value: form.phone, onChange: e => patch({ phone: e.target.value }) }))
    ),
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Email"), React.createElement("input", { className: "input", value: form.email, onChange: e => patch({ email: e.target.value }) })),
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Address"), React.createElement("input", { className: "input", value: form.address, onChange: e => patch({ address: e.target.value }) }))
  );
}

export function CustomerDrawer(props) {
  const { db, actions, ui, customerId, onClose, onOpenVehicle, onOpenJob, onOpenInvoice } = props;
  const c = findById(db.customers, customerId);
  const [tab, setTab] = React.useState("overview");
  const [showEdit, setShowEdit] = React.useState(false);
  const [showAddVehicle, setShowAddVehicle] = React.useState(false);
  const [logText, setLogText] = React.useState("");
  if (!c) return null;

  const vehicles = db.vehicles.filter(v => v.customerId === c.id);
  const vehicleIds = vehicles.map(v => v.id);
  const jobs = db.jobs.filter(j => j.customerId === c.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const appts = db.appointments.filter(a => a.customerId === c.id).sort((a, b) => new Date(b.start) - new Date(a.start));
  const invoices = db.invoices.filter(i => i.customerId === c.id).sort((a, b) => new Date(b.date) - new Date(a.date));
  const followUps = db.followUps.filter(f => f.customerId === c.id).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const openBalance = invoices.reduce((s, i) => s + computeTotals(i.lineItems, i.discountValue, i.discountType, i.taxRate, i.payments).balance, 0);

  async function handleRemove() {
    const ok = await ui.confirm({ title: "Delete customer?", message: "This removes " + c.name + " from your customer list. Their jobs and invoices stay on record.", confirmLabel: "Delete", danger: true });
    if (ok) { onClose(); ui.toast(c.name + " deleted."); /* soft: kept out of demo destructive delete of core arrays for data integrity */ }
  }

  return React.createElement(Drawer, {
    title: c.name, subtitle: c.address, wide: true, onClose,
    tabs: [
      { key: "overview", label: "Overview" },
      { key: "vehicles", label: "Vehicles (" + vehicles.length + ")" },
      { key: "jobs", label: "Jobs & Visits" },
      { key: "invoices", label: "Invoices" },
      { key: "followups", label: "Follow-ups (" + followUps.filter(f => f.status === "open").length + ")" }
    ],
    activeTab: tab, onTab: setTab
  },
    tab === "overview" && React.createElement(React.Fragment, null,
      React.createElement("fieldset", { className: "section" },
        React.createElement("legend", null, "Contact"),
        React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Phone"), React.createElement("span", { className: "v" }, c.phone)),
        React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Email"), React.createElement("span", { className: "v" }, c.email || "—")),
        React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Address"), React.createElement("span", { className: "v" }, c.address || "—")),
        React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Customer since"), React.createElement("span", { className: "v" }, fmtDate(c.createdAt))),
        openBalance > 0.005 && React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Open balance"), React.createElement("span", { className: "v", style: { color: "var(--status-overdue)" } }, fmtMoney(openBalance)))
      ),
      React.createElement("fieldset", { className: "section" },
        React.createElement("legend", null, "Notes"),
        React.createElement("textarea", { className: "input", rows: 3, value: c.notes, onChange: e => actions.updateCustomer(c.id, { notes: e.target.value }) })
      ),
      React.createElement("fieldset", { className: "section" },
        React.createElement("legend", null, "Communication history"),
        (c.commLog || []).length === 0 ? React.createElement("p", { className: "faint", style: { fontSize: 12.5, margin: 0 } }, "No logged contact yet.") :
        React.createElement("div", { className: "list-plain" },
          (c.commLog || []).slice().reverse().map(l => React.createElement("div", { key: l.id, className: "list-item" },
            React.createElement("span", { style: { fontSize: 12.5 } }, l.text), React.createElement("span", { className: "faint", style: { fontSize: 11 } }, fmtDateShort(l.date)))
          )
        ),
        React.createElement("div", { className: "hstack" },
          React.createElement("input", { className: "input", placeholder: "Log a call, text, or visit…", value: logText, onChange: e => setLogText(e.target.value) }),
          React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => { if (logText.trim()) { actions.addCommLogEntry(c.id, logText.trim()); setLogText(""); } } }, "Log")
        )
      ),
      React.createElement("div", { className: "hstack" },
        React.createElement("button", { className: "btn btn-secondary btn-block", onClick: () => setShowEdit(true) }, React.createElement(Icon, { name: "edit", size: 14 }), "Edit"),
        React.createElement("button", { className: "btn btn-danger btn-block", onClick: handleRemove }, React.createElement(Icon, { name: "trash", size: 14 }), "Delete")
      )
    ),

    tab === "vehicles" && React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn btn-secondary btn-block", onClick: () => setShowAddVehicle(true) }, React.createElement(Icon, { name: "plus", size: 14 }), "Add Vehicle"),
      vehicles.length === 0 ? React.createElement(EmptyState, { icon: "car", title: "No vehicles yet" }) :
      React.createElement("div", { className: "list-plain" },
        vehicles.map(v => React.createElement("div", { key: v.id, className: "list-item clickable", onClick: () => onOpenVehicle(v.id) },
          React.createElement("div", { className: "vstack" }, React.createElement("span", { style: { fontWeight: 700, fontSize: 13.5 } }, v.year + " " + v.make + " " + v.model), React.createElement("span", { className: "faint", style: { fontSize: 11.5 } }, (v.plate || v.vin) + " · " + v.mileage.toLocaleString() + " km")),
          React.createElement(Icon, { name: "arrowRight", size: 15 })
        ))
      )
    ),

    tab === "jobs" && React.createElement(React.Fragment, null,
      jobs.length === 0 ? React.createElement(EmptyState, { icon: "wrench", title: "No jobs yet" }) :
      React.createElement("div", { className: "timeline" },
        jobs.map(j => { const v = findById(db.vehicles, j.vehicleId); return React.createElement("div", { key: j.id, className: "timeline-item" },
          React.createElement("div", { className: "timeline-dot" }, React.createElement(Icon, { name: "wrench", size: 14 })),
          React.createElement("div", { className: "timeline-content clickable", onClick: () => onOpenJob(j.id) },
            React.createElement("div", { className: "timeline-title-row" }, React.createElement("span", { className: "timeline-title" }, j.concern), React.createElement("span", { className: "timeline-date" }, fmtDateShort(j.createdAt))),
            React.createElement("div", { className: "timeline-desc" }, (v ? v.year + " " + v.make + " " + v.model + " · " : "") + statusLabel(JOB_STATUSES, j.status))
          )
        ); })
      )
    ),

    tab === "invoices" && React.createElement(React.Fragment, null,
      invoices.length === 0 ? React.createElement(EmptyState, { icon: "receipt", title: "No invoices yet" }) :
      React.createElement("div", { className: "list-plain" },
        invoices.map(inv => { const totals = computeTotals(inv.lineItems, inv.discountValue, inv.discountType, inv.taxRate, inv.payments); return React.createElement("div", { key: inv.id, className: "list-item clickable", onClick: () => onOpenInvoice(inv.id) },
          React.createElement("div", { className: "vstack" }, React.createElement("span", { style: { fontWeight: 700, fontSize: 13 } }, inv.invoiceNumber), React.createElement("span", { className: "faint", style: { fontSize: 11.5 } }, fmtDateShort(inv.date))),
          React.createElement("div", { className: "hstack" }, React.createElement("span", { className: "mono", style: { fontWeight: 700 } }, fmtMoney(totals.total)), React.createElement(StatusPill, { status: effectiveInvoiceStatus(inv), list: INVOICE_STATUSES }))
        ); })
      )
    ),

    tab === "followups" && React.createElement(React.Fragment, null,
      followUps.length === 0 ? React.createElement(EmptyState, { icon: "bell", title: "No follow-ups" }) :
      React.createElement("div", { className: "list-plain" },
        followUps.map(f => React.createElement("div", { key: f.id, className: "list-item" },
          React.createElement("div", { className: "vstack" }, React.createElement("span", { style: { fontWeight: 700, fontSize: 13 } }, statusLabel(FOLLOWUP_TYPES, f.type)), React.createElement("span", { className: "faint", style: { fontSize: 11.5 } }, f.notes)),
          f.status === "open" ? React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => { actions.completeFollowUp(f.id); ui.toast("Marked complete."); } }, "Mark done") : React.createElement("span", { className: "pill pill-done" }, "Done")
        ))
      )
    ),

    showEdit && React.createElement(CustomerModal, { actions, ui, customer: c, onClose: () => setShowEdit(false) }),
    showAddVehicle && React.createElement(AddVehicleModal, { actions, ui, customerId: c.id, onClose: () => setShowAddVehicle(false) })
  );
}

export function CustomersPage(props) {
  const { db, actions, ui, onOpenVehicle, onOpenJob, onOpenInvoice } = props;
  const [query, setQuery] = React.useState("");
  const [openCustomer, setOpenCustomer] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);

  const rows = db.customers
    .filter(c => !query.trim() || (c.name + c.phone + (c.email || "")).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  return React.createElement("div", { className: "section-stack" },
    React.createElement("div", { className: "hstack", style: { justifyContent: "space-between" } },
      React.createElement("div", { className: "input-with-icon" }, React.createElement(Icon, { name: "search", size: 14 }), React.createElement("input", { className: "input", placeholder: "Search customers by name, phone, or email", value: query, onChange: e => setQuery(e.target.value), style: { width: 320 } })),
      React.createElement("button", { className: "btn btn-primary", onClick: () => setShowAdd(true) }, React.createElement(Icon, { name: "plus", size: 15 }), "Add Customer")
    ),
    React.createElement("div", { className: "card", style: { padding: 0 } },
      rows.length === 0 ? React.createElement(EmptyState, { icon: "user", title: "No customers found" }) :
      React.createElement("div", { className: "table-wrap", style: { border: "none" } },
        React.createElement("table", { className: "data-table" },
          React.createElement("thead", null, React.createElement("tr", null,
            React.createElement("th", null, "Name"), React.createElement("th", null, "Phone"), React.createElement("th", null, "Email"),
            React.createElement("th", null, "Vehicles"), React.createElement("th", null, "Open Balance")
          )),
          React.createElement("tbody", null,
            rows.map(c => {
              const vCount = db.vehicles.filter(v => v.customerId === c.id).length;
              const bal = db.invoices.filter(i => i.customerId === c.id).reduce((s, i) => s + computeTotals(i.lineItems, i.discountValue, i.discountType, i.taxRate, i.payments).balance, 0);
              return React.createElement("tr", { key: c.id, className: "row-click", onClick: () => setOpenCustomer(c.id) },
                React.createElement("td", { style: { fontWeight: 700 } }, c.name),
                React.createElement("td", null, c.phone),
                React.createElement("td", null, c.email || "—"),
                React.createElement("td", null, vCount),
                React.createElement("td", { className: "mono" }, bal > 0.005 ? React.createElement("span", { style: { color: "var(--status-overdue)", fontWeight: 700 } }, fmtMoney(bal)) : "—")
              );
            })
          )
        )
      )
    ),
    openCustomer && React.createElement(CustomerDrawer, { db, actions, ui, customerId: openCustomer, onClose: () => setOpenCustomer(null), onOpenVehicle, onOpenJob, onOpenInvoice }),
    showAdd && React.createElement(CustomerModal, { actions, ui, onClose: () => setShowAdd(false) })
  );
}
