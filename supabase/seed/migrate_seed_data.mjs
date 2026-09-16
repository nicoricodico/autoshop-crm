#!/usr/bin/env node
/* ==========================================================================
   One-time migration: loads the prototype's original sample data (the
   exact seed from the old data.js — same customers, vehicles, jobs,
   invoices, team, and automations) into a brand-new "Vamp Auto" shop —
   Organization / Shop A — in Supabase.

   This is how "the current shop becomes the first organization" happens:
   it is not a fake/generic shop, it's the same data the prototype always
   shipped with, now living in Postgres under organization_id instead of
   a JS array.

   Requirements: a project with 0001_schema.sql and 0002_rls_policies.sql
   already applied, and a .env.local with NEXT_PUBLIC_SUPABASE_URL +
   SUPABASE_SECRET_KEY set (see .env.local.example). Run with:
     npm run seed
   Safe to run only once per project — it aborts if a "vamp-auto" shop
   already exists rather than creating a duplicate.
   ========================================================================== */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { randomUUID, randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import {
  uid, addDays, addMinutes, setTime, startOfDay, computeTotals,
  TECH_COLORS, PAYMENT_METHODS,
} from "../../lib/crm/helpers.js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SECRET_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.local.example to .env.local and fill it in first.");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const ROLE_LABEL_TO_DB = {
  Owner: "owner", Manager: "manager", "Service Advisor": "service_advisor",
  Technician: "technician", Apprentice: "apprentice", Receptionist: "receptionist",
};

function genPin() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/* ---------------------------------------------------------------------------
   The exact seed dataset from the prototype's data.js buildSeed(), kept as
   close to verbatim as possible (same customers, vehicles, jobs, invoices,
   follow-ups, team, automations) so Shop A opens looking exactly like the
   CRM always did.
   --------------------------------------------------------------------------- */
function buildSeed() {
  const today = startOfDay(new Date());

  const team = [
    { id: "t1", name: "Marcus Reyes", role: "Owner", email: "marcus@vampauto.ca", phone: "905-555-0101", status: "active", color: TECH_COLORS[7], workDays: [1, 2, 3, 4, 5], startHour: 8, endHour: 18 },
    { id: "t2", name: "Dana Whitfield", role: "Manager", email: "dana@vampauto.ca", phone: "905-555-0102", status: "active", color: TECH_COLORS[7], workDays: [1, 2, 3, 4, 5], startHour: 8, endHour: 17 },
    { id: "t3", name: "Priya Nair", role: "Service Advisor", email: "priya@vampauto.ca", phone: "905-555-0103", status: "active", color: TECH_COLORS[4], workDays: [1, 2, 3, 4, 5, 6], startHour: 8, endHour: 16 },
    { id: "t4", name: "Jake Kowalski", role: "Technician", email: "jake@vampauto.ca", phone: "905-555-0104", status: "on_job", color: TECH_COLORS[0], workDays: [1, 2, 3, 4, 5], startHour: 8, endHour: 17 },
    { id: "t5", name: "Omar Haddad", role: "Technician", email: "omar@vampauto.ca", phone: "905-555-0105", status: "active", color: TECH_COLORS[1], workDays: [1, 2, 3, 4, 5, 6], startHour: 9, endHour: 18 },
    { id: "t6", name: "Ty Brennan", role: "Apprentice", email: "ty@vampauto.ca", phone: "905-555-0106", status: "break", color: TECH_COLORS[2], workDays: [2, 3, 4, 5, 6], startHour: 9, endHour: 17 },
  ];

  const customers = [
    { id: "c1", name: "Renee Coulson", phone: "416-555-1021", email: "renee.coulson@gmail.com", address: "18 Birchmount Rd, Meadowbrook, ON", notes: "Prefers text over calls.", createdAt: addDays(today, -220) },
    { id: "c2", name: "Anthony DiMarco", phone: "416-555-1044", email: "a.dimarco@outlook.com", address: "402 Kestrel Ave, Meadowbrook, ON", notes: "Fleet of 2 work trucks.", createdAt: addDays(today, -180) },
    { id: "c3", name: "Farah Osei", phone: "647-555-1180", email: "farah.osei@yahoo.com", address: "77 Laurel Crescent, Meadowbrook, ON", notes: "", createdAt: addDays(today, -160) },
    { id: "c4", name: "Greg Halpern", phone: "905-555-1233", email: "greghalpern@gmail.com", address: "9 Concession St, Riverton, ON", notes: "Always asks for a full inspection.", createdAt: addDays(today, -140) },
    { id: "c5", name: "Michelle Boudreau", phone: "416-555-1298", email: "m.boudreau@gmail.com", address: "1155 Harvest Line, Riverton, ON", notes: "", createdAt: addDays(today, -120) },
    { id: "c6", name: "Trevor Lang", phone: "289-555-1355", email: "trevor.lang@icloud.com", address: "220 Foundry St, Meadowbrook, ON", notes: "Cash preferred.", createdAt: addDays(today, -100) },
    { id: "c7", name: "Simone Baptiste", phone: "416-555-1409", email: "simone.baptiste@gmail.com", address: "63 Wrenfield Dr, Meadowbrook, ON", notes: "", createdAt: addDays(today, -85) },
    { id: "c8", name: "Devon Ackerman", phone: "647-555-1462", email: "devon.ackerman@hotmail.com", address: "14 Millrace Ct, Riverton, ON", notes: "Warranty work on the Jeep.", createdAt: addDays(today, -60) },
    { id: "c9", name: "Wanda Petrescu", phone: "905-555-1517", email: "wanda.p@gmail.com", address: "500 Orchard Gate, Meadowbrook, ON", notes: "", createdAt: addDays(today, -45) },
    { id: "c10", name: "Liam Fitzgerald", phone: "416-555-1571", email: "liam.fitz@gmail.com", address: "31 Coventry Rd, Riverton, ON", notes: "New customer, referred by Renee.", createdAt: addDays(today, -10) },
  ];

  const vehicles = [
    { id: "v1", customerId: "c1", year: 2018, make: "Honda", model: "Civic", trim: "EX", vin: "2HGFC2F59JH512034", plate: "CXKL 219", color: "Silver", mileage: 98400 },
    { id: "v2", customerId: "c2", year: 2021, make: "Ford", model: "F-150", trim: "XLT", vin: "1FTEW1EP0MFA10238", plate: "BPRT 884", color: "Black", mileage: 61200 },
    { id: "v3", customerId: "c2", year: 2019, make: "Ford", model: "Transit 250", trim: "Cargo", vin: "1FTBR1Y82KKA20291", plate: "BPRT 885", color: "White", mileage: 84500 },
    { id: "v4", customerId: "c3", year: 2020, make: "Toyota", model: "RAV4", trim: "LE", vin: "2T3F1RFV0LW049812", plate: "CVXP 002", color: "Blue", mileage: 52300 },
    { id: "v5", customerId: "c4", year: 2016, make: "Subaru", model: "Outback", trim: "Limited", vin: "4S4BSANC7G3299013", plate: "AZNL 731", color: "Gray", mileage: 141200 },
    { id: "v6", customerId: "c5", year: 2022, make: "Mazda", model: "CX-5", trim: "GS", vin: "JM3KFBCM4N0612844", plate: "DKTM 556", color: "Red", mileage: 24800 },
    { id: "v7", customerId: "c6", year: 2015, make: "Chevrolet", model: "Silverado 1500", trim: "LT", vin: "3GCUKREC5FG198837", plate: "AWJH 449", color: "Blue", mileage: 178300 },
    { id: "v8", customerId: "c7", year: 2023, make: "Hyundai", model: "Elantra", trim: "Preferred", vin: "5NPD84LF2PH330192", plate: "EFLQ 118", color: "White", mileage: 12100 },
    { id: "v9", customerId: "c8", year: 2020, make: "Jeep", model: "Wrangler", trim: "Sport", vin: "1C4HJXDG5LW220981", plate: "CMPY 673", color: "Green", mileage: 45900 },
    { id: "v10", customerId: "c9", year: 2017, make: "Volkswagen", model: "Jetta", trim: "Comfortline", vin: "3VW2B7AJ0HM378210", plate: "AXPT 902", color: "Black", mileage: 112700 },
    { id: "v11", customerId: "c10", year: 2019, make: "Nissan", model: "Rogue", trim: "SV", vin: "5N1AT2MT6KC789045", plate: "DHNK 240", color: "Silver", mileage: 68900 },
  ];

  const libraryItems = [
    { id: "li_lab", name: "General Labour", category: "Labour", description: "Standard shop labour rate", unitPrice: 0, laborHours: 1, laborRate: 145, taxRate: 13 },
    { id: "li_diag", name: "Diagnostic Fee", category: "Diagnostic", description: "Computer diagnostic scan + report", unitPrice: 89, laborHours: 0, laborRate: 0, taxRate: 13 },
    { id: "li_oil_c", name: "Full Synthetic Oil Change", category: "Oil Change", description: "Up to 5.5L full synthetic + filter", unitPrice: 79.99, laborHours: 0, laborRate: 0, taxRate: 13 },
    { id: "li_oil_conv", name: "Conventional Oil Change", category: "Oil Change", description: "Up to 5.5L conventional + filter", unitPrice: 54.99, laborHours: 0, laborRate: 0, taxRate: 13 },
    { id: "li_brake_pads_f", name: "Front Brake Pads (pair)", category: "Brakes", description: "Ceramic pads, front axle", unitPrice: 96, laborHours: 1, laborRate: 145, taxRate: 13 },
    { id: "li_brake_rotor", name: "Brake Rotor", category: "Brakes", description: "Per rotor, machined or new", unitPrice: 68, laborHours: 0, laborRate: 0, taxRate: 13 },
    { id: "li_tire_swap", name: "Tire Swap (set of 4)", category: "Tires", description: "Seasonal swap incl. balance", unitPrice: 0, laborHours: 0.8, laborRate: 145, taxRate: 13 },
    { id: "li_tire_rot", name: "Tire Rotation", category: "Tires", description: "Rotate + inspect tread", unitPrice: 0, laborHours: 0.4, laborRate: 145, taxRate: 13 },
    { id: "li_insp", name: "Multi-Point Inspection", category: "Inspection", description: "36-point safety inspection", unitPrice: 0, laborHours: 0.5, laborRate: 145, taxRate: 13 },
    { id: "li_safety", name: "Safety Standards Certificate", category: "Inspection", description: "Ontario safety inspection + cert", unitPrice: 99.99, laborHours: 0, laborRate: 0, taxRate: 13 },
    { id: "li_battery", name: "Battery Replacement", category: "Maintenance", description: "OEM-spec battery incl. install", unitPrice: 189, laborHours: 0.3, laborRate: 145, taxRate: 13 },
    { id: "li_coolant", name: "Coolant Flush", category: "Maintenance", description: "Full system flush + fill", unitPrice: 45, laborHours: 0.6, laborRate: 145, taxRate: 13 },
    { id: "li_wiper", name: "Wiper Blades (pair)", category: "Parts", description: "", unitPrice: 34, laborHours: 0, laborRate: 0, taxRate: 13 },
    { id: "li_alt", name: "Alternator Replacement", category: "Parts", description: "Remanufactured alternator + install", unitPrice: 285, laborHours: 1.5, laborRate: 145, taxRate: 13 },
    { id: "li_supplies", name: "Shop Supplies", category: "Shop Supplies", description: "Rags, fluids, fasteners", unitPrice: 12.5, laborHours: 0, laborRate: 0, taxRate: 13 },
    { id: "li_disposal", name: "Environmental / Disposal Fee", category: "Disposal Fee", description: "Oil + tire disposal", unitPrice: 8.5, laborHours: 0, laborRate: 0, taxRate: 13 },
  ];

  function mkLI(tplId, overrides) {
    const tpl = libraryItems.find(l => l.id === tplId) || {};
    return Object.assign({
      id: uid("li"), name: tpl.name || "Custom Item", description: tpl.description || "",
      category: tpl.category || "Custom", qty: 1, unitPrice: tpl.unitPrice || 0,
      laborHours: tpl.laborHours || 0, laborRate: tpl.laborRate || 0, discount: 0,
      taxRate: tpl.taxRate != null ? tpl.taxRate : 13,
    }, overrides || {});
  }

  const jobs = [];
  const appointments = [];
  const invoices = [];
  const followUps = [];

  function addJobBundle(cfg) {
    const jobId = uid("job");
    const apptId = uid("appt");
    const start = cfg.start;
    const end = cfg.end || addMinutes(start, cfg.durationMin || 60);
    jobs.push({
      id: jobId, customerId: cfg.customerId, vehicleId: cfg.vehicleId, appointmentId: apptId,
      concern: cfg.concern, diagnosis: cfg.diagnosis || "", status: cfg.status,
      approvalStatus: cfg.approvalStatus || "pending", technicianId: cfg.technicianId,
      lineItems: cfg.lineItems || [], notes: cfg.notes || "", createdAt: addMinutes(start, -60 * 24),
      completedAt: cfg.status === "completed" ? end : null,
    });
    appointments.push({
      id: apptId, customerId: cfg.customerId, vehicleId: cfg.vehicleId, jobId,
      technicianId: cfg.technicianId, start, end, title: cfg.concern,
      status: cfg.apptStatus || (cfg.status === "completed" ? "completed" : cfg.status === "cancelled" ? "cancelled" : "scheduled"),
    });
    if (cfg.invoice) {
      const invId = uid("inv");
      const li = cfg.lineItems || [];
      invoices.push({
        id: invId, invoiceNumber: cfg.invoice.number, customerId: cfg.customerId, vehicleId: cfg.vehicleId, jobId,
        date: cfg.invoice.date || end, dueDate: cfg.invoice.dueDate || addDays(end, 15),
        lineItems: li, discountType: "percent", discountValue: cfg.invoice.discount || 0,
        taxRate: 13, payments: cfg.invoice.payments || [], status: cfg.invoice.status,
        paymentMethod: cfg.invoice.paymentMethod || "", notes: cfg.invoice.notes || "",
      });
    }
    return { jobId, apptId };
  }

  addJobBundle({ customerId: "c5", vehicleId: "v6", technicianId: "t5", status: "completed", approvalStatus: "approved", concern: "Full synthetic oil change + tire rotation", diagnosis: "Routine maintenance, no issues found.", durationMin: 60, start: setTime(addDays(today, -1), 9, 30), lineItems: [mkLI("li_oil_c"), mkLI("li_tire_rot"), mkLI("li_insp")], invoice: { number: "INV-1042", status: "paid", payments: [{ id: uid("pay"), amount: 214.35, method: "Debit", date: setTime(addDays(today, -1), 11, 5) }] } });
  addJobBundle({ customerId: "c9", vehicleId: "v10", technicianId: "t4", status: "completed", approvalStatus: "approved", concern: "Battery dead, won't start", diagnosis: "Battery failed load test, replaced.", durationMin: 45, start: setTime(addDays(today, -1), 13, 0), lineItems: [mkLI("li_battery"), mkLI("li_diag")], invoice: { number: "INV-1043", status: "overdue", dueDate: addDays(today, -1), payments: [] } });

  {
    const { jobId } = addJobBundle({ customerId: "c7", vehicleId: "v8", technicianId: "t5", status: "completed", approvalStatus: "approved", concern: "Squealing noise from front brakes", diagnosis: "Front pads at 20%. Rear rotors showing early rust scoring — customer declined rear service for now.", durationMin: 75, start: setTime(addDays(today, -2), 10, 0), lineItems: [mkLI("li_brake_pads_f"), mkLI("li_diag")], invoice: { number: "INV-1039", status: "paid", payments: [{ id: uid("pay"), amount: 259.35, method: "Visa", date: setTime(addDays(today, -2), 11, 30) }] } });
    followUps.push({ id: uid("fu"), type: "declined_repair", customerId: "c7", vehicleId: "v8", jobId, dueDate: addDays(today, 20), assignedTo: "t3", status: "open", notes: "Rear rotors showing early rust scoring — recommend within 2-3 months.", createdAt: addDays(today, -2) });
  }

  addJobBundle({ customerId: "c1", vehicleId: "v1", technicianId: "t4", status: "in_progress", approvalStatus: "approved", concern: "Brake pads worn, grinding sound", diagnosis: "Confirmed metal-on-metal on front pads. Rotors need machining.", durationMin: 90, start: setTime(today, 8, 30), lineItems: [mkLI("li_brake_pads_f"), mkLI("li_brake_rotor", { qty: 2 }), mkLI("li_diag")] });
  addJobBundle({ customerId: "c3", vehicleId: "v4", technicianId: "t5", status: "waiting_approval", approvalStatus: "pending", concern: "Check engine light on, rough idle", diagnosis: "Code P0301 — misfire cylinder 1. Recommend ignition coil + spark plug replacement.", durationMin: 60, start: setTime(today, 9, 0), lineItems: [mkLI("li_diag")] });
  addJobBundle({ customerId: "c6", vehicleId: "v7", technicianId: "t6", status: "waiting_parts", approvalStatus: "approved", concern: "Alternator replacement", diagnosis: "Alternator failed bench test. Part on order, ETA today.", durationMin: 120, start: setTime(today, 8, 0), lineItems: [mkLI("li_alt")] });
  addJobBundle({ customerId: "c4", vehicleId: "v5", technicianId: "t4", status: "ready_pickup", approvalStatus: "approved", concern: "Annual safety inspection", diagnosis: "Passed inspection. Wipers replaced.", durationMin: 60, start: setTime(today, 7, 30), lineItems: [mkLI("li_safety"), mkLI("li_wiper"), mkLI("li_insp")], invoice: { number: "INV-1044", status: "partially_paid", payments: [{ id: uid("pay"), amount: 100, method: "Debit", date: setTime(today, 12, 15) }] } });
  addJobBundle({ customerId: "c8", vehicleId: "v9", technicianId: "t5", status: "scheduled", approvalStatus: "pending", concern: "Coolant flush + inspection (warranty)", diagnosis: "", durationMin: 60, start: setTime(today, 13, 0), lineItems: [mkLI("li_coolant"), mkLI("li_insp")] });
  addJobBundle({ customerId: "c2", vehicleId: "v2", technicianId: "t4", status: "scheduled", approvalStatus: "pending", concern: "Tire swap to winters (set of 4)", diagnosis: "", durationMin: 45, start: setTime(today, 14, 30), lineItems: [mkLI("li_tire_swap")] });
  addJobBundle({ customerId: "c10", vehicleId: "v11", technicianId: "t5", status: "scheduled", approvalStatus: "pending", concern: "New customer — general inspection + oil change", diagnosis: "", durationMin: 60, start: setTime(today, 15, 30), lineItems: [mkLI("li_oil_conv"), mkLI("li_insp")] });
  addJobBundle({ customerId: "c3", vehicleId: "v4", technicianId: "t6", status: "completed", approvalStatus: "approved", concern: "Walk-in: wiper blade replacement", diagnosis: "Both blades worn, replaced.", durationMin: 20, start: setTime(today, 7, 45), lineItems: [mkLI("li_wiper")], invoice: { number: "INV-1041", status: "paid", payments: [{ id: uid("pay"), amount: 1, method: "Cash", date: setTime(today, 8, 10) }] } });

  addJobBundle({ customerId: "c5", vehicleId: "v6", technicianId: "t5", status: "scheduled", approvalStatus: "pending", concern: "Cabin + engine air filter replacement", durationMin: 45, start: setTime(addDays(today, 1), 10, 0), lineItems: [mkLI("li_wiper")] });
  addJobBundle({ customerId: "c1", vehicleId: "v1", technicianId: "t6", status: "scheduled", approvalStatus: "pending", concern: "Follow-up: rotor inspection", durationMin: 30, start: setTime(addDays(today, 1), 13, 0), lineItems: [] });
  addJobBundle({ customerId: "c3", vehicleId: "v4", technicianId: "t4", status: "scheduled", approvalStatus: "approved", concern: "Ignition coil + spark plugs replacement", durationMin: 90, start: setTime(addDays(today, 2), 9, 0), lineItems: [mkLI("li_diag")] });
  addJobBundle({ customerId: "c9", vehicleId: "v10", technicianId: "t5", status: "scheduled", approvalStatus: "pending", concern: "Oil change", durationMin: 45, start: setTime(addDays(today, 2), 11, 0), lineItems: [mkLI("li_oil_conv")] });
  addJobBundle({ customerId: "c7", vehicleId: "v8", technicianId: "t4", status: "scheduled", approvalStatus: "pending", concern: "Tire rotation + inspection", durationMin: 45, start: setTime(addDays(today, 3), 9, 30), lineItems: [mkLI("li_tire_rot")] });
  addJobBundle({ customerId: "c6", vehicleId: "v7", technicianId: "t5", status: "scheduled", approvalStatus: "pending", concern: "Post-repair check: alternator", durationMin: 30, start: setTime(addDays(today, 4), 10, 0), lineItems: [] });
  addJobBundle({ customerId: "c4", vehicleId: "v5", technicianId: "t6", status: "scheduled", approvalStatus: "pending", concern: "Oil change + multi-point inspection", durationMin: 60, start: setTime(addDays(today, 5), 9, 0), lineItems: [mkLI("li_oil_c"), mkLI("li_insp")] });
  addJobBundle({ customerId: "c2", vehicleId: "v3", technicianId: "t4", status: "scheduled", approvalStatus: "pending", concern: "Fleet van — brake inspection", durationMin: 60, start: setTime(addDays(today, -3), 9, 0) });

  invoices.push({ id: uid("inv"), invoiceNumber: "INV-1040", customerId: "c2", vehicleId: "v2", jobId: null, date: addDays(today, -6), dueDate: addDays(today, 9), lineItems: [mkLI("li_brake_pads_f"), mkLI("li_brake_rotor", { qty: 2 }), mkLI("li_diag")], discountType: "percent", discountValue: 0, taxRate: 13, payments: [{ id: uid("pay"), amount: 150, method: "e-Transfer", date: addDays(today, -5) }], status: "partially_paid", paymentMethod: "e-Transfer", notes: "Customer paying remainder on pickup." });
  invoices.push({ id: uid("inv"), invoiceNumber: "INV-1045", customerId: "c8", vehicleId: "v9", jobId: null, date: today, dueDate: addDays(today, 15), lineItems: [mkLI("li_coolant"), mkLI("li_insp")], discountType: "percent", discountValue: 0, taxRate: 13, payments: [], status: "draft", paymentMethod: "", notes: "" });

  followUps.push(
    { id: uid("fu"), type: "maintenance_reminder", customerId: "c5", vehicleId: "v6", jobId: null, dueDate: addDays(today, 90), assignedTo: "t3", status: "open", notes: "Due for next oil change in ~5,000 km.", createdAt: addDays(today, -1) },
    { id: uid("fu"), type: "unpaid_invoice", customerId: "c9", vehicleId: "v10", jobId: null, dueDate: addDays(today, 2), assignedTo: "t2", status: "open", notes: "INV-1043 overdue — battery replacement.", createdAt: addDays(today, -1) },
    { id: uid("fu"), type: "no_return", customerId: "c6", vehicleId: "v7", jobId: null, dueDate: addDays(today, 1), assignedTo: "t3", status: "open", notes: "Hasn't been in for annual inspection this year.", createdAt: addDays(today, -14) },
    { id: uid("fu"), type: "callback", customerId: "c10", vehicleId: "v11", jobId: null, dueDate: today, assignedTo: "t3", status: "open", notes: "Wants a quote for winter tire storage.", createdAt: addDays(today, -1) },
    { id: uid("fu"), type: "recommended_service", customerId: "c4", vehicleId: "v5", jobId: null, dueDate: addDays(today, 30), assignedTo: "t5", status: "open", notes: "Recommend timing belt inspection at next visit (140k+ km).", createdAt: addDays(today, -20) },
    { id: uid("fu"), type: "appointment_followup", customerId: "c1", vehicleId: "v1", jobId: jobs[3] ? jobs[3].id : null, dueDate: addDays(today, 1), assignedTo: "t4", status: "open", notes: "Confirm brake job resolved the grinding noise.", createdAt: today },
    { id: uid("fu"), type: "unpaid_invoice", customerId: "c2", vehicleId: "v2", jobId: null, dueDate: addDays(today, 9), assignedTo: "t2", status: "open", notes: "INV-1040 balance due — $169.50", createdAt: addDays(today, -5) },
    { id: uid("fu"), type: "declined_repair", customerId: "c1", vehicleId: "v1", jobId: null, dueDate: addDays(today, -3), assignedTo: "t3", status: "done", notes: "Cabin filter declined last visit — completed today instead.", createdAt: addDays(today, -30) }
  );

  const settings = {
    businessName: "Vamp Auto", address: "1420 Speedway Ave, Meadowbrook, ON L4K 0A1", phone: "905-555-0100",
    email: "office@vampauto.ca", logoText: "VA",
    hours: { mon: "7:30 AM – 6:00 PM", tue: "7:30 AM – 6:00 PM", wed: "7:30 AM – 6:00 PM", thu: "7:30 AM – 6:00 PM", fri: "7:30 AM – 6:00 PM", sat: "9:00 AM – 3:00 PM", sun: "Closed" },
    laborRate: 145, taxRate: 13, invoicePrefix: "INV-", nextInvoiceNumber: 1046, defaultDueDays: 15,
    paymentMethods: PAYMENT_METHODS.slice(), notifications: { smsReminders: true, emailReceipts: true, followUpDigest: true, lowPartsAlerts: false },
    customRoles: [], logoDataUrl: "",
  };

  invoices.forEach(inv => {
    if (inv.status === "paid" && inv.payments && inv.payments.length === 1) {
      const totals = computeTotals(inv.lineItems, inv.discountValue, inv.discountType, inv.taxRate, []);
      inv.payments[0].amount = Math.round(totals.total * 100) / 100;
    }
  });

  function mkAutoLog(daysAgo, count) { return { date: addDays(today, -daysAgo), count }; }
  const automations = [
    { key: "appointment_reminder", name: "Appointment Reminders", category: "Appointment Reminders", description: "Text a reminder to customers before their scheduled appointment.", trigger: "Before the appointment start time", delayValue: 24, delayUnit: "hours", channel: "sms", enabled: true, template: "Hi {{customer_first_name}}, reminder: your appointment at {{shop_name}} is {{appointment_date}} at {{appointment_time}}. Reply STOP to opt out.", log: [mkAutoLog(1, 9), mkAutoLog(2, 7), mkAutoLog(3, 11)] },
    { key: "customer_followup", name: "Post-Visit Follow-Ups", category: "Customer Follow-Ups", description: "Check in with customers a few days after a completed job to make sure everything's running well.", trigger: "After a job is marked completed", delayValue: 3, delayUnit: "days", channel: "sms", enabled: true, template: "Hi {{customer_first_name}}, just checking in after your recent visit to {{shop_name}} — how's everything running? Let us know if you have questions.", log: [mkAutoLog(2, 4), mkAutoLog(9, 6)] },
    { key: "maintenance_reminder", name: "Maintenance Reminders", category: "Maintenance Reminders", description: "Notify customers by email when their vehicle is coming up on its next routine service.", trigger: "Before the estimated maintenance due date", delayValue: 7, delayUnit: "days", channel: "email", enabled: true, template: "Hi {{customer_first_name}}, your {{vehicle_year_make_model}} is due for its next service soon. Call {{shop_phone}} or book online to schedule.", log: [mkAutoLog(5, 3), mkAutoLog(19, 5)] },
    { key: "review_request", name: "Review Requests", category: "Review Requests", description: "Ask customers for a review shortly after their invoice is paid in full.", trigger: "After an invoice is marked Paid", delayValue: 4, delayUnit: "hours", channel: "sms", enabled: true, template: "Thanks for choosing {{shop_name}}, {{customer_first_name}}! If you have a minute, we'd love a review: {{review_link}}", log: [mkAutoLog(1, 2), mkAutoLog(2, 3)] },
    { key: "declined_repair_followup", name: "Declined-Repair Follow-Ups", category: "Declined-Repair Follow-Ups", description: "Follow up on repairs a customer declined, before small issues become bigger ones.", trigger: "After a declined repair is logged on a job", delayValue: 14, delayUnit: "days", channel: "email", enabled: true, template: "Hi {{customer_first_name}}, following up on the {{declined_item}} we discussed for your {{vehicle_year_make_model}}. Happy to get it scheduled whenever works.", log: [mkAutoLog(6, 1)] },
    { key: "invoice_payment_reminder", name: "Invoice & Payment Reminders", category: "Invoice & Payment Reminders", description: "Remind customers about unpaid or overdue invoice balances.", trigger: "On the due date, then repeats while unpaid", delayValue: 3, delayUnit: "days", channel: "both", enabled: true, template: "Hi {{customer_first_name}}, invoice {{invoice_number}} for {{balance_due}} is due. Pay online or call {{shop_phone}}.", log: [mkAutoLog(1, 2), mkAutoLog(4, 3)] },
    { key: "no_return_winback", name: "Hasn't-Returned Win-Back", category: "Other Automated Workflows", description: "Reach out to customers who haven't booked a visit in a while.", trigger: "Since the customer's last completed visit", delayValue: 180, delayUnit: "days", channel: "email", enabled: false, template: "Hi {{customer_first_name}}, it's been a while since your last visit to {{shop_name}}. We'd love to see you and your vehicle again — book anytime.", log: [] },
  ];

  return { team, customers, vehicles, jobs, appointments, invoices, followUps, lineItemLibrary: libraryItems, settings, automations };
}

/* ---------------------------------------------------------------------------
   Migration
   --------------------------------------------------------------------------- */
async function main() {
  const seed = buildSeed();
  const credentials = []; // { name, role, email, pin } — printed at the end

  console.log("Checking for an existing 'vamp-auto' shop…");
  const { data: existing } = await admin.from("organizations").select("id").eq("slug", "vamp-auto").maybeSingle();
  if (existing) {
    console.error("A shop with slug 'vamp-auto' already exists (id " + existing.id + "). Aborting so we don't create a duplicate Shop A. Delete it first if you really want to re-seed.");
    process.exit(1);
  }

  console.log("Creating organization (Shop A)…");
  const { data: org, error: orgErr } = await admin.from("organizations").insert({ name: seed.settings.businessName, slug: "vamp-auto" }).select().single();
  if (orgErr) throw orgErr;
  const orgId = org.id;

  console.log("Writing shop settings…");
  const { error: settingsErr } = await admin.from("org_settings").insert({
    organization_id: orgId,
    business_name: seed.settings.businessName, address: seed.settings.address, phone: seed.settings.phone,
    email: seed.settings.email, logo_text: seed.settings.logoText, logo_data_url: seed.settings.logoDataUrl,
    hours: seed.settings.hours, labor_rate: seed.settings.laborRate, tax_rate: seed.settings.taxRate,
    invoice_prefix: seed.settings.invoicePrefix, next_invoice_number: seed.settings.nextInvoiceNumber,
    default_due_days: seed.settings.defaultDueDays, payment_methods: seed.settings.paymentMethods,
    notifications: seed.settings.notifications, custom_roles: seed.settings.customRoles,
  });
  if (settingsErr) throw settingsErr;

  console.log("Creating team accounts (each gets a real login + a random 6-digit access code)…");
  const teamIdMap = {}; // old "t1" -> new profile uuid
  for (const member of seed.team) {
    const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
      email: member.email, email_confirm: true, password: randomUUID() + randomUUID(),
      user_metadata: { name: member.name },
    });
    if (authErr) throw new Error("Creating auth user for " + member.name + ": " + authErr.message);

    const dbRole = ROLE_LABEL_TO_DB[member.role] || "technician";
    const { error: profileErr } = await admin.from("profiles").insert({
      id: authUser.user.id, organization_id: orgId, name: member.name, email: member.email,
      phone: member.phone, role: dbRole, status: member.status, color: member.color,
      work_days: member.workDays, start_hour: member.startHour, end_hour: member.endHour,
    });
    if (profileErr) throw new Error("Creating profile for " + member.name + ": " + profileErr.message);

    const pin = genPin();
    const pinHash = await bcrypt.hash(pin, 10);
    const { error: pinErr } = await admin.from("user_pins").insert({ user_id: authUser.user.id, pin_hash: pinHash });
    if (pinErr) throw new Error("Setting PIN for " + member.name + ": " + pinErr.message);

    teamIdMap[member.id] = authUser.user.id;
    credentials.push({ name: member.name, role: member.role, email: member.email, pin });
  }
  const ownerProfileId = teamIdMap["t1"];

  console.log("Inserting customers…");
  const customerIdMap = {};
  for (const c of seed.customers) {
    const { data, error } = await admin.from("customers").insert({
      organization_id: orgId, name: c.name, phone: c.phone, email: c.email, address: c.address,
      notes: c.notes, created_at: c.createdAt.toISOString(),
    }).select("id").single();
    if (error) throw error;
    customerIdMap[c.id] = data.id;
  }

  console.log("Inserting vehicles…");
  const vehicleIdMap = {};
  for (const v of seed.vehicles) {
    const { data, error } = await admin.from("vehicles").insert({
      organization_id: orgId, customer_id: customerIdMap[v.customerId], year: v.year, make: v.make,
      model: v.model, trim: v.trim, vin: v.vin, plate: v.plate, color: v.color, mileage: v.mileage,
    }).select("id").single();
    if (error) throw error;
    vehicleIdMap[v.id] = data.id;
  }

  console.log("Inserting jobs, appointments & line items…");
  const jobIdMap = {};
  const apptIdMap = {};
  for (const j of seed.jobs) {
    const { data: jobRow, error: jobErr } = await admin.from("jobs").insert({
      organization_id: orgId, customer_id: customerIdMap[j.customerId], vehicle_id: vehicleIdMap[j.vehicleId],
      concern: j.concern, diagnosis: j.diagnosis, status: j.status, approval_status: j.approvalStatus,
      technician_id: teamIdMap[j.technicianId] || null, notes: j.notes,
      created_at: j.createdAt.toISOString(), completed_at: j.completedAt ? j.completedAt.toISOString() : null,
    }).select("id").single();
    if (jobErr) throw jobErr;
    jobIdMap[j.id] = jobRow.id;

    if (j.lineItems.length > 0) {
      const rows = j.lineItems.map((li, idx) => ({
        organization_id: orgId, job_id: jobRow.id, name: li.name, description: li.description,
        category: li.category, qty: li.qty, unit_price: li.unitPrice, labor_hours: li.laborHours,
        labor_rate: li.laborRate, discount: li.discount, tax_rate: li.taxRate, sort_order: idx,
      }));
      const { error: liErr } = await admin.from("job_line_items").insert(rows);
      if (liErr) throw liErr;
    }
  }
  for (const a of seed.appointments) {
    const { data: apptRow, error: apptErr } = await admin.from("appointments").insert({
      organization_id: orgId, customer_id: customerIdMap[a.customerId], vehicle_id: vehicleIdMap[a.vehicleId],
      job_id: jobIdMap[a.jobId] || null, technician_id: teamIdMap[a.technicianId] || null,
      title: a.title, start_at: a.start.toISOString(), end_at: a.end.toISOString(), status: a.status,
    }).select("id").single();
    if (apptErr) throw apptErr;
    apptIdMap[a.id] = apptRow.id;
  }
  // Back-fill jobs.appointment_id now that both rows exist.
  for (const j of seed.jobs) {
    if (!j.appointmentId || !apptIdMap[j.appointmentId]) continue;
    const { error } = await admin.from("jobs").update({ appointment_id: apptIdMap[j.appointmentId] }).eq("id", jobIdMap[j.id]);
    if (error) throw error;
  }

  console.log("Inserting invoices, invoice line items & payments…");
  for (const inv of seed.invoices) {
    const { data: invRow, error: invErr } = await admin.from("invoices").insert({
      organization_id: orgId, invoice_number: inv.invoiceNumber, customer_id: customerIdMap[inv.customerId],
      vehicle_id: vehicleIdMap[inv.vehicleId], job_id: inv.jobId ? jobIdMap[inv.jobId] : null,
      invoice_date: inv.date.toISOString(), due_date: inv.dueDate ? inv.dueDate.toISOString() : null,
      discount_type: inv.discountType, discount_value: inv.discountValue, tax_rate: inv.taxRate,
      status: inv.status, payment_method: inv.paymentMethod, notes: inv.notes,
    }).select("id").single();
    if (invErr) throw invErr;

    if (inv.lineItems.length > 0) {
      const rows = inv.lineItems.map((li, idx) => ({
        organization_id: orgId, invoice_id: invRow.id, name: li.name, description: li.description,
        category: li.category, qty: li.qty, unit_price: li.unitPrice, labor_hours: li.laborHours,
        labor_rate: li.laborRate, discount: li.discount, tax_rate: li.taxRate, sort_order: idx,
      }));
      const { error } = await admin.from("invoice_line_items").insert(rows);
      if (error) throw error;
    }
    if (inv.payments.length > 0) {
      const rows = inv.payments.map(p => ({
        organization_id: orgId, invoice_id: invRow.id, amount: p.amount, method: p.method, paid_at: p.date.toISOString(),
      }));
      const { error } = await admin.from("payments").insert(rows);
      if (error) throw error;
    }
  }

  console.log("Inserting follow-ups…");
  for (const f of seed.followUps) {
    const { error } = await admin.from("follow_ups").insert({
      organization_id: orgId, type: f.type, customer_id: customerIdMap[f.customerId],
      vehicle_id: f.vehicleId ? vehicleIdMap[f.vehicleId] : null, job_id: f.jobId ? jobIdMap[f.jobId] : null,
      due_date: f.dueDate ? f.dueDate.toISOString() : null, assigned_to: teamIdMap[f.assignedTo] || null,
      status: f.status, notes: f.notes, created_at: f.createdAt.toISOString(),
    });
    if (error) throw error;
  }

  console.log("Inserting the line-item library…");
  for (const li of seed.lineItemLibrary) {
    const { error } = await admin.from("line_item_library").insert({
      organization_id: orgId, name: li.name, category: li.category, description: li.description,
      unit_price: li.unitPrice, labor_hours: li.laborHours, labor_rate: li.laborRate, tax_rate: li.taxRate,
    });
    if (error) throw error;
  }

  console.log("Inserting automations…");
  for (const a of seed.automations) {
    const { data: autoRow, error } = await admin.from("automations").insert({
      organization_id: orgId, key: a.key, name: a.name, category: a.category, description: a.description,
      trigger_text: a.trigger, delay_value: a.delayValue, delay_unit: a.delayUnit, channel: a.channel,
      enabled: a.enabled, template: a.template, created_by: ownerProfileId,
    }).select("id").single();
    if (error) throw error;
    if (a.log.length > 0) {
      const rows = a.log.map(l => ({ automation_id: autoRow.id, sent_at: l.date.toISOString(), recipient_count: l.count, status: "sent" }));
      const { error: logErr } = await admin.from("automation_logs").insert(rows);
      if (logErr) throw logErr;
    }
  }

  console.log("\n✅ Shop A ('" + seed.settings.businessName + "', slug: vamp-auto) is seeded.\n");
  console.log("Sign-in credentials (shop name on the login screen: \"vamp-auto\"):\n");
  console.log("  Name                 Role              Access Code");
  console.log("  -------------------- ----------------- -----------");
  credentials.forEach(c => {
    console.log("  " + c.name.padEnd(20) + " " + c.role.padEnd(17) + " " + c.pin);
  });
  console.log("\nThese are real, randomly generated PINs — save this output somewhere safe (or have each employee change theirs from Settings after their first login). This script never prints them again.\n");
  console.log("This script created no vendor_admin account — see the README for how to create the first platform/vendor admin.\n");
}

main().catch(err => {
  console.error("\n❌ Migration failed:", err.message || err);
  process.exit(1);
});
