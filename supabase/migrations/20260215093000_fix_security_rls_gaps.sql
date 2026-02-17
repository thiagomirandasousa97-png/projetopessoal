-- Tighten RLS by removing legacy permissive policies and ensuring role-based policies exist.

do $$
declare
  policy_name text;
begin
  -- Remove legacy/permissive policies that still allow broad access.
  foreach policy_name in array array[
    'Clients viewable by authenticated',
    'Authenticated insert clients',
    'Authenticated update clients',
    'Admins delete clients',
    'clients_select_auth',
    'clients_insert_auth',
    'clients_update_auth',
    'clients_delete_auth'
  ]
  loop
    execute format('drop policy if exists %I on public.clients', policy_name);
  end loop;

  foreach policy_name in array array[
    'Appointments viewable by authenticated',
    'Authenticated insert appointments',
    'Authenticated update appointments',
    'Admins delete appointments',
    'appointments_select_auth',
    'appointments_insert_auth',
    'appointments_update_auth',
    'appointments_delete_auth'
  ]
  loop
    execute format('drop policy if exists %I on public.appointments', policy_name);
  end loop;

  foreach policy_name in array array[
    'Profiles viewable by authenticated',
    'Users update own profile',
    'Users insert own profile'
  ]
  loop
    execute format('drop policy if exists %I on public.profiles', policy_name);
  end loop;

  foreach policy_name in array array[
    'Professionals viewable by authenticated',
    'Admins manage professionals',
    'authenticated_read_professionals',
    'authenticated_write_professionals'
  ]
  loop
    execute format('drop policy if exists %I on public.professionals', policy_name);
  end loop;

  foreach policy_name in array array[
    'Users can view own roles',
    'Admins manage roles'
  ]
  loop
    execute format('drop policy if exists %I on public.user_roles', policy_name);
  end loop;

  foreach policy_name in array array[
    'Services viewable by authenticated',
    'Admins manage services',
    'services_insert_auth',
    'services_update_auth',
    'services_delete_auth'
  ]
  loop
    execute format('drop policy if exists %I on public.services', policy_name);
  end loop;
end $$;

-- Re-create intended role-based policies when absent.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'admins_all_clients'
  ) then
    execute 'create policy "admins_all_clients" on public.clients for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'clients' and policyname = 'employees_read_clients'
  ) then
    execute 'create policy "employees_read_clients" on public.clients for select to authenticated using (exists (select 1 from public.professionals where professionals.user_id = auth.uid() and professionals.active = true))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appointments' and policyname = 'admins_all_appointments'
  ) then
    execute 'create policy "admins_all_appointments" on public.appointments for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appointments' and policyname = 'professionals_select_own_appointments'
  ) then
    execute 'create policy "professionals_select_own_appointments" on public.appointments for select to authenticated using (professional_id in (select id from public.professionals where user_id = auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appointments' and policyname = 'professionals_insert_own_appointments'
  ) then
    execute 'create policy "professionals_insert_own_appointments" on public.appointments for insert to authenticated with check (professional_id in (select id from public.professionals where user_id = auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appointments' and policyname = 'professionals_update_own_appointments'
  ) then
    execute 'create policy "professionals_update_own_appointments" on public.appointments for update to authenticated using (professional_id in (select id from public.professionals where user_id = auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'appointments' and policyname = 'professionals_delete_own_appointments'
  ) then
    execute 'create policy "professionals_delete_own_appointments" on public.appointments for delete to authenticated using (professional_id in (select id from public.professionals where user_id = auth.uid()))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'services' and policyname = 'admins_all_services'
  ) then
    execute 'create policy "admins_all_services" on public.services for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'services' and policyname = 'authenticated_read_services'
  ) then
    execute 'create policy "authenticated_read_services" on public.services for select to authenticated using (true)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'users_own_profile'
  ) then
    execute 'create policy "users_own_profile" on public.profiles for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'professionals' and policyname = 'admins_all_professionals'
  ) then
    execute 'create policy "admins_all_professionals" on public.professionals for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'professionals' and policyname = 'professionals_read_own'
  ) then
    execute 'create policy "professionals_read_own" on public.professionals for select to authenticated using (user_id = auth.uid())';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_roles' and policyname = 'admins_all_roles'
  ) then
    execute 'create policy "admins_all_roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_roles' and policyname = 'users_read_own_role'
  ) then
    execute 'create policy "users_read_own_role" on public.user_roles for select to authenticated using (user_id = auth.uid())';
  end if;
end $$;
