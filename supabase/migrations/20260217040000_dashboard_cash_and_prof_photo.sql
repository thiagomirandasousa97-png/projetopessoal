alter table public.professionals
  add column if not exists photo_url text;

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opening_amount numeric(10,2) not null default 0,
  closing_amount numeric(10,2),
  opened_by text not null,
  closed_by text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  status text not null default 'open',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.cash_sessions enable row level security;

drop policy if exists cash_sessions_select_authenticated on public.cash_sessions;
drop policy if exists cash_sessions_insert_authenticated on public.cash_sessions;
drop policy if exists cash_sessions_update_authenticated on public.cash_sessions;
drop policy if exists cash_sessions_delete_authenticated on public.cash_sessions;

create policy cash_sessions_select_authenticated
on public.cash_sessions
for select
to authenticated
using (true);

create policy cash_sessions_insert_authenticated
on public.cash_sessions
for insert
to authenticated
with check (true);

create policy cash_sessions_update_authenticated
on public.cash_sessions
for update
to authenticated
using (true)
with check (true);

create policy cash_sessions_delete_authenticated
on public.cash_sessions
for delete
to authenticated
using (true);

create index if not exists idx_cash_sessions_opened_at on public.cash_sessions(opened_at);
create index if not exists idx_cash_sessions_status on public.cash_sessions(status);
