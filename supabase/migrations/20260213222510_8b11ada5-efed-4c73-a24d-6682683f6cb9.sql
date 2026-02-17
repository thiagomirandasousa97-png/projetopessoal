
-- =============================================
-- Fix overly permissive RLS on clients table
-- Admins: full CRUD
-- Employees: read-only
-- =============================================

-- Add permissive policies for clients (role-based)
CREATE POLICY "admins_all_clients" ON public.clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "employees_read_clients" ON public.clients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.professionals
      WHERE professionals.user_id = auth.uid()
      AND professionals.active = true
    )
  );

-- =============================================
-- Fix overly permissive RLS on appointments
-- Admins: full CRUD
-- Professionals: manage own appointments only
-- =============================================

CREATE POLICY "admins_all_appointments" ON public.appointments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "professionals_select_own_appointments" ON public.appointments
  FOR SELECT TO authenticated
  USING (
    professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "professionals_insert_own_appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "professionals_update_own_appointments" ON public.appointments
  FOR UPDATE TO authenticated
  USING (
    professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "professionals_delete_own_appointments" ON public.appointments
  FOR DELETE TO authenticated
  USING (
    professional_id IN (SELECT id FROM public.professionals WHERE user_id = auth.uid())
  );

-- =============================================
-- Add permissive policies for other tables that only have RESTRICTIVE policies
-- =============================================

-- Services: admins CRUD, all authenticated read
CREATE POLICY "admins_all_services" ON public.services
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "authenticated_read_services" ON public.services
  FOR SELECT TO authenticated
  USING (true);

-- Financial payables: admin only
CREATE POLICY "admins_all_payables" ON public.financial_payables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Financial receivables: admin only
CREATE POLICY "admins_all_receivables" ON public.financial_receivables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles: users can manage their own (permissive)
CREATE POLICY "users_own_profile" ON public.profiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Professionals: admins can manage all, users can read own
CREATE POLICY "admins_all_professionals" ON public.professionals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "professionals_read_own" ON public.professionals
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- User roles: users read own, admins manage all
CREATE POLICY "admins_all_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users_read_own_role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
