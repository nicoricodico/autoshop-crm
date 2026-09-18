"use client";
/* ==========================================================================
   Page 3 — Invoicing & Line Items. Ported verbatim from the prototype's
   page-invoicing.js (including the "new customer from invoice" flow) —
   only the top imports changed.
   ========================================================================== */
import React from "react";
import { Icon } from "./icons";
import { Modal, Drawer, LineItemsEditor, TotalsBox, StatusPill, EmptyState } from "./ui";
import {
  findById, computeTotals, effectiveInvoiceStatus, fmtMoney, fmtDateShort,
  INVOICE_STATUSES, LINE_ITEM_CATEGORIES
} from "@/lib/crm/helpers";

const INVOICE_FILTERS = ["All", "Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"];

function NewInvoiceModal(props) {
  const { db, actions, ui, onClose, onCreated } = props;
  const [mode, setMode] = React.useState("blank");
  const [jobId, setJobId] = React.useState("");
  const [customerMode, setCustomerMode] = React.useState("existing");
  const [customerId, setCustomerId] = React.useState("");
  const [custQuery, setCustQuery] = React.useState("");
  const [newCustomer, setNewCustomer] = React.useState({ name: "", phone: "", email: "", address: "" });
  const [vehicleMode, setVehicleMode] = React.useState("existing");
  const [vehicleId, setVehicleId] = React.useState("");
  const [newVehicle, setNewVehicle] = React.useState({ year: new Date().getFullYear(), make: "", model: "", trim: "", vin: "", plate: "", color: "", mileage: "" });

  const eligibleJobs = db.jobs.filter(j => j.approvalStatus === "approved" && !db.invoices.some(i => i.jobId === j.id));
  const custMatches = React.useMemo(() => {
    if (!custQuery.trim()) return [];
    const q = custQuery.toLowerCase();
    return db.customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 6);
  }, [custQuery, db.customers]);
  const vehicles = customerId ? db.vehicles.filter(v => v.customerId === customerId) : [];

  function submit() {
    if (mode === "job") {
      if (!jobId) { ui.toast("Choose a job to convert.", { danger: true }); return; }
      const id = actions.convertJobToInvoice(jobId);
      ui.toast("Estimate converted to invoice.");
      onCreated(id);
      return;
    }
    let finalCustomerId = customerId;
    if (customerMode === "new") {
      if (!newCustomer.name.trim() || !newCustomer.phone.trim()) { ui.toast("Enter the new customer's name and phone.", { danger: true }); return; }
      finalCustomerId = actions.addCustomer(newCustomer);
    } else if (!finalCustomerId) {
      ui.toast("Choose a customer, or add a new one.", { danger: true });
      return;
    }
    let finalVehicleId = vehicleId || null;
    if (vehicleMode === "new" && (newVehicle.make.trim() || newVehicle.model.trim())) {
      if (!newVehicle.make.trim() || !newVehicle.model.trim()) { ui.toast("Enter both a make and model for the new vehicle, or leave both blank.", { danger: true }); return; }
      finalVehicleId = actions.addVehicle({ customerId: finalCustomerId, ...newVehicle });
    }
    const id = actions.addInvoice({ customerId: finalCustomerId, vehicleId: finalVehicleId, jobId: null });
    ui.toast("Invoice created.");
    onCreated(id);
  }

  return React.createElement(Modal, {
    title: "New Invoice", onClose, wide: mode === "blank",
    footer: React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: submit }, "Continue")
    )
  },
    React.createElement("div", { className: "hstack", style: { gap: 16 } },
      React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: mode === "blank", onChange: () => setMode("blank") }), "New invoice"),
      React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: mode === "job", onChange: () => setMode("job") }), "Convert an approved job")
    ),
    mode === "job" ? React.createElement("div", { className: "field" },
      React.createElement("label", null, "Approved jobs without an invoice"),
      eligibleJobs.length === 0 ? React.createElement("p", { className: "faint", style: { fontSize: 12.5 } }, "No approved jobs are waiting to be invoiced.") :
      React.createElement("select", { className: "input", value: jobId, onChange: e => setJobId(e.target.value) },
        React.createElement("option", { value: "" }, "Select a job…"),
        eligibleJobs.map(j => { const c = findById(db.customers, j.customerId); return React.createElement("option", { key: j.id, value: j.id }, (c ? c.name : "") + " — " + j.concern); })
      )
    ) : React.createElement(React.Fragment, null,
      React.createElement("fieldset", { className: "section" },
        React.createElement("legend", null, "Customer"),
        React.createElement("div", { className: "hstack", style: { gap: 16 } },
          React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: customerMode === "existing", onChange: () => setCustomerMode("existing") }), "Existing customer"),
          React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: customerMode === "new", onChange: () => { setCustomerMode("new"); setVehicleMode("new"); setVehicleId(""); } }), "New customer")
        ),
        customerMode === "existing" ? (
          customerId ? React.createElement("div", { className: "list-item" },
            React.createElement("span", { style: { fontWeight: 700 } }, findById(db.customers, customerId).name),
            React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => { setCustomerId(""); setVehicleId(""); } }, "Change")
          ) : React.createElement("div", { style: { position: "relative" } },
            React.createElement("input", { className: "input", placeholder: "Search by name or phone…", value: custQuery, onChange: e => setCustQuery(e.target.value) }),
            custMatches.length > 0 && React.createElement("div", { className: "card", style: { position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, padding: 6, zIndex: 20 } },
              custMatches.map(c => React.createElement("div", { key: c.id, className: "list-item clickable", style: { marginBottom: 4 }, onClick: () => { setCustomerId(c.id); setCustQuery(""); } },
                React.createElement("span", null, c.name), React.createElement("span", { className: "faint" }, c.phone)))
            )
          )
        ) : React.createElement("div", { className: "field-row" },
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Full name"), React.createElement("input", { className: "input", value: newCustomer.name, onChange: e => setNewCustomer({ ...newCustomer, name: e.target.value }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Phone"), React.createElement("input", { className: "input", value: newCustomer.phone, onChange: e => setNewCustomer({ ...newCustomer, phone: e.target.value }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Email"), React.createElement("input", { className: "input", value: newCustomer.email, onChange: e => setNewCustomer({ ...newCustomer, email: e.target.value }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Address"), React.createElement("input", { className: "input", value: newCustomer.address, onChange: e => setNewCustomer({ ...newCustomer, address: e.target.value }) }))
        )
      ),
      React.createElement("fieldset", { className: "section" },
        React.createElement("legend", null, "Vehicle (optional)"),
        customerMode === "existing" && customerId && vehicles.length > 0 && React.createElement("div", { className: "hstack", style: { gap: 16 } },
          React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: vehicleMode === "existing", onChange: () => setVehicleMode("existing") }), "Existing vehicle"),
          React.createElement("label", { className: "checkbox-row" }, React.createElement("input", { type: "radio", checked: vehicleMode === "new", onChange: () => setVehicleMode("new") }), "Add new vehicle")
        ),
        vehicleMode === "existing" && vehicles.length > 0 ? React.createElement("select", { className: "input", value: vehicleId, onChange: e => setVehicleId(e.target.value) },
          React.createElement("option", { value: "" }, "No specific vehicle"),
          vehicles.map(v => React.createElement("option", { key: v.id, value: v.id }, v.year + " " + v.make + " " + v.model))
        ) : React.createElement("div", { className: "field-row" },
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Year"), React.createElement("input", { type: "number", className: "input", value: newVehicle.year, onChange: e => setNewVehicle({ ...newVehicle, year: e.target.value }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Make"), React.createElement("input", { className: "input", value: newVehicle.make, onChange: e => setNewVehicle({ ...newVehicle, make: e.target.value }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Model"), React.createElement("input", { className: "input", value: newVehicle.model, onChange: e => setNewVehicle({ ...newVehicle, model: e.target.value }) })),
          React.createElement("div", { className: "field" }, React.createElement("label", null, "Plate"), React.createElement("input", { className: "input", value: newVehicle.plate, onChange: e => setNewVehicle({ ...newVehicle, plate: e.target.value }) })),
          React.createElement("p", { className: "faint", style: { fontSize: 11.5, margin: 0 } }, "Leave the vehicle blank if this invoice doesn't need one.")
        )
      )
    )
  );
}

export function InvoiceDrawer(props) {
  const { db, actions, ui, invoiceId, onClose, onOpenCustomer, onOpenVehicle, onOpenJob } = props;
  const inv = findById(db.invoices, invoiceId);
  const [payAmount, setPayAmount] = React.useState("");
  const [payMethod, setPayMethod] = React.useState(db.settings.paymentMethods[0] || "Cash");

  // Editing an invoice used to write every single field change to Supabase
  // the instant it happened, with no way to back out once you'd made an
  // edit. This holds the in-progress edit locally instead: nothing is sent
  // to the server until "Save Changes" is clicked, and closing the drawer
  // (the X, Escape, or clicking outside) just discards the draft, leaving
  // the saved invoice untouched. Recording a payment is its own separate,
  // immediate action below (money actually changing hands isn't a "draft").
  const [draft, setDraft] = React.useState(null);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (inv) {
      setDraft({
        status: inv.status, date: inv.date, dueDate: inv.dueDate,
        discountType: inv.discountType, discountValue: inv.discountValue, taxRate: inv.taxRate,
        lineItems: inv.lineItems, notes: inv.notes,
      });
      setDirty(false);
    }
    // Re-seed only when switching to a different invoice, not on every
    // background refetch of this same one -- that would overwrite whatever
    // is currently being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  if (!inv || !draft) return null;
  const customer = findById(db.customers, inv.customerId);
  const vehicle = findById(db.vehicles, inv.vehicleId);
  const totals = computeTotals(draft.lineItems, draft.discountValue, draft.discountType, draft.taxRate, inv.payments);
  const effStatus = effectiveInvoiceStatus({ ...inv, ...draft });

  function patch(p) { setDraft(d => ({ ...d, ...p })); setDirty(true); }

  function discardAndClose() { onClose(); }

  function saveChanges() {
    actions.updateInvoice(inv.id, draft);
    ui.toast("Invoice updated.");
    setDirty(false);
    onClose();
  }

  function submitPayment() {
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { ui.toast("Enter a payment amount.", { danger: true }); return; }
    actions.addPayment(inv.id, { amount: amt, method: payMethod });
    ui.toast("Payment of " + fmtMoney(amt) + " recorded.");
    setPayAmount("");
  }

  return React.createElement(Drawer, {
    title: inv.invoiceNumber, subtitle: customer ? customer.name : "", fullscreen: true, onClose: discardAndClose,
    headerExtra: React.createElement("div", { style: { marginTop: 10 } }, React.createElement(StatusPill, { status: effStatus, list: INVOICE_STATUSES })),
    footer: React.createElement(React.Fragment, null,
      React.createElement("span", { className: "faint foot-left", style: { fontSize: 12.5 } }, dirty ? "Unsaved changes" : "No changes to save"),
      React.createElement("button", { className: "btn btn-secondary", onClick: discardAndClose }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: saveChanges, disabled: !dirty }, "Save Changes")
    )
  },
    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Linked to"),
      React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Customer"), React.createElement("span", { className: "v link-cell", onClick: () => onOpenCustomer(inv.customerId) }, customer ? customer.name : "—")),
      vehicle && React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Vehicle"), React.createElement("span", { className: "v link-cell", onClick: () => onOpenVehicle(inv.vehicleId) }, vehicle.year + " " + vehicle.make + " " + vehicle.model)),
      inv.jobId && React.createElement("div", { className: "detail-row" }, React.createElement("span", { className: "k" }, "Job"), React.createElement("span", { className: "v link-cell", onClick: () => onOpenJob(inv.jobId) }, "View job"))
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Details"),
      React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Status"),
          React.createElement("select", { className: "input", value: draft.status, onChange: e => patch({ status: e.target.value }) },
            INVOICE_STATUSES.map(s => React.createElement("option", { key: s.value, value: s.value }, s.label)))),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Date"), React.createElement("input", { type: "date", className: "input", value: new Date(draft.date).toISOString().slice(0, 10), onChange: e => patch({ date: new Date(e.target.value) }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Due date"), React.createElement("input", { type: "date", className: "input", value: new Date(draft.dueDate).toISOString().slice(0, 10), onChange: e => patch({ dueDate: new Date(e.target.value) }) }))
      ),
      React.createElement("div", { className: "field-row" },
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Discount type"),
          React.createElement("select", { className: "input", value: draft.discountType, onChange: e => patch({ discountType: e.target.value }) },
            React.createElement("option", { value: "percent" }, "Percent (%)"), React.createElement("option", { value: "flat" }, "Fixed ($)"))),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Discount value"), React.createElement("input", { type: "number", className: "input", value: draft.discountValue, onChange: e => patch({ discountValue: Number(e.target.value) }) })),
        React.createElement("div", { className: "field" }, React.createElement("label", null, "Tax rate (%)"), React.createElement("input", { type: "number", className: "input", value: draft.taxRate, onChange: e => patch({ taxRate: Number(e.target.value) }) }))
      )
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Line items"),
      React.createElement(LineItemsEditor, { items: draft.lineItems, onChange: items => patch({ lineItems: items }), library: db.lineItemLibrary, taxRateDefault: draft.taxRate, saveDelayMs: 0 }),
      React.createElement(TotalsBox, { totals })
    ),

    React.createElement("fieldset", { className: "section" },
      React.createElement("legend", null, "Payments"),
      inv.payments.length === 0 ? React.createElement("p", { className: "faint", style: { fontSize: 12.5, margin: 0 } }, "No payments recorded yet.") :
      React.createElement("div", { className: "list-plain" },
        inv.payments.map(p => React.createElement("div", { key: p.id, className: "list-item" },
          React.createElement("span", null, p.method), React.createElement("span", { className: "faint" }, fmtDateShort(p.date)), React.createElement("span", { className: "mono", style: { fontWeight: 700 } }, fmtMoney(p.amount))
        ))
      ),
      totals.balance > 0.005 && React.createElement("div", { className: "hstack" },
        React.createElement("input", { type: "number", className: "input", placeholder: "Amount", value: payAmount, onChange: e => setPayAmount(e.target.value), style: { width: 110 } }),
        React.createElement("select", { className: "input", value: payMethod, onChange: e => setPayMethod(e.target.value), style: { width: 140 } },
          db.settings.paymentMethods.map(m => React.createElement("option", { key: m, value: m }, m))),
        React.createElement("button", { className: "btn btn-primary btn-sm", onClick: submitPayment }, "Record payment")
      )
    ),

    React.createElement("div", { className: "field" }, React.createElement("label", null, "Notes"), React.createElement("textarea", { className: "input", rows: 2, value: draft.notes, onChange: e => patch({ notes: e.target.value }) }))
  );
}

function LibraryItemModal(props) {
  const { actions, ui, item, onClose } = props;
  const [form, setForm] = React.useState(() => item || { name: "", category: "Custom", description: "", unitPrice: 0, laborHours: 0, laborRate: 0, taxRate: 13 });
  function patch(p) { setForm(f => ({ ...f, ...p })); }
  function submit() {
    if (!form.name.trim()) { ui.toast("Give the item a name.", { danger: true }); return; }
    if (item) { actions.updateLibraryItem(item.id, form); ui.toast("Line item updated."); }
    else { actions.addLibraryItem(form); ui.toast("Added to line item library."); }
    onClose();
  }
  return React.createElement(Modal, {
    title: item ? "Edit Line Item" : "New Line Item Template", onClose,
    footer: React.createElement(React.Fragment, null,
      React.createElement("button", { className: "btn btn-secondary", onClick: onClose }, "Cancel"),
      React.createElement("button", { className: "btn btn-primary", onClick: submit }, "Save")
    )
  },
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Name"), React.createElement("input", { className: "input", value: form.name, onChange: e => patch({ name: e.target.value }) })),
    React.createElement("div", { className: "field" }, React.createElement("label", null, "Description"), React.createElement("input", { className: "input", value: form.description, onChange: e => patch({ description: e.target.value }) })),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Category"),
        React.createElement("select", { className: "input", value: form.category, onChange: e => patch({ category: e.target.value }) }, LINE_ITEM_CATEGORIES.map(c => React.createElement("option", { key: c, value: c }, c)))),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Tax %"), React.createElement("input", { type: "number", className: "input", value: form.taxRate, onChange: e => patch({ taxRate: Number(e.target.value) }) }))
    ),
    React.createElement("div", { className: "field-row" },
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Unit price ($)"), React.createElement("input", { type: "number", className: "input", value: form.unitPrice, onChange: e => patch({ unitPrice: Number(e.target.value) }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Labour hours"), React.createElement("input", { type: "number", step: "0.1", className: "input", value: form.laborHours, onChange: e => patch({ laborHours: Number(e.target.value) }) })),
      React.createElement("div", { className: "field" }, React.createElement("label", null, "Labour $/hr"), React.createElement("input", { type: "number", className: "input", value: form.laborRate, onChange: e => patch({ laborRate: Number(e.target.value) }) }))
    ),
    React.createElement("p", { className: "faint", style: { fontSize: 11.5, margin: 0 } }, "Set labour hours + rate for labour-based items, or unit price for parts/flat-fee items.")
  );
}

export function InvoicingPage(props) {
  const { db, actions, ui, onOpenCustomer, onOpenVehicle, onOpenJob } = props;
  const [tab, setTab] = React.useState("invoices");
  const [filter, setFilter] = React.useState("All");
  const [query, setQuery] = React.useState("");
  const [openInvoice, setOpenInvoice] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);
  const [editLibItem, setEditLibItem] = React.useState(null);
  const [showNewLib, setShowNewLib] = React.useState(false);

  const filterKey = { "All": null, "Draft": "draft", "Sent": "sent", "Partially Paid": "partially_paid", "Paid": "paid", "Overdue": "overdue", "Cancelled": "cancelled" };

  const invoices = db.invoices
    .filter(i => !filterKey[filter] || effectiveInvoiceStatus(i) === filterKey[filter])
    .filter(i => {
      if (!query.trim()) return true;
      const c = findById(db.customers, i.customerId);
      const q = query.toLowerCase();
      return i.invoiceNumber.toLowerCase().includes(q) || (c && c.name.toLowerCase().includes(q));
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return React.createElement("div", { className: "section-stack" },
    React.createElement("div", { className: "tabs-row" },
      React.createElement("button", { className: "tab-btn" + (tab === "invoices" ? " active" : ""), onClick: () => setTab("invoices") }, "Invoices"),
      React.createElement("button", { className: "tab-btn" + (tab === "library" ? " active" : ""), onClick: () => setTab("library") }, "Line Item Library")
    ),

    tab === "invoices" ? React.createElement(React.Fragment, null,
      React.createElement("div", { className: "hstack", style: { justifyContent: "space-between", flexWrap: "wrap", gap: 10 } },
        React.createElement("div", { className: "filter-chip-row" },
          INVOICE_FILTERS.map(f => React.createElement("div", { key: f, className: "filter-chip" + (filter === f ? " active" : ""), onClick: () => setFilter(f) }, f))
        ),
        React.createElement("div", { className: "hstack" },
          React.createElement("div", { className: "input-with-icon" }, React.createElement(Icon, { name: "search", size: 14 }), React.createElement("input", { className: "input", placeholder: "Search invoice # or customer", value: query, onChange: e => setQuery(e.target.value), style: { width: 220 } })),
          React.createElement("button", { className: "btn btn-primary", onClick: () => setShowNew(true) }, React.createElement(Icon, { name: "plus", size: 15 }), "New Invoice")
        )
      ),
      React.createElement("div", { className: "card", style: { padding: 0 } },
        invoices.length === 0 ? React.createElement(EmptyState, { icon: "receipt", title: "No invoices match", subtitle: "Try a different filter or create a new invoice." }) :
        React.createElement("div", { className: "table-wrap", style: { border: "none" } },
          React.createElement("table", { className: "data-table" },
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", null, "Invoice #"), React.createElement("th", null, "Customer"), React.createElement("th", null, "Vehicle"),
              React.createElement("th", null, "Date"), React.createElement("th", null, "Due"), React.createElement("th", null, "Total"),
              React.createElement("th", null, "Balance"), React.createElement("th", null, "Status")
            )),
            React.createElement("tbody", null,
              invoices.map(inv => {
                const c = findById(db.customers, inv.customerId);
                const v = findById(db.vehicles, inv.vehicleId);
                const totals = computeTotals(inv.lineItems, inv.discountValue, inv.discountType, inv.taxRate, inv.payments);
                return React.createElement("tr", { key: inv.id, className: "row-click", onClick: () => setOpenInvoice(inv.id) },
                  React.createElement("td", { className: "mono", style: { fontWeight: 700 } }, inv.invoiceNumber),
                  React.createElement("td", null, c ? c.name : "—"),
                  React.createElement("td", null, v ? v.year + " " + v.make + " " + v.model : "—"),
                  React.createElement("td", null, fmtDateShort(inv.date)),
                  React.createElement("td", null, fmtDateShort(inv.dueDate)),
                  React.createElement("td", { className: "mono" }, fmtMoney(totals.total)),
                  React.createElement("td", { className: "mono" }, totals.balance > 0.005 ? fmtMoney(totals.balance) : "—"),
                  React.createElement("td", null, React.createElement(StatusPill, { status: effectiveInvoiceStatus(inv), list: INVOICE_STATUSES }))
                );
              })
            )
          )
        )
      )
    ) : React.createElement(React.Fragment, null,
      React.createElement("div", { className: "hstack", style: { justifyContent: "flex-end" } },
        React.createElement("button", { className: "btn btn-primary", onClick: () => setShowNewLib(true) }, React.createElement(Icon, { name: "plus", size: 15 }), "New Line Item")
      ),
      React.createElement("div", { className: "card", style: { padding: 0 } },
        React.createElement("div", { className: "table-wrap", style: { border: "none" } },
          React.createElement("table", { className: "data-table" },
            React.createElement("thead", null, React.createElement("tr", null,
              React.createElement("th", null, "Name"), React.createElement("th", null, "Category"), React.createElement("th", null, "Pricing"), React.createElement("th", null, "Tax %"), React.createElement("th", null, "")
            )),
            React.createElement("tbody", null,
              db.lineItemLibrary.map(li => React.createElement("tr", { key: li.id },
                React.createElement("td", null, React.createElement("div", { style: { fontWeight: 700 } }, li.name), li.description && React.createElement("div", { className: "cell-sub" }, li.description)),
                React.createElement("td", null, React.createElement("span", { className: "tag" }, li.category)),
                React.createElement("td", { className: "mono" }, li.laborHours > 0 ? li.laborHours + " hr @ " + fmtMoney(li.laborRate) : fmtMoney(li.unitPrice)),
                React.createElement("td", null, li.taxRate + "%"),
                React.createElement("td", null, React.createElement("div", { className: "hstack" },
                  React.createElement("button", { className: "btn btn-ghost btn-icon", onClick: () => setEditLibItem(li) }, React.createElement(Icon, { name: "edit", size: 14 })),
                  React.createElement("button", { className: "btn btn-ghost btn-icon", onClick: () => { actions.removeLibraryItem(li.id); ui.toast("Removed from library."); } }, React.createElement(Icon, { name: "trash", size: 14 }))
                ))
              ))
            )
          )
        )
      )
    ),

    showNew && React.createElement(NewInvoiceModal, { db, actions, ui, onClose: () => setShowNew(false), onCreated: (id) => { setShowNew(false); setOpenInvoice(id); } }),
    openInvoice && React.createElement(InvoiceDrawer, { db, actions, ui, invoiceId: openInvoice, onClose: () => setOpenInvoice(null), onOpenCustomer, onOpenVehicle, onOpenJob }),
    (showNewLib || editLibItem) && React.createElement(LibraryItemModal, { actions, ui, item: editLibItem, onClose: () => { setShowNewLib(false); setEditLibItem(null); } })
  );
}
