
-- Enum para roles
create type public.app_role as enum ('admin', 'employee');

-- Tabela de roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null default 'employee',
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- Função has_role
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Política: usuários veem seus próprios roles
create policy "Users can view own roles" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

-- Política: admins gerenciam roles
create policy "Admins manage roles" on public.user_roles
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Tabela de perfis
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  full_name text not null,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles viewable by authenticated" on public.profiles
  for select to authenticated using (true);
create policy "Users update own profile" on public.profiles
  for update to authenticated using (user_id = auth.uid());
create policy "Users insert own profile" on public.profiles
  for insert to authenticated with check (user_id = auth.uid());

-- Tabela de profissionais
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text,
  email text,
  specialties text[],
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.professionals enable row level security;

create policy "Professionals viewable by authenticated" on public.professionals
  for select to authenticated using (true);
create policy "Admins manage professionals" on public.professionals
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Tabela de clientes
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  birth_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clients enable row level security;

create policy "Clients viewable by authenticated" on public.clients
  for select to authenticated using (true);
create policy "Authenticated insert clients" on public.clients
  for insert to authenticated with check (true);
create policy "Authenticated update clients" on public.clients
  for update to authenticated using (true);
create policy "Admins delete clients" on public.clients
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Tabela de serviços
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_minutes int not null default 30,
  price numeric(10,2) not null default 0,
  category text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.services enable row level security;

create policy "Services viewable by authenticated" on public.services
  for select to authenticated using (true);
create policy "Admins manage services" on public.services
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Tabela de agendamentos
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade not null,
  professional_id uuid references public.professionals(id) on delete cascade not null,
  service_id uuid references public.services(id) on delete cascade not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.appointments enable row level security;

create policy "Appointments viewable by authenticated" on public.appointments
  for select to authenticated using (true);
create policy "Authenticated insert appointments" on public.appointments
  for insert to authenticated with check (true);
create policy "Authenticated update appointments" on public.appointments
  for update to authenticated using (true);
create policy "Admins delete appointments" on public.appointments
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Índice para evitar agendamentos duplicados
create unique index idx_no_duplicate_appointments 
  on public.appointments (professional_id, start_time) 
  where status != 'cancelled';

-- Tabela financeira - receitas
create table public.financial_receivables (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  description text not null,
  amount numeric(10,2) not null,
  payment_method text,
  status text not null default 'pending' check (status in ('paid','pending')),
  due_date date not null default current_date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.financial_receivables enable row level security;

create policy "Receivables viewable by authenticated" on public.financial_receivables
  for select to authenticated using (true);
create policy "Authenticated insert receivables" on public.financial_receivables
  for insert to authenticated with check (true);
create policy "Authenticated update receivables" on public.financial_receivables
  for update to authenticated using (true);
create policy "Admins delete receivables" on public.financial_receivables
  for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Tabela financeira - despesas
create table public.financial_payables (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10,2) not null,
  category text,
  status text not null default 'pending' check (status in ('paid','pending')),
  due_date date not null default current_date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.financial_payables enable row level security;

create policy "Payables viewable by authenticated" on public.financial_payables
  for select to authenticated using (true);
create policy "Admins manage payables" on public.financial_payables
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

create trigger update_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at_column();
create trigger update_clients_updated_at before update on public.clients
  for each row execute function public.update_updated_at_column();
create trigger update_appointments_updated_at before update on public.appointments
  for each row execute function public.update_updated_at_column();
