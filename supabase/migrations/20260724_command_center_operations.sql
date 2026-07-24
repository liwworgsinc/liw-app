-- LIW Command Center operations upgrade
-- Adds secure portal messaging plus atomic staff functions for invoices and appointments.

create table if not exists public.portal_messages (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.service_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('staff_to_customer','customer_to_staff')),
  subject text not null default 'Message from LIW Worgs Inc.',
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists portal_messages_user_id_idx on public.portal_messages(user_id);
create index if not exists portal_messages_request_id_idx on public.portal_messages(request_id);
create index if not exists portal_messages_created_at_idx on public.portal_messages(created_at desc);
alter table public.portal_messages enable row level security;

create policy "Customers view own portal messages" on public.portal_messages for select to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()));

create policy "Staff send portal messages" on public.portal_messages for insert to authenticated
with check (
  ((select private.is_staff()) and sender_id = (select auth.uid()) and direction = 'staff_to_customer')
  or
  (sender_id = (select auth.uid()) and user_id = (select auth.uid()) and direction = 'customer_to_staff'
    and (request_id is null or exists (select 1 from public.service_requests r where r.id = request_id and r.user_id = (select auth.uid()))))
);

create policy "Users mark own portal messages read" on public.portal_messages for update to authenticated
using ((select auth.uid()) = user_id or (select private.is_staff()))
with check ((select auth.uid()) = user_id or (select private.is_staff()));

grant select, insert on public.portal_messages to authenticated;
grant update (read_at, updated_at) on public.portal_messages to authenticated;

create trigger portal_messages_updated_at before update on public.portal_messages
for each row execute function private.set_updated_at();

create or replace function public.create_invoice_for_request(
  p_request_id uuid, p_due_date date, p_notes text, p_items jsonb,
  p_discount_cents integer default 0, p_tax_cents integer default 0
)
returns table(invoice_id uuid, invoice_number bigint)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid; v_invoice_id uuid; v_invoice_number bigint;
  v_subtotal integer := 0; v_total integer := 0; v_item jsonb;
  v_description text; v_quantity numeric(10,2); v_unit_price integer; v_line_total integer;
begin
  if not (select private.is_staff()) then raise exception 'Staff access required.'; end if;
  select user_id into v_user_id from public.service_requests where id = p_request_id;
  if v_user_id is null then raise exception 'Service request not found.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one invoice item is required.'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_description := trim(coalesce(v_item ->> 'description', ''));
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price_cents', '')::integer, 0);
    if v_description = '' or v_quantity <= 0 or v_unit_price < 0 then raise exception 'Invalid invoice item.'; end if;
    v_subtotal := v_subtotal + round(v_quantity * v_unit_price)::integer;
  end loop;
  v_total := greatest(v_subtotal - greatest(coalesce(p_discount_cents, 0), 0) + greatest(coalesce(p_tax_cents, 0), 0), 0);
  insert into public.invoices (request_id,user_id,status,subtotal_cents,discount_cents,tax_cents,total_cents,due_date,notes)
  values (p_request_id,v_user_id,'sent',v_subtotal,greatest(coalesce(p_discount_cents,0),0),greatest(coalesce(p_tax_cents,0),0),v_total,p_due_date,nullif(trim(coalesce(p_notes,'')),''))
  returning id, invoices.invoice_number into v_invoice_id, v_invoice_number;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_description := trim(v_item ->> 'description');
    v_quantity := coalesce(nullif(v_item ->> 'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_item ->> 'unit_price_cents', '')::integer, 0);
    v_line_total := round(v_quantity * v_unit_price)::integer;
    insert into public.invoice_items (invoice_id,description,quantity,unit_price_cents,line_total_cents)
    values (v_invoice_id,v_description,v_quantity,v_unit_price,v_line_total);
  end loop;
  update public.service_requests set status='payment_due',updated_at=now() where id=p_request_id and status not in ('completed','closed');
  insert into public.activity_logs (actor_id,request_id,action,metadata)
  values ((select auth.uid()),p_request_id,'invoice_created',jsonb_build_object('invoice_id',v_invoice_id,'total_cents',v_total));
  return query select v_invoice_id, v_invoice_number;
end;
$$;

revoke all on function public.create_invoice_for_request(uuid,date,text,jsonb,integer,integer) from public, anon;
grant execute on function public.create_invoice_for_request(uuid,date,text,jsonb,integer,integer) to authenticated;

create or replace function public.schedule_request_appointment(
  p_request_id uuid, p_starts_at timestamptz, p_ends_at timestamptz,
  p_appointment_type text, p_location text, p_notes text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user_id uuid; v_appointment_id uuid;
begin
  if not (select private.is_staff()) then raise exception 'Staff access required.'; end if;
  if p_ends_at <= p_starts_at then raise exception 'Appointment end time must be after the start time.'; end if;
  if p_appointment_type not in ('phone','video','in_person') then raise exception 'Invalid appointment type.'; end if;
  select user_id into v_user_id from public.service_requests where id=p_request_id;
  if v_user_id is null then raise exception 'Service request not found.'; end if;
  insert into public.appointments (request_id,user_id,starts_at,ends_at,appointment_type,location,notes,status)
  values (p_request_id,v_user_id,p_starts_at,p_ends_at,p_appointment_type,nullif(trim(coalesce(p_location,'')),''),nullif(trim(coalesce(p_notes,'')),''),'scheduled')
  returning id into v_appointment_id;
  update public.service_requests set status='appointment_scheduled',updated_at=now() where id=p_request_id and status not in ('completed','closed');
  insert into public.activity_logs (actor_id,request_id,action,metadata)
  values ((select auth.uid()),p_request_id,'appointment_scheduled',jsonb_build_object('appointment_id',v_appointment_id,'starts_at',p_starts_at));
  return v_appointment_id;
end;
$$;

revoke all on function public.schedule_request_appointment(uuid,timestamptz,timestamptz,text,text,text) from public, anon;
grant execute on function public.schedule_request_appointment(uuid,timestamptz,timestamptz,text,text,text) to authenticated;
