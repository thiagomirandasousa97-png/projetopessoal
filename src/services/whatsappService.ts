import { supabase } from "@/integrations/supabase/client";

export type WhatsAppPayload = {
  to: string;
  body: string;
  metadata?: Record<string, string>;
};

export type WhatsAppResult = {
  ok: boolean;
  provider?: string;
  externalId?: string;
  error?: string;
};

/**
 * Real backend call via Supabase Edge Function.
 * Configure an edge function named `send-whatsapp` to connect your provider.
 */
export async function sendWhatsApp(payload: WhatsAppPayload): Promise<WhatsAppResult> {
  const { data, error } = await supabase.functions.invoke("send-whatsapp", {
    body: payload,
  });

  if (error) {
    return {
      ok: false,
      error: error.message,
    };
  }

  return {
    ok: Boolean(data?.ok),
    provider: data?.provider,
    externalId: data?.externalId,
    error: data?.error,
  };
}
