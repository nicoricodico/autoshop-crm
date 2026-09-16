/* ==========================================================================
   Pure formatting/calculation helpers + static option lists — ported
   verbatim from the prototype's data.js (lines 1-130). No React, no
   Supabase, no browser APIs: safe to import from server or client code.
   ========================================================================== */

let __idCounter = 1000;
export function uid(prefix) {
  __idCounter += 1;
  return (prefix || "id") + "_" + __idCounter.toString(36) + Math.random().toString(36).slice(2, 5);
}

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
export function fmtMoney(n) { return money.format(Number(n) || 0); }

export function fmtDate(d, opts) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("en-CA", opts || { month: "short", day: "numeric", year: "numeric" });
}
export function fmtDateShort(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
export function fmtTime(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
}
export function fmtDateTime(d) { return fmtDateShort(d) + " · " + fmtTime(d); }
export function isSameDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
}
export function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export function addMinutes(d, n) { const x = new Date(d); x.setMinutes(x.getMinutes() + n); return x; }
export function setTime(d, h, m) { const x = new Date(d); x.setHours(h, m || 0, 0, 0); return x; }
export function startOfWeek(d) { const x = startOfDay(d); const day = x.getDay(); return addDays(x, -day); }
export function timeAgo(d) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return days + "d ago";
  if (days < 30) return Math.floor(days / 7) + "w ago";
  return Math.floor(days / 30) + "mo ago";
}
export function findById(arr, id) { return (arr || []).find(x => x.id === id); }
export function initials(name) {
  return (name || "").split(" ").filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join("");
}

/* ---------- static option lists ---------- */

export const JOB_STATUSES = [
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_approval", label: "Waiting Approval" },
  { value: "waiting_parts", label: "Waiting on Parts" },
  { value: "ready_pickup", label: "Ready for Pickup" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
];
export const INVOICE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" }
];
export const TEAM_ROLES = ["Owner", "Manager", "Service Advisor", "Technician", "Apprentice", "Receptionist"];
// Maps the display labels above to the role values actually stored in the
// database (profiles.role) — the UI still shows the friendly labels.
export const TEAM_ROLE_VALUES = {
  "Owner": "owner",
  "Manager": "manager",
  "Service Advisor": "service_advisor",
  "Technician": "technician",
  "Apprentice": "apprentice",
  "Receptionist": "receptionist"
};
export const TEAM_ROLE_LABELS = Object.fromEntries(Object.entries(TEAM_ROLE_VALUES).map(([label, value]) => [value, label]));
export const TEAM_STATUSES = [
  { value: "active", label: "Available" },
  { value: "on_job", label: "On a Job" },
  { value: "break", label: "On Break" },
  { value: "off_today", label: "Off Today" }
];
export const LINE_ITEM_CATEGORIES = ["Labour", "Parts", "Diagnostic", "Oil Change", "Brakes", "Tires", "Inspection", "Maintenance", "Shop Supplies", "Disposal Fee", "Custom"];
export const FOLLOWUP_TYPES = [
  { value: "declined_repair", label: "Declined Repair" },
  { value: "recommended_service", label: "Recommended Service" },
  { value: "maintenance_reminder", label: "Maintenance Reminder" },
  { value: "no_return", label: "Hasn't Returned" },
  { value: "appointment_followup", label: "Appointment Follow-up" },
  { value: "unpaid_invoice", label: "Unpaid Invoice" },
  { value: "callback", label: "Callback Request" }
];
export const PAYMENT_METHODS = ["Cash", "Debit", "Visa", "Mastercard", "e-Transfer", "Financing"];
export const AUTOMATION_CATEGORIES = ["Customer Follow-Ups", "Maintenance Reminders", "Review Requests", "Appointment Reminders", "Declined-Repair Follow-Ups", "Invoice & Payment Reminders", "Other Automated Workflows"];
export const AUTOMATION_CHANNELS = [{ value: "sms", label: "SMS" }, { value: "email", label: "Email" }, { value: "both", label: "SMS + Email" }];
export const TECH_COLORS = ["var(--tech-1)", "var(--tech-2)", "var(--tech-3)", "var(--tech-4)", "var(--tech-5)", "var(--tech-6)", "var(--tech-7)", "var(--tech-8)"];

export function statusLabel(list, value) {
  const f = list.find(x => x.value === value);
  return f ? f.label : value;
}

/* ---------- line item math ---------- */

export function lineItemTotal(li) {
  const base = (Number(li.laborHours) > 0)
    ? Number(li.laborHours) * Number(li.laborRate || 0)
    : Number(li.qty || 1) * Number(li.unitPrice || 0);
  const discounted = base - (Number(li.discount) || 0);
  const taxed = discounted * (1 + (Number(li.taxRate) || 0) / 100);
  return Math.max(0, taxed);
}
export function lineItemSubtotal(li) {
  return (Number(li.laborHours) > 0)
    ? Number(li.laborHours) * Number(li.laborRate || 0)
    : Number(li.qty || 1) * Number(li.unitPrice || 0);
}
export function effectiveInvoiceStatus(inv) {
  if (inv.status === "paid" || inv.status === "cancelled" || inv.status === "draft") return inv.status;
  const totals = computeTotals(inv.lineItems, inv.discountValue, inv.discountType, inv.taxRate, inv.payments);
  if (totals.balance > 0.005 && new Date(inv.dueDate) < startOfDay(new Date())) return "overdue";
  return inv.status;
}
export function computeTotals(lineItems, discountValue, discountType, taxRate, payments) {
  const subtotal = (lineItems || []).reduce((s, li) => s + lineItemSubtotal(li), 0);
  const discAmt = discountType === "percent" ? subtotal * (Number(discountValue) || 0) / 100 : (Number(discountValue) || 0);
  const afterDiscount = Math.max(0, subtotal - discAmt);
  const taxAmt = afterDiscount * (Number(taxRate) || 0) / 100;
  const total = afterDiscount + taxAmt;
  const paid = (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Math.max(0, total - paid);
  return { subtotal, discAmt, afterDiscount, taxAmt, total, paid, balance };
}
