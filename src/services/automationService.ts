import { supabase } from "@/integrations/supabase/client";
import { sendWhatsApp } from "@/services/whatsappService";

type AutomationLogType = "reminder" | "birthday" | "overdue";

type ClientContact = {
  id: string;
  name: string;
  phone: string | null;
  allow_whatsapp: boolean | null;
};

async function logMessage(clientId: string, type: AutomationLogType, content: string, status: string) {
  await supabase.from("message_history").insert({
    client_id: clientId,
    type,
    content,
    status,
    channel: "whatsapp",
    sent_at: new Date().toISOString(),
  });
}

async function sendForClient(client: ClientContact, type: AutomationLogType, body: string) {
  if (!client.phone || !client.allow_whatsapp) {
    await logMessage(client.id, type, body, "skipped");
    return;
  }

  const response = await sendWhatsApp({
    to: client.phone,
    body,
    metadata: { clientId: client.id, type },
  });

  await logMessage(client.id, type, body, response.ok ? "sent" : "failed");
}

export async function send24hReminderAutomation() {
  const now = new Date();
  const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, start_time, clients!inner(id, name, phone, accepts_messages)")
    .gte("start_time", start.toISOString())
    .lt("start_time", end.toISOString())
    .in("status", ["scheduled", "confirmed", "rescheduled"]);

  if (error) throw error;

  for (const item of data ?? []) {
    const client = Array.isArray(item.clients) ? item.clients[0] : item.clients;
    if (!client) continue;

    await sendForClient(
      {
        id: String(client.id),
        name: String(client.name),
        phone: (client as any).phone ?? null,
        allow_whatsapp: (client as any).accepts_messages ?? true,
      },
      "reminder",
      `Olá ${client.name}! Lembrete: você tem atendimento em 24h.`,
    );
  }
}

export async function sendBirthdayAutomation() {
  const monthDay = new Date().toISOString().slice(5, 10);
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, phone, accepts_messages, birth_date")
    .not("birth_date", "is", null);

  if (error) throw error;

  for (const client of data ?? []) {
    if (String(client.birth_date).slice(5, 10) !== monthDay) continue;

    await sendForClient(
      {
        id: String(client.id),
        name: String(client.name),
        phone: client.phone ?? null,
        allow_whatsapp: client.accepts_messages ?? true,
      },
      "birthday",
      `Parabéns, ${client.name}! 🎉 Equipe do salão deseja um dia incrível para você.`,
    );
  }
}

export async function sendOverdue30DaysAutomation() {
  const { data, error } = await supabase
    .from("financial_receivables")
    .select("id, due_date, status, client_id, clients(id, name, phone, accepts_messages)")
    .neq("status", "paid")
    .not("client_id", "is", null);

  if (error) throw error;

  for (const row of data ?? []) {
    const due = new Date(`${row.due_date}T00:00:00`);
    const overdueDays = Math.floor((Date.now() - due.getTime()) / 86400000);
    if (overdueDays < 30) continue;

    const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
    if (!client) continue;

    await sendForClient(
      {
        id: String(client.id),
        name: String(client.name),
        phone: (client as any).phone ?? null,
        allow_whatsapp: (client as any).accepts_messages ?? true,
      },
      "overdue",
      `Olá ${client.name}, identificamos uma conta em aberto há ${overdueDays} dias. Podemos te ajudar com a regularização?`,
    );
  }
}
