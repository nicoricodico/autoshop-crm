-- ============================================================================
-- Vamp Auto Shop Manager — multi-tenant schema
-- Run this in the Supabase SQL Editor (or via `supabase db push`) on a fresh
-- project, before 0002_rls_policies.sql.
--
-- Design notes:
--   * Every shop-owned row carries organization_id. Nothing is inferred by
--     the frontend — see 0002 for the triggers that force it server-side.
--   * Line items are normalized into their own tables (job_line_items,
--     invoice_line_items) rather than embedded JSON, per the requested
--     relational structure — the app's data layer re-assembles them into
--     the same "lineItems: [...]" array shape the existing UI expects, so
--     no UI component needs to know the storage changed.
--   * "profiles" is the one row-per-human table (owner, employees, and
--     vendor/platform admins all live here). A vendor_admin profile has
--     organization_id = NULL — they aren't a member of any shop.
-- ============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- organizations — one row per mechanic shop (tenant)
-- ---------------------------------------------------------------------------
create table organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique, -- what the owner types on the login screen ("abc-auto-repair")
  created_at   timestamptz not null default now()
);
comment on table organizations is 'One row per mechanic shop / tenant.';

-- Shop-specific configuration that used to live in data.js's "settings"
-- object. One row per organization. Anything here is editable by the shop
-- owner from Settings and never affects any other shop.
create table org_settings (
  organization_id     uuid primary key references organizations(id) on delete cascade,
  business_name       text not null default '',
  address             text not null default '',
  phone               text not null default '',
  email               text not null default '',
  logo_text           text not null default '',
  logo_data_url       text not null default '',
  hours               jsonb not null default '{}'::jsonb,
  labor_rate          numeric(10,2) not null default 0,
  tax_rate            numeric(5,2) not null default 0,
  invoice_prefix      text not null default 'INV-',
  next_invoice_number int not null default 1000,
  default_due_days    int not null default 15,
  payment_methods     text[] not null default '{}',
  notifications       jsonb not null default '{}'::jsonb,
  custom_roles        text[] not null default '{}',
  updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles — one row per human (owner, employee, or vendor/platform admin).
-- id matches the corresponding auth.users id 1:1.
-- ---------------------------------------------------------------------------
create table profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  organization_id  uuid references organizations(id) on delete cascade,
  name             text not null,
  email            text not null,
  phone            text not null default '',
  role             text not null check (role in (
                     'owner', 'manager', 'service_advisor', 'technician',
                     'apprentice', 'receptionist', 'vendor_admin'
                   )),
  status           text not null default 'active' check (status in ('active','on_job','break','off_today','inactive')),
  color            text not null default 'var(--tech-1)',
  work_days        int[] not null default '{1,2,3,4,5}',
  start_hour       int not null default 8,
  end_hour         int not null default 17,
  created_at       timestamptz not null default now(),
  -- A vendor_admin belongs to no shop; every other role must belong to one.
  constraint profiles_org_matches_role check (
    (role = 'vendor_admin' and organization_id is null) or
    (role <> 'vendor_admin' and organization_id is not null)
  )
);
create index profiles_org_idx on profiles(organization_id);
comment on table profiles is 'One row per human: shop owners/employees (organization_id set) or vendor/platform admins (organization_id null).';

-- The 6-digit quick-access PIN, stored as a salted hash — never plaintext,
-- never exposed to the anon/authenticated Postgres roles (see 0002). Only
-- server-only routes using the Supabase secret key touch this table.
create table user_pins (
  user_id        uuid primary key references profiles(id) on delete cascade,
  pin_hash       text not null,
  failed_attempts int not null default 0,
  locked_until   timestamptz,
  updated_at     timestamptz not null default now()
);
comment on table user_pins is 'Hashed 6-digit PIN + lockout state. Never readable via the anon/authenticated Postgres roles — server routes only, via the secret key.';

-- ---------------------------------------------------------------------------
-- Shop-owned CRM data. Every table below carries organization_id.
-- ---------------------------------------------------------------------------

create table customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  phone            text not null default '',
  email            text not null default '',
  address          text not null default '',
  notes            text not null default '',
  created_at       timestamptz not null default now()
);
create index customers_org_idx on customers(organization_id);

create table customer_comm_log (
  id           uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  customer_id  uuid not null references customers(id) on delete cascade,
  text         text not null,
  logged_at    timestamptz not null default now()
);
create index comm_log_org_idx on customer_comm_log(organization_id);
create index comm_log_customer_idx on customer_comm_log(customer_id);

create table vehicles (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  customer_id      uuid not null references customers(id) on delete cascade,
  year             int,
  make             text not null default '',
  model            text not null default '',
  trim             text not null default '',
  vin              text not null default '',
  plate            text not null default '',
  color            text not null default '',
  mileage          int not null default 0
);
create index vehicles_org_idx on vehicles(organization_id);
create index vehicles_customer_idx on vehicles(customer_id);

create table appointments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  customer_id      uuid references customers(id) on delete set null,
  vehicle_id       uuid references vehicles(id) on delete set null,
  job_id           uuid, -- FK added after jobs exists (circular ref)
  technician_id    uuid references profiles(id) on delete set null,
  title            text not null default '',
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  status           text not null default 'scheduled' check (status in ('scheduled','completed','cancelled'))
);
create index appts_org_idx on appointments(organization_id);
create index appts_start_idx on appointments(organization_id, start_at);

create table jobs (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  customer_id      uuid references customers(id) on delete set null,
  vehicle_id       uuid references vehicles(id) on delete set null,
  appointment_id   uuid references appointments(id) on delete set null,
  concern          text not null default '',
  diagnosis        text not null default '',
  status           text not null default 'scheduled' check (status in (
                     'scheduled','in_progress','waiting_approval','waiting_parts',
                     'ready_pickup','completed','cancelled'
                   )),
  approval_status  text not null default 'pending' check (approval_status in ('pending','approved','declined')),
  technician_id    uuid references profiles(id) on delete set null,
  notes            text not null default '',
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index jobs_org_idx on jobs(organization_id);

alter table appointments
  add constraint appointments_job_fk foreign key (job_id) references jobs(id) on delete set null;

create table job_line_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  job_id           uuid not null references jobs(id) on delete cascade,
  name             text not null default '',
  description      text not null default '',
  category         text not null default 'Custom',
  qty              numeric(10,2) not null default 1,
  unit_price       numeric(10,2) not null default 0,
  labor_hours      numeric(10,2) not null default 0,
  labor_rate       numeric(10,2) not null default 0,
  discount         numeric(10,2) not null default 0,
  tax_rate         numeric(5,2) not null default 0,
  sort_order       int not null default 0
);
create index job_line_items_org_idx on job_line_items(organization_id);
create index job_line_items_job_idx on job_line_items(job_id);

create table invoices (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  invoice_number    text not null,
  customer_id       uuid references customers(id) on delete set null,
  vehicle_id        uuid references vehicles(id) on delete set null,
  job_id            uuid references jobs(id) on delete set null,
  invoice_date      timestamptz not null default now(),
  due_date          timestamptz,
  discount_type     text not null default 'percent' check (discount_type in ('percent','flat')),
  discount_value    numeric(10,2) not null default 0,
  tax_rate          numeric(5,2) not null default 0,
  status            text not null default 'draft' check (status in ('draft','sent','partially_paid','paid','overdue','cancelled')),
  payment_method    text not null default '',
  notes             text not null default '',
  created_at        timestamptz not null default now(),
  unique (organization_id, invoice_number)
);
create index invoices_org_idx on invoices(organization_id);

create table invoice_line_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  invoice_id       uuid not null references invoices(id) on delete cascade,
  name             text not null default '',
  description      text not null default '',
  category         text not null default 'Custom',
  qty              numeric(10,2) not null default 1,
  unit_price       numeric(10,2) not null default 0,
  labor_hours      numeric(10,2) not null default 0,
  labor_rate       numeric(10,2) not null default 0,
  discount         numeric(10,2) not null default 0,
  tax_rate         numeric(5,2) not null default 0,
  sort_order       int not null default 0
);
create index invoice_line_items_org_idx on invoice_line_items(organization_id);
create index invoice_line_items_invoice_idx on invoice_line_items(invoice_id);

create table payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  invoice_id       uuid not null references invoices(id) on delete cascade,
  amount           numeric(10,2) not null,
  method           text not null default '',
  paid_at          timestamptz not null default now()
);
create index payments_org_idx on payments(organization_id);
create index payments_invoice_idx on payments(invoice_id);

create table follow_ups (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  type             text not null check (type in (
                     'declined_repair','recommended_service','maintenance_reminder',
                     'no_return','appointment_followup','unpaid_invoice','callback'
                   )),
  customer_id      uuid references customers(id) on delete cascade,
  vehicle_id       uuid references vehicles(id) on delete set null,
  job_id           uuid references jobs(id) on delete set null,
  due_date         timestamptz,
  assigned_to      uuid references profiles(id) on delete set null,
  status           text not null default 'open' check (status in ('open','done')),
  notes            text not null default '',
  created_at       timestamptz not null default now()
);
create index follow_ups_org_idx on follow_ups(organization_id);

create table line_item_library (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  name             text not null,
  category         text not null default 'Custom',
  description      text not null default '',
  unit_price       numeric(10,2) not null default 0,
  labor_hours      numeric(10,2) not null default 0,
  labor_rate       numeric(10,2) not null default 0,
  tax_rate         numeric(5,2) not null default 0
);
create index line_item_library_org_idx on line_item_library(organization_id);

-- ---------------------------------------------------------------------------
-- Automations — configured per shop, but only ever managed by a vendor_admin
-- through the separate Vendor/Automation Admin area (see 0002 for the RLS
-- that makes this vendor-only rather than hidden-by-navigation-only).
-- ---------------------------------------------------------------------------
create table automations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  key              text not null,
  name             text not null,
  category         text not null,
  description      text not null default '',
  trigger_text     text not null default '',
  delay_value      int not null default 0,
  delay_unit       text not null default 'days' check (delay_unit in ('hours','days')),
  channel          text not null default 'sms' check (channel in ('sms','email','both')),
  enabled          boolean not null default false,
  template         text not null default '',
  created_by       uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (organization_id, key)
);
create index automations_org_idx on automations(organization_id);

create table automation_logs (
  id             uuid primary key default gen_random_uuid(),
  automation_id  uuid not null references automations(id) on delete cascade,
  sent_at        timestamptz not null default now(),
  recipient_count int not null default 0,
  status         text not null default 'sent'
);
create index automation_logs_automation_idx on automation_logs(automation_id);
