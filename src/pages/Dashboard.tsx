import { Calendar, Users, DollarSign, Clock, Bell, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toCurrency } from "@/lib/database";
import { useAuth } from "@/hooks/use-auth";
import StatCard from "@/components/StatCard";
import PageHeader from "@/components/PageHeader";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";

type Appointment = {
  id: string;
  time: string;
  date: string;
  client: string;
  service: string;
  servicePrice: number;
  professional: string;
  professionalId: string;
  status: string;
};

const statusColors: Record<string, string> = {
  scheduled: "bg-warning/15 text-warning",
  confirmed: "bg-primary/15 text-primary",
  rescheduled: "bg-accent/15 text-accent",
  completed: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  rescheduled: "Reagendado",
  completed: "Finalizado",
  cancelled: "Cancelado",
};

export default function Dashboard() {
  const { user } = useAuth();
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [appointmentsToday, setAppointmentsToday] = useState<Appointment[]>([]);
  const [birthdaysToday, setBirthdaysToday] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [topProfessional, setTopProfessional] = useState("-");
  const [showAlertModal, setShowAlertModal] = useState(true);

  const load = async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [appointmentsRes, clientsRes, financeRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, client_id, service_id, professional_id, start_time, status, clients(name), services(name,price), professionals(name)"),
      supabase.from("clients").select("id, birth_date"),
      supabase
        .from("financial_receivables")
        .select("id, amount, status, due_date, created_at"),
    ]);

    if (appointmentsRes.error || clientsRes.error || financeRes.error) {
      return;
    }

    const allAppointments = (appointmentsRes.data ?? []).map((row) => {
      const start = new Date(row.start_time);
      const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
      const service = Array.isArray(row.services) ? row.services[0] : row.services;
      const professional = Array.isArray(row.professionals) ? row.professionals[0] : row.professionals;
      return {
        id: String(row.id),
        date: start.toISOString().slice(0, 10),
        time: start.toTimeString().slice(0, 5),
        client: String(client?.name ?? "Cliente"),
        service: String(service?.name ?? "Serviço"),
        servicePrice: Number(service?.price ?? 0),
        professional: String(professional?.name ?? "Profissional"),
        professionalId: String(row.professional_id ?? ""),
        status: String(row.status ?? "scheduled"),
      };
    });

    const todayAppointments = allAppointments
      .filter((a) => a.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
    setAppointmentsToday(todayAppointments);

    const monthDay = today.slice(5, 10);
    const bCount = (clientsRes.data ?? []).filter(
      (c) => String(c.birth_date ?? "").slice(5, 10) === monthDay,
    ).length;
    setBirthdaysToday(bCount);

    const paidThisMonth = (financeRes.data ?? []).filter(
      (f) => f.status === "paid" && new Date(String(f.created_at)).getTime() >= monthStart.getTime(),
    );
    setMonthlyRevenue(paidThisMonth.reduce((acc, item) => acc + Number(item.amount ?? 0), 0));

    const overdue = (financeRes.data ?? []).filter((f) => {
      if (f.status === "paid") return false;
      return new Date(`${f.due_date}T00:00:00`).getTime() < Date.now();
    });
    setOverdueCount(overdue.length);

    const professionalRevenue = new Map<string, number>();
    for (const appointment of allAppointments) {
      if (appointment.status !== "completed") continue;
      const value = appointment.servicePrice;
      professionalRevenue.set(
        appointment.professional,
        (professionalRevenue.get(appointment.professional) ?? 0) + Number(value),
      );
    }

    const best = Array.from(professionalRevenue.entries()).sort((a, b) => b[1] - a[1])[0];
    setTopProfessional(best?.[0] ?? "-");
  };

  useEffect(() => {
    void load();
  }, [user]);

  const alerts = useDashboardAlerts({
    overdueCount,
    birthdaysToday,
    appointmentsToday: appointmentsToday.length,
  });

  const revenueText = useMemo(() => toCurrency(monthlyRevenue), [monthlyRevenue]);

  return (
    <div>
      <PageHeader title="Painel Inteligente" description="Visão SaaS avançada do salão" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard title="Faturamento do Mês" value={revenueText} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Agendamentos Hoje" value={appointmentsToday.length} icon={<Calendar className="h-5 w-5" />} />
        <StatCard title="Aniversariantes" value={birthdaysToday} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Contas Vencidas" value={overdueCount} icon={<Bell className="h-5 w-5" />} />
        <StatCard title="Top Profissional" value={topProfessional} icon={<Trophy className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2 glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2"><Clock className="h-4 w-4 text-primary" />Agenda de Hoje</h2>
          </div>
          <div className="space-y-3">
            {appointmentsToday.length === 0 ? <p className="text-sm text-muted-foreground">Sem agendamentos para hoje.</p> : null}
            {appointmentsToday.map((apt) => (
              <div key={apt.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                <span className="text-sm font-mono font-semibold text-primary w-12">{apt.time}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{apt.client}</p>
                  <p className="text-xs text-muted-foreground truncate">{apt.service} · {apt.professional}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColors[apt.status] ?? statusColors.scheduled}`}>{statusLabels[apt.status] ?? apt.status}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5 space-y-4">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2"><Bell className="h-4 w-4 text-primary" />Alertas</h2>
          {alerts.length === 0 ? <p className="text-sm text-muted-foreground">Sem alertas importantes.</p> : null}
          {alerts.map((alert) => (
            <div key={alert.id} className={alert.tone === "danger" ? "p-3 rounded-lg bg-destructive/10 text-destructive text-sm" : alert.tone === "warning" ? "p-3 rounded-lg bg-warning/10 text-warning text-sm" : "p-3 rounded-lg bg-primary/10 text-primary text-sm"}>
              <p className="font-semibold">{alert.title}</p>
              <p>{alert.description}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <Dialog open={showAlertModal && alerts.length > 0} onOpenChange={setShowAlertModal}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Alertas importantes</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div key={`modal-${alert.id}`} className="rounded-md border p-3">
                <p className="font-medium">{alert.title}</p>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
              </div>
            ))}
            <Button className="w-full" onClick={() => setShowAlertModal(false)}>Entendi</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
