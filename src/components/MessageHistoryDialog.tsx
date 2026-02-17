import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  type: string;
  content: string;
  status: string;
  sentAt: string;
  channel: string;
};

const typeLabels: Record<string, string> = {
  appointment_confirmation: "Confirmação",
  appointment_reminder_24h: "Lembrete 24h",
  birthday: "Aniversário",
  overdue_invoice: "Conta vencida",
  reschedule_confirmation: "Remarcação",
  general: "Geral",
};

export default function MessageHistoryDialog({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open || !clientId) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("message_history" as any)
        .select("id, type, content, status, sent_at, channel")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Erro ao carregar mensagens:", error);
        return;
      }

      setMessages(
        ((data as any[]) ?? []).map((m) => ({
          id: String(m.id),
          type: String(m.type ?? "general"),
          content: String(m.content ?? ""),
          status: String(m.status ?? "pending"),
          sentAt: m.sent_at ? new Date(m.sent_at).toLocaleString("pt-BR") : "-",
          channel: String(m.channel ?? "whatsapp"),
        }))
      );
    };

    void load();
  }, [open, clientId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Histórico de mensagens">
          <MessageSquare className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Mensagens — {clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma mensagem enviada para este cliente.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="p-3 rounded-lg border border-border/50 bg-muted/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {typeLabels[m.type] ?? m.type}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.sentAt}</span>
                </div>
                <p className="text-sm mt-1">{m.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", m.status === "sent" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                    {m.status === "sent" ? "Enviado" : "Pendente"}
                  </span>
                  <span className="text-xs text-muted-foreground">via {m.channel}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
