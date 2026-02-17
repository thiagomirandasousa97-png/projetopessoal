-- Harden RLS by removing permissive authenticated-write policies.
-- Keep role-based policies (admins_all_*, professionals_*_own_appointments,
-- employees_read_clients, authenticated_read_services) already defined.

do $$
begin
  if to_regclass('public.clients') is not null then
    execute 'drop policy if exists clients_select_auth on public.clients';
    execute 'drop policy if exists clients_insert_auth on public.clients';
    execute 'drop policy if exists clients_update_auth on public.clients';
    execute 'drop policy if exists clients_delete_auth on public.clients';
  end if;

  if to_regclass('public.services') is not null then
    execute 'drop policy if exists services_insert_auth on public.services';
    execute 'drop policy if exists services_update_auth on public.services';
    execute 'drop policy if exists services_delete_auth on public.services';
  end if;

  if to_regclass('public.financial_payables') is not null then
    execute 'drop policy if exists financial_payables_select_auth on public.financial_payables';
    execute 'drop policy if exists financial_payables_insert_auth on public.financial_payables';
    execute 'drop policy if exists financial_payables_update_auth on public.financial_payables';
    execute 'drop policy if exists financial_payables_delete_auth on public.financial_payables';
  end if;

  if to_regclass('public.financial_receivables') is not null then
    execute 'drop policy if exists financial_receivables_select_auth on public.financial_receivables';
    execute 'drop policy if exists financial_receivables_insert_auth on public.financial_receivables';
    execute 'drop policy if exists financial_receivables_update_auth on public.financial_receivables';
    execute 'drop policy if exists financial_receivables_delete_auth on public.financial_receivables';
  end if;

  if to_regclass('public.appointments') is not null then
    execute 'drop policy if exists appointments_select_auth on public.appointments';
    execute 'drop policy if exists appointments_insert_auth on public.appointments';
    execute 'drop policy if exists appointments_update_auth on public.appointments';
    execute 'drop policy if exists appointments_delete_auth on public.appointments';
  end if;
end
$$;
