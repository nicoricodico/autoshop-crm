"use client";
/* ==========================================================================
   Vendor/Automation Admin data layer.
   ==========================================================================
   The original prototype's "Vamp Ops Console" was a single hidden page
   operating on one shop's `db.automations` array, unlocked by typing
   "vampadmin" into the app (see the old app.js keystroke listener — not
   ported). That hack is gone. In its place: a real `role = 'vendor_admin'`
   account, checked on the server (RLS policies on `automations` /
   `automation_logs` require `is_vendor_admin()`, and the route itself is
   guarded — see app/vendor-admin/page.jsx), which can see every
   organization's automations, not just one shop's.

   Automations are still stored per-organization (organization_id column,
   see 0001_schema.sql) — "Automation → Organization → Trigger → Action" —
   so a vendor admin operating this console picks which shop's automations
   they're viewing/editing via an organization selector at the top of the
   page. Nothing here is reachable by a normal shop user: RLS blocks it
   even if they somehow loaded this code.
   ========================================================================== */
import React from "react";
import { createClient } from "@/lib/supabase/client";

function mapAutomation(row, logs) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    key: row.key,
    name: row.name,
    category: row.category,
    description: row.description,
    trigger: row.trigger_text,
    delayValue: row.delay_value,
    delayUnit: row.delay_unit,
    channel: row.channel,
    enabled: row.enabled,
    template: row.template,
    log: (logs || []).map(l => ({ date: new Date(l.sent_at), count: l.recipient_count })),
  };
}

async function fetchOrganizations(supabase) {
  const { data, error } = await supabase.from("organizations").select("id, name, slug").order("name");
  if (error) throw error;
  return data || [];
}

async function fetchAutomationsForOrg(supabase, organizationId) {
  if (!organizationId) return [];
  const { data: autos, error } = await supabase
    .from("automations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("category");
  if (error) throw error;
  const ids = (autos || []).map(a => a.id);
  let logsByAuto = {};
  if (ids.length > 0) {
    const { data: logs, error: logErr } = await supabase
      .from("automation_logs")
      .select("*")
      .in("automation_id", ids);
    if (logErr) throw logErr;
    logsByAuto = (logs || []).reduce((acc, l) => {
      (acc[l.automation_id] = acc[l.automation_id] || []).push(l);
      return acc;
    }, {});
  }
  return (autos || []).map(row => mapAutomation(row, logsByAuto[row.id]));
}

export function useVendorAutomations() {
  const supabase = React.useMemo(() => createClient(), []);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [organizations, setOrganizations] = React.useState([]);
  const [selectedOrgId, setSelectedOrgId] = React.useState(null);
  const [automations, setAutomations] = React.useState([]);

  const loadOrgs = React.useCallback(async () => {
    const orgs = await fetchOrganizations(supabase);
    setOrganizations(orgs);
    setSelectedOrgId(prev => prev || (orgs[0] && orgs[0].id) || null);
    return orgs;
  }, [supabase]);

  const loadAutomations = React.useCallback(async (orgId) => {
    const rows = await fetchAutomationsForOrg(supabase, orgId);
    setAutomations(rows);
  }, [supabase]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const orgs = await loadOrgs();
        const firstOrg = (orgs[0] && orgs[0].id) || null;
        if (!cancelled) await loadAutomations(firstOrg);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!selectedOrgId) return;
    loadAutomations(selectedOrgId).catch(e => setError(e));
  }, [selectedOrgId, loadAutomations]);

  function refetch() {
    return loadAutomations(selectedOrgId).catch(e => setError(e));
  }

  const actions = React.useMemo(() => ({
    async addAutomation(form) {
      const key = (form.name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_");
      const { error: insErr } = await supabase.from("automations").insert({
        organization_id: selectedOrgId,
        key,
        name: form.name,
        category: form.category,
        description: form.description || "",
        trigger_text: form.trigger || "",
        delay_value: form.delayValue || 0,
        delay_unit: form.delayUnit || "days",
        channel: form.channel || "sms",
        enabled: !!form.enabled,
        template: form.template || "",
      });
      if (insErr) throw insErr;
      await refetch();
    },
    async updateAutomation(id, patch) {
      const row = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.category !== undefined) row.category = patch.category;
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.trigger !== undefined) row.trigger_text = patch.trigger;
      if (patch.delayValue !== undefined) row.delay_value = patch.delayValue;
      if (patch.delayUnit !== undefined) row.delay_unit = patch.delayUnit;
      if (patch.channel !== undefined) row.channel = patch.channel;
      if (patch.enabled !== undefined) row.enabled = patch.enabled;
      if (patch.template !== undefined) row.template = patch.template;
      const { error: updErr } = await supabase.from("automations").update(row).eq("id", id);
      if (updErr) throw updErr;
      await refetch();
    },
    async removeAutomation(id) {
      const { error: delErr } = await supabase.from("automations").delete().eq("id", id);
      if (delErr) throw delErr;
      await refetch();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [supabase, selectedOrgId]);

  return { loading, error, organizations, selectedOrgId, setSelectedOrgId, automations, actions, refetch, supabase };
}
