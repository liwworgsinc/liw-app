-- LIW Worgs Inc. Platform - Initial schema
-- Supabase/Postgres 17

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.service_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  short_description text not null,
  icon text not null default 'briefcase',
  intake_fields jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  company_name text,
  preferred_contact text not null default 'email' check (preferred_contact in ('email','phone','text')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','staff','admin','owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  request_number bigint generated always as identity unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  service_id uuid not null references public.service_catalog(id),
  subject text not null,
  details jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check (status in ('draft','submitted','contacted','documents_needed','appointment_scheduled','payment_due','in_progress','completed','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.request_notes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  note text not null,
  visible_to_customer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests(id) on delete cascade,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','in_progress','done','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  appointment_type text not null default 'phone' check (appointment_type in ('phone','video','in_person')),
  location text,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_valid_time check (ends_at > starts_at)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number bigint generated always as identity unique,
  request_id uuid references public.service_requests(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','sent','partial','paid','overdue','void')),
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),
  due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  line_total_cents integer not null default 0 check (line_total_cents >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  method text not null default 'card' check (method in ('card','cash','check','zelle','paypal','other')),
  status text not null default 'pending' check (status in ('pending','succeeded','failed','refunded')),
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  category text not null default 'general',
  status text not null default 'uploaded' check (status in ('uploaded','reviewed','accepted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  request_id uuid references public.service_requests(id) on delete cascade,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index service_requests_user_id_idx on public.service_requests(user_id);
create index service_requests_service_id_idx on public.service_requests(service_id);
create index service_requests_status_idx on public.service_requests(status);
create index service_requests_assigned_to_idx on public.service_requests(assigned_to);
create index request_notes_request_id_idx on public.request_notes(request_id);
create index tasks_assigned_to_idx on public.tasks(assigned_to);
create index appointments_user_id_idx on public.appointments(user_id);
create index invoices_user_id_idx on public.invoices(user_id);
create index invoice_items_invoice_id_idx on public.invoice_items(invoice_id);
create index payments_invoice_id_idx on public.payments(invoice_id);
create index documents_user_id_idx on public.documents(user_id);
create index documents_request_id_idx on public.documents(request_id);

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.user_roles
      where user_id = (select auth.uid())
        and role in ('staff','admin','owner')
    ),
    false
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.user_roles
      where user_id = (select auth.uid())
        and role in ('admin','owner')
    ),
    false
  );
$$;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_staff() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (
    new.id,
    case
      when lower(coalesce(new.email, '')) = 'liwworgsinc@gmail.com' then 'owner'
      else 'customer'
    end
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Backfill profiles/roles if auth users already exist.
insert into public.profiles (id, email, full_name, phone)
select
  id,
  email,
  nullif(trim(coalesce(raw_user_meta_data ->> 'full_name', '')), ''),
  nullif(trim(coalesce(raw_user_meta_data ->> 'phone', '')), '')
from auth.users
on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
select
  id,
  case when lower(coalesce(email, '')) = 'liwworgsinc@gmail.com' then 'owner' else 'customer' end
from auth.users
on conflict (user_id) do nothing;

create or replace function private.protect_service_request_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not (select private.is_staff()) then
    if new.user_id is distinct from old.user_id
       or new.request_number is distinct from old.request_number
       or new.status is distinct from old.status
       or new.priority is distinct from old.priority
       or new.assigned_to is distinct from old.assigned_to
       or new.created_at is distinct from old.created_at then
      raise exception 'You cannot change protected service request fields.';
    end if;
  end if;
  return new;
end;
$$;

create trigger service_catalog_updated_at before update on public.service_catalog
for each row execute function private.set_updated_at();
create trigger profiles_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger user_roles_updated_at before update on public.user_roles
for each row execute function private.set_updated_at();
create trigger service_requests_protect before update on public.service_requests
for each row execute function private.protect_service_request_fields();
create trigger service_requests_updated_at before update on public.service_requests
for each row execute function private.set_updated_at();
create trigger request_notes_updated_at before update on public.request_notes
for each row execute function private.set_updated_at();
create trigger tasks_updated_at before update on public.tasks
for each row execute function private.set_updated_at();
create trigger appointments_updated_at before update on public.appointments
for each row execute function private.set_updated_at();
create trigger invoices_updated_at before update on public.invoices
for each row execute function private.set_updated_at();
create trigger documents_updated_at before update on public.documents
for each row execute function private.set_updated_at();

alter table public.service_catalog enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.service_requests enable row level security;
alter table public.request_notes enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.activity_logs enable row level security;

create policy "Public can view active services"
on public.service_catalog for select
to anon
using (is_active);

create policy "Authenticated users can view services"
on public.service_catalog for select
to authenticated
using (is_active or (select private.is_staff()));

create policy "Staff manage services"
on public.service_catalog for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Users view own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id or (select private.is_staff()));

create policy "Users update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id or (select private.is_staff()))
with check ((select auth.uid()) = id or (select private.is_staff()));

create policy "Users view own role"
on public.user_roles for select
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Admins manage roles"
on public.user_roles for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "Customers view own requests"
on public.service_requests for select
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Customers create own requests"
on public.service_requests for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Customers update own requests"
on public.service_requests for update
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()))
with check ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Staff delete requests"
on public.service_requests for delete
to authenticated
using ((select private.is_staff()));

create policy "Customers view visible notes"
on public.request_notes for select
to authenticated
using (
  (select private.is_staff())
  or (
    visible_to_customer
    and exists (
      select 1 from public.service_requests r
      where r.id = request_id and r.user_id = (select auth.uid())
    )
  )
);

create policy "Staff manage notes"
on public.request_notes for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()) and author_id = (select auth.uid()));

create policy "Staff manage tasks"
on public.tasks for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Customers view own appointments"
on public.appointments for select
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Customers create own appointments"
on public.appointments for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Customers update own appointments"
on public.appointments for update
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()))
with check ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Customers delete own appointments"
on public.appointments for delete
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Customers view own invoices"
on public.invoices for select
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Staff manage invoices"
on public.invoices for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Customers view own invoice items"
on public.invoice_items for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1 from public.invoices i
    where i.id = invoice_id and i.user_id = (select auth.uid())
  )
);

create policy "Staff manage invoice items"
on public.invoice_items for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Customers view own payments"
on public.payments for select
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Staff manage payments"
on public.payments for all
to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy "Customers view own documents"
on public.documents for select
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Customers add own documents"
on public.documents for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Customers update own documents"
on public.documents for update
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()))
with check ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Customers delete own documents"
on public.documents for delete
to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Staff view activity logs"
on public.activity_logs for select
to authenticated
using ((select private.is_staff()));

create policy "Staff add activity logs"
on public.activity_logs for insert
to authenticated
with check ((select private.is_staff()));

-- Explicit Data API grants for projects that do not expose SQL-created tables by default.
grant usage on schema public to anon, authenticated;
grant select on public.service_catalog to anon, authenticated;
grant select on public.profiles, public.user_roles to authenticated;
grant update (full_name, phone, company_name, preferred_contact, updated_at) on public.profiles to authenticated;
grant select, insert, update, delete on public.service_requests to authenticated;
grant select, insert, update, delete on public.request_notes to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert on public.activity_logs to authenticated;
grant update, insert, delete on public.service_catalog, public.user_roles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'liw-documents',
  'liw-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users read own stored documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'liw-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_staff())
  )
);

create policy "Users upload own stored documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'liw-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users replace own stored documents"
on storage.objects for update
to authenticated
using (
  bucket_id = 'liw-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_staff())
  )
)
with check (
  bucket_id = 'liw-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_staff())
  )
);

create policy "Users delete own stored documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'liw-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_staff())
  )
);

insert into public.service_catalog (code, name, short_description, icon, sort_order, intake_fields)
values
  ('real-estate', 'Real Estate', 'Residential and commercial sales, rentals, and property guidance.', 'building', 10,
   '[{"key":"goal","label":"What do you need?","type":"select","options":["Buy","Sell","Rent residential","Rent commercial"]},{"key":"location","label":"Preferred area","type":"text"},{"key":"budget","label":"Budget or price range","type":"text"},{"key":"move_date","label":"Target move or closing date","type":"date"}]'::jsonb),
  ('property-management', 'Property Management', 'Tenant coordination, maintenance requests, rent support, and owner reporting.', 'home', 20,
   '[{"key":"property_type","label":"Property type","type":"select","options":["Single family","Multi-family","Commercial","Mixed use"]},{"key":"units","label":"Number of units","type":"number"},{"key":"address","label":"Property address","type":"text"},{"key":"help_needed","label":"What help do you need?","type":"textarea"}]'::jsonb),
  ('tax-preparation', 'Tax Preparation', 'Organized intake and document collection for individual and business tax services.', 'calculator', 30,
   '[{"key":"tax_year","label":"Tax year","type":"text"},{"key":"filing_type","label":"Filing type","type":"select","options":["Individual","Married filing jointly","Self-employed","Business"]},{"key":"dependents","label":"Number of dependents","type":"number"},{"key":"notes","label":"Anything we should know?","type":"textarea"}]'::jsonb),
  ('credit-solutions', 'Credit Solutions', 'Credit education, report review, and organized client support.', 'chart', 40,
   '[{"key":"goal","label":"Primary credit goal","type":"textarea"},{"key":"score_range","label":"Estimated score range","type":"select","options":["Below 500","500-579","580-669","670-739","740+"]},{"key":"report_access","label":"Do you have current credit reports?","type":"select","options":["Yes","No"]}]'::jsonb),
  ('business-loans', 'Business Funding', 'Business funding intake and preparation support for qualified applicants.', 'wallet', 50,
   '[{"key":"business_name","label":"Business name","type":"text"},{"key":"years_in_business","label":"Years in business","type":"number"},{"key":"monthly_revenue","label":"Average monthly revenue","type":"text"},{"key":"funding_amount","label":"Requested funding amount","type":"text"}]'::jsonb),
  ('business-advertising', 'Business Advertising', 'TV, radio, social media, print, branding, and promotional solutions.', 'megaphone', 60,
   '[{"key":"project_type","label":"What do you need?","type":"select","options":["Logo","Flyer","Banner","Social media content","TV or radio advertising","Marketing package"]},{"key":"deadline","label":"Desired deadline","type":"date"},{"key":"brand_colors","label":"Brand colors","type":"text"},{"key":"project_details","label":"Project details","type":"textarea"}]'::jsonb),
  ('web-design', 'Web Design', 'Modern mobile-friendly websites and connected business web applications.', 'globe', 70,
   '[{"key":"website_type","label":"Website type","type":"select","options":["Service website","Online store","Booking site","Customer portal","Custom web app"]},{"key":"existing_domain","label":"Existing domain or website","type":"text"},{"key":"features","label":"Required features","type":"textarea"},{"key":"deadline","label":"Desired launch date","type":"date"}]'::jsonb),
  ('eyeglasses-repair', 'Eyeglasses Repair', 'Frame repair intake, photo upload, drop-off, and mail-in coordination.', 'glasses', 80,
   '[{"key":"frame_brand","label":"Frame brand","type":"text"},{"key":"damage_type","label":"Type of damage","type":"select","options":["Broken hinge","Broken temple","Bridge repair","Lens issue","Adjustment","Other"]},{"key":"service_method","label":"Service method","type":"select","options":["Drop off","Mail in","Mobile appointment"]},{"key":"repair_details","label":"Describe the damage","type":"textarea"}]'::jsonb),
  ('digital-business-cards', 'Digital Business Cards', 'Mobile digital cards, QR sharing, and NFC-ready business profiles.', 'contact', 90,
   '[{"key":"business_name","label":"Business name","type":"text"},{"key":"industry","label":"Industry","type":"text"},{"key":"social_links","label":"Social media links","type":"textarea"},{"key":"design_notes","label":"Design preferences","type":"textarea"}]'::jsonb)
on conflict (code) do update
set name = excluded.name,
    short_description = excluded.short_description,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    intake_fields = excluded.intake_fields,
    is_active = true,
    updated_at = now();
