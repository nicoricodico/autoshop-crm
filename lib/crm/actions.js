"use client";
/* ==========================================================================
   Data layer, part 2: mutations. Same method names/shapes as the
   prototype's createActions(setDb) in data.js, so the ported page
   components barely change — but every write now goes to Supabase,
   scoped to the caller's own organization.

   Two important differences from the prototype, both deliberate:
     1. organization_id is NEVER sent by this code for shop tables — the
        force_own_org_id() database trigger (0002_rls_policies.sql) stamps
        it from the caller's session no matter what. This file could try
        to lie about the org and the database would still correct it.
     2. "Add" actions generate their id client-side (crypto.randomUUID())
        so callers can use the new id immediately (e.g. to open a drawer)
        without awaiting a round trip, exactly like the old synchronous
        in-memory version felt. The actual insert + a refetch happen
        right after; failures surface as a toast and the next refetch
        will reflect reality.
   ========================================================================== */

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2);
}

// Line items created in the browser (LineItemsEditor's addBlank/duplicate/
// addFromLibrary) get a placeholder id like "li_abc123" via lib/crm/helpers'
// uid() helper, not a real UUID. The invoice_line_items/job_line_items
// tables require a UUID primary key, so inserting that placeholder as-is
// fails — and since updateInvoice/updateJob delete the old rows *before*
// re-inserting, a failed insert here would leave the invoice/job with zero
// line items. Only reuse an id that's already a real UUID (an existing
// row being edited); otherwise mint a fresh one.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toLineItemRow(li, orgScopedFkKey, orgScopedFkValue, sortOrder) {
  return {
    id: UUID_RE.test(li.id) ? li.id : newId(),
    [orgScopedFkKey]: orgScopedFkValue,
    name: li.name || "",
    description: li.description || "",
    category: li.category || "Custom",
    qty: li.qty || 1,
    unit_price: li.unitPrice || 0,
    labor_hours: li.laborHours || 0,
    labor_rate: li.laborRate || 0,
    discount: li.discount || 0,
    tax_rate: li.taxRate != null ? li.taxRate : 13,
    sort_order: sortOrder
  };
}

export function createActions({ supabase, ui, refetch }) {
  function fail(label, error) {
    // eslint-disable-next-line no-console
    console.error(label, error);
    ui && ui.toast && ui.toast(label + (error?.message ? ": " + error.message : ""), { danger: true });
  }

  async function run(label, fn) {
    try {
      await fn();
    } catch (e) {
      fail(label, e);
    } finally {
      await refetch();
    }
  }

  return {
    // -------- customers --------
    addCustomer(data) {
      const id = newId();
      run("Could not save customer", async () => {
        const { error } = await supabase.from("customers").insert({
          id, name: data.name || "", phone: data.phone || "", email: data.email || "",
          address: data.address || "", notes: data.notes || ""
        });
        if (error) throw error;
      });
      return id;
    },
    updateCustomer(id, patch) {
      run("Could not update customer", async () => {
        const row = {};
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.phone !== undefined) row.phone = patch.phone;
        if (patch.email !== undefined) row.email = patch.email;
        if (patch.address !== undefined) row.address = patch.address;
        if (patch.notes !== undefined) row.notes = patch.notes;
        const { error } = await supabase.from("customers").update(row).eq("id", id);
        if (error) throw error;
      });
    },
    addCommLogEntry(customerId, text) {
      run("Could not save note", async () => {
        const { error } = await supabase.from("customer_comm_log").insert({ id: newId(), customer_id: customerId, text });
        if (error) throw error;
      });
    },

    // -------- vehicles --------
    addVehicle(data) {
      const id = newId();
      run("Could not save vehicle", async () => {
        const { error } = await supabase.from("vehicles").insert({
          id, customer_id: data.customerId, year: data.year || null, make: data.make || "",
          model: data.model || "", trim: data.trim || "", vin: data.vin || "", plate: data.plate || "",
          color: data.color || "", mileage: data.mileage || 0
        });
        if (error) throw error;
      });
      return id;
    },
    updateVehicle(id, patch) {
      run("Could not update vehicle", async () => {
        const row = {};
        ["year", "make", "model", "trim", "vin", "plate", "color", "mileage"].forEach(k => {
          if (patch[k] !== undefined) row[k] = patch[k];
        });
        const { error } = await supabase.from("vehicles").update(row).eq("id", id);
        if (error) throw error;
      });
    },

    // -------- team (routes through the server-side invite/remove APIs —
    // these create/deactivate real Supabase Auth accounts, which the
    // browser's anon key is never allowed to do directly) --------
    async addTeamMember(data) {
      try {
        const res = await fetch("/api/team/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not add teammate.");
        ui && ui.toast && ui.toast(data.name + " added to the team.");
        return body.userId;
      } catch (e) {
        fail("Could not add teammate", e);
        return null;
      } finally {
        await refetch();
      }
    },
    updateTeamMember(id, patch) {
      run("Could not update teammate", async () => {
        const row = {};
        ["name", "phone", "email", "status", "color"].forEach(k => {
          if (patch[k] !== undefined) row[k] = patch[k];
        });
        if (patch.role !== undefined) row.role = patch.role; // already mapped to a db value by the caller
        if (patch.workDays !== undefined) row.work_days = patch.workDays;
        if (patch.startHour !== undefined) row.start_hour = patch.startHour;
        if (patch.endHour !== undefined) row.end_hour = patch.endHour;
        const { error } = await supabase.from("profiles").update(row).eq("id", id);
        if (error) throw error;
      });
    },
    async removeTeamMember(id) {
      try {
        const res = await fetch("/api/team/" + id, { method: "DELETE" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not remove teammate.");
      } catch (e) {
        fail("Could not remove teammate", e);
      } finally {
        await refetch();
      }
    },

    // -------- jobs / appointments --------
    updateJob(id, patch) {
      run("Could not update job", async () => {
        const row = {};
        ["concern", "diagnosis", "status", "notes"].forEach(k => { if (patch[k] !== undefined) row[k] = patch[k]; });
        if (patch.approvalStatus !== undefined) row.approval_status = patch.approvalStatus;
        if (patch.technicianId !== undefined) row.technician_id = patch.technicianId;
        if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
        if (patch.lineItems !== undefined) {
          await supabase.from("job_line_items").delete().eq("job_id", id);
          if (patch.lineItems.length > 0) {
            const rows = patch.lineItems.map((li, i) => toLineItemRow(li, "job_id", id, i));
            const { error } = await supabase.from("job_line_items").insert(rows);
            if (error) throw error;
          }
        }
        if (Object.keys(row).length > 0) {
          const { error } = await supabase.from("jobs").update(row).eq("id", id);
          if (error) throw error;
        }
      });
    },
    updateAppointment(id, patch) {
      run("Could not update appointment", async () => {
        const row = {};
        if (patch.technicianId !== undefined) row.technician_id = patch.technicianId;
        if (patch.status !== undefined) row.status = patch.status;
        if (patch.start !== undefined) row.start_at = new Date(patch.start).toISOString();
        if (patch.end !== undefined) row.end_at = new Date(patch.end).toISOString();
        const { error } = await supabase.from("appointments").update(row).eq("id", id);
        if (error) throw error;
      });
    },
    moveAppointment(id, start, end) {
      run("Could not move appointment", async () => {
        const { error } = await supabase.from("appointments")
          .update({ start_at: new Date(start).toISOString(), end_at: new Date(end).toISOString() })
          .eq("id", id);
        if (error) throw error;
      });
    },

    // composite creation from the Scheduling "Create Job" form
    createJobBundle(input) {
      const jobId = newId();
      const apptId = newId();
      let customerId = input.customerId || newId();
      let vehicleId = input.vehicleId || newId();

      run("Could not create the job", async () => {
        if (!input.customerId) {
          const { error } = await supabase.from("customers").insert({
            id: customerId, name: input.newCustomer.name, phone: input.newCustomer.phone || "",
            email: input.newCustomer.email || "", address: input.newCustomer.address || ""
          });
          if (error) throw error;
        }
        if (!input.vehicleId) {
          const { error } = await supabase.from("vehicles").insert({
            id: vehicleId, customer_id: customerId, year: input.newVehicle.year || null,
            make: input.newVehicle.make || "", model: input.newVehicle.model || "",
            trim: input.newVehicle.trim || "", vin: input.newVehicle.vin || "",
            plate: input.newVehicle.plate || "", color: input.newVehicle.color || "",
            mileage: input.newVehicle.mileage || 0
          });
          if (error) throw error;
        } else {
          await supabase.from("vehicles").update({ customer_id: customerId }).eq("id", vehicleId);
        }

        const { error: jobError } = await supabase.from("jobs").insert({
          id: jobId, customer_id: customerId, vehicle_id: vehicleId, appointment_id: apptId,
          concern: input.concern || "", diagnosis: input.diagnosis || "",
          status: input.status || "scheduled", approval_status: input.approvalStatus || "pending",
          technician_id: input.technicianId || null, notes: input.notes || ""
        });
        if (jobError) throw jobError;

        const { error: apptError } = await supabase.from("appointments").insert({
          id: apptId, customer_id: customerId, vehicle_id: vehicleId, job_id: jobId,
          technician_id: input.technicianId || null, title: input.concern || "",
          start_at: new Date(input.start).toISOString(), end_at: new Date(input.end).toISOString(),
          status: "scheduled"
        });
        if (apptError) throw apptError;

        if (input.lineItems && input.lineItems.length > 0) {
          const rows = input.lineItems.map((li, i) => toLineItemRow(li, "job_id", jobId, i));
          const { error } = await supabase.from("job_line_items").insert(rows);
          if (error) throw error;
        }
      });

      return { customerId, vehicleId, jobId, apptId };
    },

    // -------- invoices --------
    convertJobToInvoice(jobId) {
      const newInvoiceId = newId();
      run("Could not create invoice from job", async () => {
        const { data: job, error: jobErr } = await supabase.from("jobs").select("*").eq("id", jobId).single();
        if (jobErr || !job) throw jobErr || new Error("Job not found");
        const { data: lineItems } = await supabase.from("job_line_items").select("*").eq("job_id", jobId);
        const { data: settings, error: settingsErr } = await supabase
          .from("org_settings").select("*").eq("organization_id", job.organization_id).single();
        if (settingsErr) throw settingsErr;

        const invoiceNumber = settings.invoice_prefix + settings.next_invoice_number;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (settings.default_due_days || 15));

        const { error: invErr } = await supabase.from("invoices").insert({
          id: newInvoiceId, invoice_number: invoiceNumber, customer_id: job.customer_id,
          vehicle_id: job.vehicle_id, job_id: job.id, due_date: dueDate.toISOString(),
          discount_type: "percent", discount_value: 0, tax_rate: settings.tax_rate, status: "draft"
        });
        if (invErr) throw invErr;

        if (lineItems && lineItems.length > 0) {
          const rows = lineItems.map((li, i) => toLineItemRow({
            id: null, name: li.name, description: li.description, category: li.category, qty: li.qty,
            unitPrice: li.unit_price, laborHours: li.labor_hours, laborRate: li.labor_rate,
            discount: li.discount, taxRate: li.tax_rate
          }, "invoice_id", newInvoiceId, i));
          const { error } = await supabase.from("invoice_line_items").insert(rows);
          if (error) throw error;
        }

        await supabase.from("org_settings")
          .update({ next_invoice_number: settings.next_invoice_number + 1 })
          .eq("organization_id", job.organization_id);
      });
      return newInvoiceId;
    },
    addInvoice(data) {
      const id = newId();
      run("Could not create invoice", async () => {
        // Need the org's current numbering + defaults — read via any row
        // this user can see (RLS scopes it to their own org already).
        const { data: anyProfile } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", anyProfile.user.id).single();
        const { data: settings, error: settingsErr } = await supabase
          .from("org_settings").select("*").eq("organization_id", profile.organization_id).single();
        if (settingsErr) throw settingsErr;

        const invoiceNumber = settings.invoice_prefix + settings.next_invoice_number;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (settings.default_due_days || 15));

        const { error } = await supabase.from("invoices").insert({
          id, invoice_number: invoiceNumber, customer_id: data.customerId || null,
          vehicle_id: data.vehicleId || null, job_id: data.jobId || null,
          due_date: dueDate.toISOString(), discount_type: "percent", discount_value: 0,
          tax_rate: settings.tax_rate, status: "draft"
        });
        if (error) throw error;

        await supabase.from("org_settings")
          .update({ next_invoice_number: settings.next_invoice_number + 1 })
          .eq("organization_id", profile.organization_id);
      });
      return id;
    },
    updateInvoice(id, patch) {
      run("Could not update invoice", async () => {
        const row = {};
        if (patch.discountType !== undefined) row.discount_type = patch.discountType;
        if (patch.discountValue !== undefined) row.discount_value = patch.discountValue;
        if (patch.taxRate !== undefined) row.tax_rate = patch.taxRate;
        if (patch.status !== undefined) row.status = patch.status;
        if (patch.paymentMethod !== undefined) row.payment_method = patch.paymentMethod;
        if (patch.notes !== undefined) row.notes = patch.notes;
        if (patch.dueDate !== undefined) row.due_date = new Date(patch.dueDate).toISOString();
        if (patch.customerId !== undefined) row.customer_id = patch.customerId;
        if (patch.vehicleId !== undefined) row.vehicle_id = patch.vehicleId;

        if (patch.lineItems !== undefined) {
          await supabase.from("invoice_line_items").delete().eq("invoice_id", id);
          if (patch.lineItems.length > 0) {
            const rows = patch.lineItems.map((li, i) => toLineItemRow(li, "invoice_id", id, i));
            const { error } = await supabase.from("invoice_line_items").insert(rows);
            if (error) throw error;
          }
        }
        if (Object.keys(row).length > 0) {
          const { error } = await supabase.from("invoices").update(row).eq("id", id);
          if (error) throw error;
        }
      });
    },
    addPayment(invoiceId, payment) {
      run("Could not record payment", async () => {
        const { error: payErr } = await supabase.from("payments").insert({
          id: newId(), invoice_id: invoiceId, amount: payment.amount, method: payment.method || ""
        });
        if (payErr) throw payErr;

        const { data: invoice } = await supabase.from("invoices").select("*").eq("id", invoiceId).single();
        const { data: lineItems } = await supabase.from("invoice_line_items").select("*").eq("invoice_id", invoiceId);
        const { data: payments } = await supabase.from("payments").select("*").eq("invoice_id", invoiceId);

        const subtotal = (lineItems || []).reduce((s, li) => {
          const base = Number(li.labor_hours) > 0 ? Number(li.labor_hours) * Number(li.labor_rate) : Number(li.qty) * Number(li.unit_price);
          return s + base;
        }, 0);
        const discAmt = invoice.discount_type === "percent" ? subtotal * Number(invoice.discount_value) / 100 : Number(invoice.discount_value);
        const afterDiscount = Math.max(0, subtotal - discAmt);
        const total = afterDiscount * (1 + Number(invoice.tax_rate) / 100);
        const paid = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
        const status = total - paid <= 0.005 ? "paid" : "partially_paid";

        await supabase.from("invoices").update({ status }).eq("id", invoiceId);
      });
    },

    // -------- line item library --------
    addLibraryItem(data) {
      const id = newId();
      run("Could not save line item", async () => {
        const { error } = await supabase.from("line_item_library").insert({
          id, name: data.name || "", category: data.category || "Custom", description: data.description || "",
          unit_price: data.unitPrice || 0, labor_hours: data.laborHours || 0, labor_rate: data.laborRate || 0,
          tax_rate: data.taxRate != null ? data.taxRate : 13
        });
        if (error) throw error;
      });
      return id;
    },
    updateLibraryItem(id, patch) {
      run("Could not update line item", async () => {
        const row = {};
        if (patch.name !== undefined) row.name = patch.name;
        if (patch.category !== undefined) row.category = patch.category;
        if (patch.description !== undefined) row.description = patch.description;
        if (patch.unitPrice !== undefined) row.unit_price = patch.unitPrice;
        if (patch.laborHours !== undefined) row.labor_hours = patch.laborHours;
        if (patch.laborRate !== undefined) row.labor_rate = patch.laborRate;
        if (patch.taxRate !== undefined) row.tax_rate = patch.taxRate;
        const { error } = await supabase.from("line_item_library").update(row).eq("id", id);
        if (error) throw error;
      });
    },
    removeLibraryItem(id) {
      run("Could not remove line item", async () => {
        const { error } = await supabase.from("line_item_library").delete().eq("id", id);
        if (error) throw error;
      });
    },

    // -------- follow-ups --------
    addFollowUp(data) {
      const id = newId();
      run("Could not create follow-up", async () => {
        const { error } = await supabase.from("follow_ups").insert({
          id, type: data.type, customer_id: data.customerId || null, vehicle_id: data.vehicleId || null,
          job_id: data.jobId || null, due_date: data.dueDate ? new Date(data.dueDate).toISOString() : null,
          assigned_to: data.assignedTo || null, status: data.status || "open", notes: data.notes || ""
        });
        if (error) throw error;
      });
      return id;
    },
    updateFollowUp(id, patch) {
      run("Could not update follow-up", async () => {
        const row = {};
        if (patch.status !== undefined) row.status = patch.status;
        if (patch.notes !== undefined) row.notes = patch.notes;
        if (patch.dueDate !== undefined) row.due_date = new Date(patch.dueDate).toISOString();
        if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo;
        const { error } = await supabase.from("follow_ups").update(row).eq("id", id);
        if (error) throw error;
      });
    },
    completeFollowUp(id) {
      run("Could not update follow-up", async () => {
        const { error } = await supabase.from("follow_ups").update({ status: "done" }).eq("id", id);
        if (error) throw error;
      });
    },

    // -------- settings (owner/manager only — also enforced by RLS) --------
    updateSettings(patch) {
      run("Could not save settings", async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
        const row = {};
        const map = {
          businessName: "business_name", address: "address", phone: "phone", email: "email",
          logoText: "logo_text", logoDataUrl: "logo_data_url", hours: "hours", laborRate: "labor_rate",
          taxRate: "tax_rate", invoicePrefix: "invoice_prefix", nextInvoiceNumber: "next_invoice_number",
          defaultDueDays: "default_due_days", paymentMethods: "payment_methods",
          notifications: "notifications", customRoles: "custom_roles"
        };
        Object.entries(map).forEach(([uiKey, dbKey]) => { if (patch[uiKey] !== undefined) row[dbKey] = patch[uiKey]; });
        const { error } = await supabase.from("org_settings").update(row).eq("organization_id", profile.organization_id);
        if (error) throw error;
      });
    }
  };
}
