-- Create professionals table used by scheduling and professionals management.
create extension if not exists pgcrypto;

create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  role text default 'Profissional',
  created_at timestamptz not null default now()
);

alter table public.professionals enable row level security;

grant select, insert, update, delete on public.professionals to authenticated;

-- Read for any authenticated user.
drop policy if exists authenticated_read_professionals on public.professionals;
create policy authenticated_read_professionals
on public.professionals
for select
to authenticated
using (true);

-- Temporary write access for authenticated users so registration works even
-- before custom RBAC functions/types are installed in the project.
drop policy if exists authenticated_write_professionals on public.professionals;
create policy authenticated_write_professionals
on public.professionals
for all
to authenticated
using (true)
with check (true);
