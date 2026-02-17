-- Reliability improvements: persist cash withdrawals in DB and enable safer appointment history writes.

create table if not exists public.financial_cash_withdrawals (
  id uuid primary key default gen_random_uuid(),
  amount numeric(10,2) not null check (amount > 0),
  reason text not null,
  made_by text not null,
  created_at timestamptz not null default now()
);

alter table public.financial_cash_withdrawals enable row level security;

drop policy if exists admins_all_financial_cash_withdrawals on public.financial_cash_withdrawals;
create policy admins_all_financial_cash_withdrawals
on public.financial_cash_withdrawals
for all
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists professionals_read_financial_cash_withdrawals on public.financial_cash_withdrawals;
create policy professionals_read_financial_cash_withdrawals
on public.financial_cash_withdrawals
for select
to authenticated
using (
  exists (
    select 1 from public.professionals p
    where p.user_id = auth.uid() and p.active = true
  )
);

-- Allow authenticated users to insert appointment history for appointments they can update.
drop policy if exists professionals_insert_own_appointment_history on public.appointment_history;
create policy professionals_insert_own_appointment_history
on public.appointment_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.appointments a
    join public.professionals p on p.id = a.professional_id
    where a.id = appointment_history.appointment_id
      and p.user_id = auth.uid()
  )
  or public.has_role(auth.uid(), 'admin')
);
