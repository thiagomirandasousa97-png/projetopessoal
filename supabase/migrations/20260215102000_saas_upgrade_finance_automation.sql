-- SaaS upgrade: finance accounts, automation history, client/professional enrichments,
-- and smarter appointment lifecycle with reschedule history.

create extension if not exists pgcrypto;

-- 1) Advanced financial accounts
create table if not exists public.financial_accounts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('payable', 'receivable')),
  amount numeric(10,2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  client_id uuid references public.clients(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.financial_accounts enable row level security;

drop policy if exists admins_all_financial_accounts on public.financial_accounts;
create policy admins_all_financial_accounts
on public.financial_accounts
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 2) Message history for automations
create table if not exists public.message_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('reminder', 'birthday', 'overdue')),
  sent_at timestamptz not null default now(),
  status text not null default 'sent'
);

alter table public.message_history enable row level security;

drop policy if exists admins_all_message_history on public.message_history;
create policy admins_all_message_history
on public.message_history
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- 3) Client table updates
alter table public.clients
  add column if not exists allow_whatsapp boolean not null default true,
  add column if not exists birthday date;

-- Backfill birthday from previous field when available.
update public.clients
set birthday = coalesce(birthday, birth_date)
where birth_date is not null;

-- 4) Professionals table updates
alter table public.professionals
  add column if not exists commission_percentage numeric(5,2) not null default 0,
  add column if not exists specialty text;

-- Keep legacy specialties array in sync when specialty exists.
update public.professionals
set specialties = case
  when specialty is not null and specialty <> '' then array[specialty]
  else specialties
end;

-- 5) Appointments statuses and reschedule history
alter table public.appointments
  drop constraint if exists appointments_status_check;

alter table public.appointments
  add constraint appointments_status_check
  check (status in ('scheduled', 'confirmed', 'rescheduled', 'cancelled', 'completed', 'no_show'));

create table if not exists public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  old_start_time timestamptz not null,
  new_start_time timestamptz not null,
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  reason text
);

alter table public.appointment_history enable row level security;

drop policy if exists admins_all_appointment_history on public.appointment_history;
create policy admins_all_appointment_history
on public.appointment_history
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists professionals_read_own_appointment_history on public.appointment_history;
create policy professionals_read_own_appointment_history
on public.appointment_history
for select
to authenticated
using (
  exists (
    select 1
    from public.appointments a
    join public.professionals p on p.id = a.professional_id
    where a.id = appointment_history.appointment_id
      and p.user_id = auth.uid()
  )
);
