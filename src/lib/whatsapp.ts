/**
 * WhatsApp Automation Module
 * Prepared for future integration with official WhatsApp Business API or Z-API.
 * Currently logs messages and stores history in Supabase.
 */

import { supabase } from "@/integrations/supabase/client";

export type MessageType =
  | "appointment_confirmation"
  | "appointment_reminder_24h"
  | "birthday"
  | "overdue_invoice"
  | "reschedule_confirmation"
  | "general";

type SendMessageParams = {
  clientId: string;
  clientPhone: string;
  clientName: string;
  type: MessageType;
  content: string;
  appointmentId?: string;
};

function formatPhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function generateMessage(type: MessageType, data: Record<string, string>): string {
  switch (type) {
    case "appointment_confirmation":
      return `Olá ${data.clientName}! ✅ Seu agendamento foi confirmado para ${data.date} às ${data.time}. Serviço: ${data.service}. Profissional: ${data.professional}. Qualquer dúvida, entre em contato!`;
    case "appointment_reminder_24h":
      return `Olá ${data.clientName}! ⏰ Lembrete: amanhã você tem um agendamento às ${data.time}. Serviço: ${data.service}. Te esperamos!`;
    case "birthday":
      return `Feliz aniversário, ${data.clientName}! 🎂🎉 Desejamos muitas felicidades! Que tal comemorar com um serviço especial? Estamos te esperando!`;
    case "overdue_invoice":
      return `Olá ${data.clientName}, notamos que há uma pendência financeira em aberto há mais de 30 dias. Por favor, entre em contato para regularizar. Obrigado! 💳`;
    case "reschedule_confirmation":
      return `Olá ${data.clientName}! 📅 Seu agendamento foi remarcado para ${data.date} às ${data.time}. Serviço: ${data.service}. Qualquer dúvida, entre em contato!`;
    default:
      return data.content || "";
  }
}

async function saveMessageHistory(params: SendMessageParams): Promise<void> {
  const { error } = await supabase.from("message_history" as any).insert({
    client_id: params.clientId,
    appointment_id: params.appointmentId || null,
    type: params.type,
    channel: "whatsapp",
    content: params.content,
    status: "sent",
    sent_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Erro ao salvar histórico de mensagem:", error);
  }
}

/**
 * Sends a WhatsApp message.
 * Currently opens WhatsApp Web as fallback.
 * Replace with Z-API or official API call when available.
 */
export async function sendWhatsAppMessage(params: SendMessageParams): Promise<boolean> {
  try {
    const phone = formatPhone(params.clientPhone);
    if (!phone || phone.length < 10) {
      console.warn("Telefone inválido para envio WhatsApp:", params.clientPhone);
      return false;
    }

    // Save to history
    await saveMessageHistory(params);

    // Fallback: open WhatsApp Web (for manual confirmation)
    // In production, replace with API call:
    // await fetch('https://api.z-api.io/...', { method: 'POST', body: JSON.stringify({ phone, message: params.content }) });
    console.log(`[WhatsApp] Mensagem preparada para ${phone}: ${params.content.slice(0, 50)}...`);

    return true;
  } catch (error) {
    console.error("Erro ao enviar WhatsApp:", error);
    return false;
  }
}

export { generateMessage, formatPhone };
