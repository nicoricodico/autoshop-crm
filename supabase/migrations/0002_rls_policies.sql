-- ============================================================================
-- Row Level Security — this is the file that actually enforces "John can
-- never see Sarah's shop's data," at the database level, independent of
-- anything the frontend does or fails to do.
--
-- Run this after 0001_schema.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions. SECURITY DEFINER so their internal lookup of the
-- caller's own profile row bypasses RLS (otherwise you get infinite
-- recursion: the profiles policy calling a function that re-queries
-- profiles under the same restricted policy). This is the standard,
-- Supabase-documented pattern for this exact problem.
-- ---------------------------------------------------------------------------
create or replace function auth_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_vendor_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'vendor_admin', false);
$$;

create or replace function is_owner_or_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role from profiles where id = auth.uid()) in ('owner','manager'), false);
$$;

-- ---------------------------------------------------------------------------
-- Generic trigger: no matter what organization_id the client sends on
-- INSERT, overwrite it with the caller's own org. This means "creating a
-- new record automatically associates it with the authenticated user's
-- organization rather than allowing the frontend to arbitrarily choose
-- another organization ID" is true even if a bug (or a modified frontend)
-- tried to send someone else's org id — the database corrects it.
-- ---------------------------------------------------------------------------
create or replace function force_own_org_id() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Only override organization_id for a real signed-in browser session
  -- (auth.uid() is set). The service-role/secret-key connection has no
  -- JWT user at all -- that's used only from trusted server-only code
  -- (API routes, the seed/migration scripts), which is already fully
  -- trusted with the organization_id it supplies (it bypasses RLS
  -- entirely anyway). Triggers, unlike RLS policies, are NOT bypassed by
  -- the service role, so this check is what makes admin-side inserts
  -- (seeding a shop, inviting an employee) work at all.
  if auth.uid() is not null then
    new.organization_id := auth_org_id();
    if new.organization_id is null then
      raise exception 'no organization found for the current user';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','customer_comm_log','vehicles','appointments','jobs',
    'job_line_items','invoices','invoice_line_items','payments',
    'follow_ups','line_item_library'
  ] loop
    execute format(
      'create trigger force_org_id_%1$s before insert on %1$s
       for each row execute function force_own_org_id();', t
    );
  end loop;
end $$;

-- profiles.organization_id is set once at account creation (by a
-- server-only route using the secret key, which bypasses RLS/triggers
-- naturally since it's a different code path) and is never changed again.
-- role changes are restricted to an owner/manager acting within their own
-- org, or a server-only route.
create or replace function protect_profile_columns() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id then
      raise exception 'organization_id cannot be changed once set';
    end if;
    if new.role is distinct from old.role
       and auth.role() <> 'service_role'
       and not is_owner_or_manager() then
      raise exception 'only an owner or manager can change a team member''s role';
    end if;
  end if;
  return new;
end;
$$;

create trigger protect_profile_columns_trg
  before update on profiles
  for each row execute function protect_profile_columns();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere.
-- ---------------------------------------------------------------------------
alter table organizations        enable row level security;
alter table org_settings         enable row level security;
alter table profiles             enable row level security;
alter table user_pins            enable row level security;
alter table customers            enable row level security;
alter table customer_comm_log    enable row level security;
alter table vehicles             enable row level security;
alter table appointments         enable row level security;
alter table jobs                 enable row level security;
alter table job_line_items       enable row level security;
alter table invoices             enable row level security;
alter table invoice_line_items   enable row level security;
alter table payments             enable row level security;
alter table follow_ups           enable row level security;
alter table line_item_library    enable row level security;
alter table automations          enable row level security;
alter table automation_logs      enable row level security;

-- ---------------------------------------------------------------------------
-- organizations — a shop can see only its own row. Vendor admins can see
-- every shop (for the platform "manage/view shops" screen), but that's a
-- read-only allowance: creating a shop happens only via the server-side
-- setup route with the secret key, which bypasses RLS by design, so no
-- INSERT/UPDATE/DELETE policy is defined here for anyone.
-- ---------------------------------------------------------------------------
create policy org_select_own on organizations for select
  using (id = auth_org_id() or is_vendor_admin());

-- ---------------------------------------------------------------------------
-- org_settings — shop members read their own shop's settings; only the
-- owner or a manager can change them. Vendor admins can read (platform
-- visibility) but not write shop-level settings.
-- ---------------------------------------------------------------------------
create policy org_settings_select on org_settings for select
  using (organization_id = auth_org_id() or is_vendor_admin());
create policy org_settings_update on org_settings for update
  using (organization_id = auth_org_id() and is_owner_or_manager())
  with check (organization_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- profiles — everyone can see themselves and their own org's teammates
-- (Team Management needs this). Vendor admins can see every profile
-- (platform visibility). Only an owner/manager can update a teammate's
-- row (role/status/etc, subject to protect_profile_columns above); anyone
-- can update their own contact info. No INSERT/DELETE policies exist for
-- authenticated users — account creation and removal go through
-- server-only routes using the secret key.
-- ---------------------------------------------------------------------------
create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or organization_id = auth_org_id()
    or is_vendor_admin()
  );
create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_update_by_manager on profiles for update
  using (organization_id = auth_org_id() and is_owner_or_manager())
  with check (organization_id = auth_org_id());

-- ---------------------------------------------------------------------------
-- user_pins — intentionally NO policies for anon/authenticated. RLS is
-- enabled with zero grants, so this table is completely inaccessible
-- except to the secret-key (service_role) connection used by the
-- server-only auth routes. This is where the PIN hash and lockout state
-- live, and nothing in the browser should ever be able to query it.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Shop-owned operational data — the core "Shop A can never see Shop B"
-- rule. Same four-policy shape repeated per table.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','customer_comm_log','vehicles','appointments','jobs',
    'job_line_items','invoices','invoice_line_items','payments',
    'follow_ups','line_item_library'
  ] loop
    execute format('create policy %1$s_select on %1$s for select using (organization_id = auth_org_id());', t);
    execute format('create policy %1$s_insert on %1$s for insert with check (organization_id = auth_org_id());', t);
    execute format('create policy %1$s_update on %1$s for update using (organization_id = auth_org_id()) with check (organization_id = auth_org_id());', t);
    execute format('create policy %1$s_delete on %1$s for delete using (organization_id = auth_org_id());', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- automations / automation_logs — vendor_admin only, full stop. A shop
-- owner or employee gets zero rows back, not because the page is hidden
-- from their sidebar (it isn't even part of their app bundle — see the
-- frontend routing), but because the database itself refuses the query.
-- ---------------------------------------------------------------------------
create policy automations_vendor_only_select on automations for select using (is_vendor_admin());
create policy automations_vendor_only_insert on automations for insert with check (is_vendor_admin());
create policy automations_vendor_only_update on automations for update using (is_vendor_admin()) with check (is_vendor_admin());
create policy automations_vendor_only_delete on automations for delete using (is_vendor_admin());

create policy automation_logs_vendor_only_select on automation_logs for select using (is_vendor_admin());
create policy automation_logs_vendor_only_insert on automation_logs for insert with check (is_vendor_admin());
