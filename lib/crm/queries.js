"use client";
/* ==========================================================================
   Data layer, part 1: fetching. Replaces the prototype's seedDB()/
   buildSeed() with real Supabase queries, scoped to the signed-in user's
   organization. RLS is the real security boundary here — every query
   below only ever returns rows Postgres already agrees this user may see
   — but we still filter by organization_id explicitly too, both for
   query-planner efficiency (it can use the org_id indexes) and so the
   code reads the same way a single-tenant version would.

   The output shape — { customers, vehicles, jobs, appointments, invoices,
   followUps, team, lineItemLibrary, settings } — is deliberately identical
   to the old in-memory "db" object, so the ported page components
   (components/crm/page-*.jsx) don't need to know storage changed at all.
   ========================================================================== */
import React from "react";
import { createClient } from "@/lib/supabase/client";
import { TEAM_ROLE_LABELS } from "./helpers";

function mapLineItem(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    qty: Number(row.qty),
    unitPrice: Number(row.unit_price),
    laborHours: Number(row.labor_hours),
    laborRate: Number(row.labor_rate),
    discount: Number(row.discount),
    taxRate: Number(row.tax_rate)
  };
}

function mapCustomer(row, commLogByCustomer) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    commLog: (commLogByCustomer[row.id] || []).map(c => ({ id: c.id, date: new Date(c.logged_at), text: c.text }))
  };
}

function mapVehicle(row) {
  return {
    id: row.id, customerId: row.customer_id, year: row.year, make: row.make, model: row.model,
    trim: row.trim, vin: row.vin, plate: row.plate, color: row.color, mileage: row.mileage
  };
}

function mapAppointment(row) {
  return {
    id: row.id, customerId: row.customer_id, vehicleId: row.vehicle_id, jobId: row.job_id,
    technicianId: row.technician_id, title: row.title,
    start: new Date(row.start_at), end: new Date(row.end_at), status: row.status
  };
}

function mapJob(row, lineItemsByJob) {
  return {
    id: row.id, customerId: row.customer_id, vehicleId: row.vehicle_id, appointmentId: row.appointment_id,
    concern: row.concern, diagnosis: row.diagnosis, status: row.status, approvalStatus: row.approval_status,
    technicianId: row.technician_id, notes: row.notes,
    createdAt: row.created_at ? new Date(row.created_at) : null,
    completedAt: row.completed_at ? new Date(row.completed_at) : null,
    lineItems: (lineItemsByJob[row.id] || []).map(mapLineItem)
  };
}

function mapInvoice(row, lineItemsByInvoice, paymentsByInvoice) {
  return {
    id: row.id, invoiceNumber: row.invoice_number, customerId: row.customer_id, vehicleId: row.vehicle_id,
    jobId: row.job_id, date: new Date(row.invoice_date), dueDate: row.due_date ? new Date(row.due_date) : null,
    discountType: row.discount_type, discountValue: Number(row.discount_value), taxRate: Number(row.tax_rate),
    status: row.status, paymentMethod: row.payment_method, notes: row.notes,
    lineItems: (lineItemsByInvoice[row.id] || []).map(mapLineItem),
    payments: (paymentsByInvoice[row.id] || []).map(p => ({ id: p.id, amount: Number(p.amount), method: p.method, date: new Date(p.paid_at) }))
  };
}

function mapFollowUp(row) {
  return {
    id: row.id, type: row.type, customerId: row.customer_id, vehicleId: row.vehicle_id, jobId: row.job_id,
    dueDate: row.due_date ? new Date(row.due_date) : null, assignedTo: row.assigned_to, status: row.status,
    notes: row.notes, createdAt: row.created_at ? new Date(row.created_at) : null
  };
}

function mapTeamMember(row) {
  return {
    id: row.id, name: row.name, role: TEAM_ROLE_LABELS[row.role] || row.role, email: row.email, phone: row.phone,
    status: row.status, color: row.color, workDays: row.work_days, startHour: row.start_hour, endHour: row.end_hour
  };
}

function mapLibraryItem(row) {
  return {
    id: row.id, name: row.name, category: row.category, description: row.description,
    unitPrice: Number(row.unit_price), laborHours: Number(row.labor_hours), laborRate: Number(row.labor_rate),
    taxRate: Number(row.tax_rate)
  };
}

function mapSettings(row) {
  if (!row) return null;
  return {
    businessName: row.business_name, address: row.address, phone: row.phone, email: row.email,
    logoText: row.logo_text, logoDataUrl: row.logo_data_url, hours: row.hours || {},
    laborRate: Number(row.labor_rate), taxRate: Number(row.tax_rate), invoicePrefix: row.invoice_prefix,
    nextInvoiceNumber: row.next_invoice_number, defaultDueDays: row.default_due_days,
    paymentMethods: row.payment_methods || [], notifications: row.notifications || {}, customRoles: row.custom_roles || []
  };
}

function groupBy(rows, key) {
  const out = {};
  (rows || []).forEach(r => {
    const k = r[key];
    if (!out[k]) out[k] = [];
    out[k].push(r);
  });
  return out;
}

export async function fetchOrgData(supabase, organizationId) {
  const [
    { data: customers },
    { data: commLog },
    { data: vehicles },
    { data: appointments },
    { data: jobs },
    { data: jobLineItems },
    { data: invoices },
    { data: invoiceLineItems },
    { data: payments },
    { data: followUps },
    { data: team },
    { data: library },
    { data: settingsRow }
  ] = await Promise.all([
    supabase.from("customers").select("*").eq("organization_id", organizationId).order("created_at"),
    supabase.from("customer_comm_log").select("*").eq("organization_id", organizationId).order("logged_at"),
    supabase.from("vehicles").select("*").eq("organization_id", organizationId),
    supabase.from("appointments").select("*").eq("organization_id", organizationId).order("start_at"),
    supabase.from("jobs").select("*").eq("organization_id", organizationId).order("created_at"),
    supabase.from("job_line_items").select("*").eq("organization_id", organizationId).order("sort_order"),
    supabase.from("invoices").select("*").eq("organization_id", organizationId).order("invoice_date"),
    supabase.from("invoice_line_items").select("*").eq("organization_id", organizationId).order("sort_order"),
    supabase.from("payments").select("*").eq("organization_id", organizationId).order("paid_at"),
    supabase.from("follow_ups").select("*").eq("organization_id", organizationId).order("due_date"),
    supabase.from("profiles").select("*").eq("organization_id", organizationId).neq("role", "vendor_admin"),
    supabase.from("line_item_library").select("*").eq("organization_id", organizationId),
    supabase.from("org_settings").select("*").eq("organization_id", organizationId).maybeSingle()
  ]);

  const commLogByCustomer = groupBy(commLog, "customer_id");
  const lineItemsByJob = groupBy(jobLineItems, "job_id");
  const lineItemsByInvoice = groupBy(invoiceLineItems, "invoice_id");
  const paymentsByInvoice = groupBy(payments, "invoice_id");

  return {
    customers: (customers || []).map(c => mapCustomer(c, commLogByCustomer)),
    vehicles: (vehicles || []).map(mapVehicle),
    appointments: (appointments || []).map(mapAppointment),
    jobs: (jobs || []).map(j => mapJob(j, lineItemsByJob)),
    invoices: (invoices || []).map(i => mapInvoice(i, lineItemsByInvoice, paymentsByInvoice)),
    followUps: (followUps || []).map(mapFollowUp),
    team: (team || []).map(mapTeamMember),
    lineItemLibrary: (library || []).map(mapLibraryItem),
    settings: mapSettings(settingsRow)
  };
}

// React hook used by the app shell: resolves the signed-in user's org,
// loads everything, and exposes a refetch() the actions layer calls after
// every mutation (see actions.js). Simple and correct beats clever here —
// this is a shop-scale admin tool, not a high-frequency trading app.
export function useOrgData() {
  const [state, setState] = React.useState({ loading: true, error: null, db: null, organizationId: null, profile: null });
  const supabase = React.useMemo(() => createClient(), []);

  const refetch = React.useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setState({ loading: false, error: "signed_out", db: null, organizationId: null, profile: null });
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!profile || !profile.organization_id) {
      setState({ loading: false, error: "no_shop", db: null, organizationId: null, profile });
      return;
    }
    const db = await fetchOrgData(supabase, profile.organization_id);
    setState({ loading: false, error: null, db, organizationId: profile.organization_id, profile });
  }, [supabase]);

  React.useEffect(() => { refetch(); }, [refetch]);

  return { ...state, refetch, supabase };
}
