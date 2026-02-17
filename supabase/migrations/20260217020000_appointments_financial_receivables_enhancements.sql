alter table public.appointments
  add column if not exists attendance_confirmed boolean not null default false,
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_payment_status_check;

alter table public.appointments
  add constraint appointments_payment_status_check
  check (payment_status in ('unpaid', 'paid', 'open_account'));

alter table public.financial_receivables
  add column if not exists client_name text,
  add column if not exists service_name text,
  add column if not exists service_date date;

create index if not exists idx_financial_receivables_client_id on public.financial_receivables(client_id);
create index if not exists idx_financial_receivables_due_date on public.financial_receivables(due_date);
