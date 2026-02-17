
-- 1. Add accepts_messages to clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS accepts_messages boolean NOT NULL DEFAULT true;

-- 2. Add commission_percent to professionals
ALTER TABLE public.professionals ADD COLUMN IF NOT EXISTS commission_percent numeric NOT NULL DEFAULT 0;

-- 3. Add rescheduled_from to appointments (tracks original appointment when rescheduled)
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS rescheduled_from uuid REFERENCES public.appointments(id);

-- 4. Create message_history table
CREATE TABLE IF NOT EXISTS public.message_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'general',
  channel text NOT NULL DEFAULT 'whatsapp',
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on message_history
ALTER TABLE public.message_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_history
CREATE POLICY "admins_all_messages" ON public.message_history FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "authenticated_read_messages" ON public.message_history FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_message_history_client ON public.message_history(client_id);
CREATE INDEX IF NOT EXISTS idx_message_history_type ON public.message_history(type);
CREATE INDEX IF NOT EXISTS idx_appointments_rescheduled ON public.appointments(rescheduled_from);
