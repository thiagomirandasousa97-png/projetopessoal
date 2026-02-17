import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cake, AlertTriangle, Calendar, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toCurrency } from "@/lib/database";

type AlertItem = {
  id: string;
  icon: "birthday" | "overdue" | "appointment" | "top";
  text: string;
};

export default function AlertsPopup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [topProfessional, setTopProfessional] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const monthDay = today.slice(5);
      const items: AlertItem[] = [];

      try {
        const [clientsRes, receivablesRes, appointmentsRes, professionalsRes, servicesRes] = await Promise.all([
          supabase.from("clients").select("id, name, birth_date"),
          supabase.from("financial_receivables").select("id, description, due_date, status, amount"),
          supabase.from("appointments").select("id, client_id, service_id, professional_id, start_time, status"),
          supabase.from("professionals").select("id, name"),
          supabase.from("services").select("id, name, price"),
        ]);

        // Birthday alerts
        const birthdayClients = (clientsRes.data ?? []).filter(
          (c) => String(c.birth_date ?? "").slice(5) === monthDay
        );
        birthdayClients.forEach((c, i) => {
          items.push({ id: `bday-${i}`, icon: "birthday", text: `🎂 Aniversariante: ${c.name}` });
        });

        // Overdue receivables (30+ days)
        const overdueReceivables = (receivablesRes.data ?? []).filter((r) => {
          if (String(r.status ?? "").toLowerCase() === "paid" || String(r.status ?? "").toLowerCase() === "pago") return false;
          const due = String(r.due_date ?? "");
          if (!due) return false;
          const days = Math.floor((Date.now() - new Date(`${due}T00:00:00`).getTime()) / 86400000);
          return days >= 30;
        });
        overdueReceivables.slice(0, 5).forEach((r, i) => {
          items.push({ id: `overdue-${i}`, icon: "overdue", text: `💸 Conta vencida: ${r.description} - ${toCurrency(Number(r.amount))}` });
        });

        // Today's appointments
        const clientMap = new Map((clientsRes.data ?? []).map((c) => [c.id, c.name]));
        const serviceMap = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));
        const professionalMap = new Map((professionalsRes.data ?? []).map((p) => [p.id, p.name]));

        const todayAppointments = (appointmentsRes.data ?? []).filter((a) => {
          const d = a.start_time ? new Date(a.start_time).toISOString().slice(0, 10) : "";
          return d === today && String(a.status).toLowerCase() !== "cancelled";
        });

        todayAppointments.slice(0, 5).forEach((a, i) => {
          const time = a.start_time ? new Date(a.start_time).toTimeString().slice(0, 5) : "";
          const client = clientMap.get(a.client_id) ?? "Cliente";
          const service = serviceMap.get(a.service_id) ?? "Serviço";
          items.push({ id: `apt-${i}`, icon: "appointment", text: `📅 ${time} - ${client} (${service})` });
        });

        // Top professional this month (by completed appointments)
        const thisMonth = today.slice(0, 7);
        const monthAppointments = (appointmentsRes.data ?? []).filter((a) => {
          const d = a.start_time ? new Date(a.start_time).toISOString().slice(0, 7) : "";
          return d === thisMonth && String(a.status).toLowerCase() === "completed";
        });

        const profCounts: Record<string, number> = {};
        monthAppointments.forEach((a) => {
          profCounts[a.professional_id] = (profCounts[a.professional_id] ?? 0) + 1;
        });
        const topId = Object.entries(profCounts).sort((a, b) => b[1] - a[1])[0];
        if (topId) {
          const name = professionalMap.get(topId[0]) ?? "Profissional";
          setTopProfessional(name);
          items.push({ id: "top", icon: "top", text: `🏆 Profissional destaque: ${name} (${topId[1]} atendimentos)` });
        }

        if (items.length > 0) {
          setAlerts(items);
          setOpen(true);
        }
      } catch (err) {
        console.error("Erro ao carregar alertas:", err);
      }
    };

    void load();
  }, [user]);

  const iconMap = {
    birthday: <Cake className="h-4 w-4 text-accent shrink-0" />,
    overdue: <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />,
    appointment: <Calendar className="h-4 w-4 text-primary shrink-0" />,
    top: <Trophy className="h-4 w-4 text-warning shrink-0" />,
  };

  if (alerts.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            📋 Alertas do Dia
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 text-sm">
              {iconMap[a.icon]}
              <span>{a.text}</span>
            </div>
          ))}
        </div>
        <Button onClick={() => setOpen(false)} className="w-full mt-2">Entendido</Button>
      </DialogContent>
    </Dialog>
  );
}
