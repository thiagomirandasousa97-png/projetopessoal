import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Calendar,
  DollarSign,
  ShoppingBag,
  UserCheck,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { toCurrency } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { paymentMethodLabel } from "@/lib/payments";

type AppointmentRow = {
  id: string;
  client_id: string;
  professional_id: string;
  service_id: string;
  start_time: string;
  status: string;
  services: { name: string; price: number } | null;
  professionals: { id: string; name: string; photo_url?: string | null } | null;
};

type ReceivableRow = {
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
};

type PayableRow = {
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
};

type CashSessionRow = {
  id: string;
  opening_amount: number;
  closing_amount: number | null;
  opened_by: string;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  status: "open" | "closed";
};

type RankingRow = {
  professionalId: string;
  professionalName: string;
  photoUrl: string | null;
  totalAppointments: number;
  totalRevenue: number;
};

const CHART_COLORS = [
  "hsl(346 60% 55%)",
  "hsl(38 70% 55%)",
  "hsl(152 55% 42%)",
  "hsl(200 60% 50%)",
  "hsl(270 50% 55%)",
];

function yyyyMmDd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sameMonth(dateStr: string, base: Date) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return date.getFullYear() === base.getFullYear() && date.getMonth() === base.getMonth();
}

export default function Dashboard() {
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [payables, setPayables] = useState<PayableRow[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSessionRow[]>([]);
  const [openCashModal, setOpenCashModal] = useState(false);
  const [closeCashModal, setCloseCashModal] = useState(false);
  const [cashOpenForm, setCashOpenForm] = useState({
    openingAmount: "",
    openedBy: "",
    openedAt: new Date().toISOString().slice(0, 16),
  });
  const [cashCloseForm, setCashCloseForm] = useState({
    closingAmount: "",
    closedBy: "",
    closedAt: new Date().toISOString().slice(0, 16),
  });

  const today = yyyyMmDd(new Date());
  const now = new Date();

  const load = async () => {
    const [appointmentsRes, receivablesRes, payablesRes, cashRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, client_id, professional_id, service_id, start_time, status, services(name,price), professionals(id,name,photo_url)"),
      supabase
        .from("financial_receivables")
        .select("amount, status, due_date, paid_at, payment_method"),
      supabase
        .from("financial_payables")
        .select("amount, status, due_date, paid_at"),
      supabase
        .from("cash_sessions")
        .select("id, opening_amount, closing_amount, opened_by, closed_by, opened_at, closed_at, status")
        .order("opened_at", { ascending: false }),
    ]);

    if (!appointmentsRes.error) {
      setAppointments(
        (appointmentsRes.data ?? []).map((item) => {
          const service = Array.isArray(item.services) ? item.services[0] : item.services;
          const professional = Array.isArray(item.professionals) ? item.professionals[0] : item.professionals;
          return {
            id: String(item.id),
            client_id: String(item.client_id),
            professional_id: String(item.professional_id),
            service_id: String(item.service_id),
            start_time: String(item.start_time ?? ""),
            status: String(item.status ?? "scheduled"),
            services: service
              ? { name: String(service.name ?? ""), price: Number(service.price ?? 0) }
              : null,
            professionals: professional
              ? { id: String(professional.id), name: String(professional.name ?? ""), photo_url: professional.photo_url ? String(professional.photo_url) : null }
              : null,
          };
        }),
      );
    }

    if (!receivablesRes.error) {
      setReceivables(
        (receivablesRes.data ?? []).map((item) => ({
          amount: Number(item.amount ?? 0),
          status: String(item.status ?? "pending"),
          due_date: String(item.due_date ?? ""),
          paid_at: item.paid_at ? String(item.paid_at) : null,
          payment_method: item.payment_method ? String(item.payment_method) : null,
        })),
      );
    }

    if (!payablesRes.error) {
      setPayables(
        (payablesRes.data ?? []).map((item) => ({
          amount: Number(item.amount ?? 0),
          status: String(item.status ?? "pending"),
          due_date: String(item.due_date ?? ""),
          paid_at: item.paid_at ? String(item.paid_at) : null,
        })),
      );
    }

    if (!cashRes.error) {
      setCashSessions(
        (cashRes.data ?? []).map((item) => ({
          id: String(item.id),
          opening_amount: Number(item.opening_amount ?? 0),
          closing_amount: item.closing_amount === null ? null : Number(item.closing_amount),
          opened_by: String(item.opened_by ?? ""),
          closed_by: item.closed_by ? String(item.closed_by) : null,
          opened_at: String(item.opened_at ?? ""),
          closed_at: item.closed_at ? String(item.closed_at) : null,
          status: (String(item.status ?? "open") === "closed" ? "closed" : "open"),
        })),
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const currentOpenCash = useMemo(
    () => cashSessions.find((session) => session.status === "open"),
    [cashSessions],
  );

  const metrics = useMemo(() => {
    const appointmentsToday = appointments.filter((item) => item.start_time.slice(0, 10) === today);
    const completedToday = appointmentsToday.filter((item) => item.status === "completed");
    const clientsAttended = new Set(completedToday.map((item) => item.client_id)).size;

    const paidToday = receivables
      .filter((item) => item.status === "paid" && String(item.paid_at ?? "").slice(0, 10) === today)
      .reduce((acc, item) => acc + item.amount, 0);

    const payablesPaidToday = payables
      .filter((item) => item.status === "paid" && String(item.paid_at ?? "").slice(0, 10) === today)
      .reduce((acc, item) => acc + item.amount, 0);

    const openingToday = cashSessions
      .filter((item) => item.opened_at.slice(0, 10) === today)
      .reduce((acc, item) => acc + item.opening_amount, 0);

    const caixaDia = openingToday + paidToday - payablesPaidToday;

    const receivableToday = receivables
      .filter((item) => item.status !== "paid" && item.due_date === today)
      .reduce((acc, item) => acc + item.amount, 0);

    const payableToday = payables
      .filter((item) => item.status !== "paid" && item.due_date === today)
      .reduce((acc, item) => acc + item.amount, 0);

    return {
      appointmentsToday: appointmentsToday.length,
      clientsAttended,
      caixaDia,
      receivableToday,
      payableToday,
    };
  }, [appointments, cashSessions, payables, receivables, today]);

  const serviceTopDay = useMemo(() => {
    const map = new Map<string, number>();
    appointments
      .filter((item) => item.start_time.slice(0, 10) === today && item.status !== "cancelled")
      .forEach((item) => {
        const name = item.services?.name ?? "Servico";
        map.set(name, (map.get(name) ?? 0) + 1);
      });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [appointments, today]);

  const serviceTopMonth = useMemo(() => {
    const map = new Map<string, number>();
    appointments
      .filter((item) => sameMonth(item.start_time, now) && item.status !== "cancelled")
      .forEach((item) => {
        const name = item.services?.name ?? "Servico";
        map.set(name, (map.get(name) ?? 0) + 1);
      });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [appointments, now]);

  const rankingMonth = useMemo<RankingRow[]>(() => {
    const map = new Map<string, RankingRow>();
    appointments
      .filter((item) => sameMonth(item.start_time, now) && item.status === "completed")
      .forEach((item) => {
        const professionalId = item.professional_id;
        const current = map.get(professionalId) ?? {
          professionalId,
          professionalName: item.professionals?.name ?? "Profissional",
          photoUrl: item.professionals?.photo_url ?? null,
          totalAppointments: 0,
          totalRevenue: 0,
        };
        current.totalAppointments += 1;
        current.totalRevenue += Number(item.services?.price ?? 0);
        map.set(professionalId, current);
      });

    return Array.from(map.values()).sort((a, b) => b.totalAppointments - a.totalAppointments);
  }, [appointments, now]);

  const topProfessionalToday = rankingMonth.find((row) =>
    appointments.some(
      (item) =>
        item.professional_id === row.professionalId &&
        item.start_time.slice(0, 10) === today &&
        item.status === "completed",
    ),
  );

  const faturamentoPorDia = useMemo(() => {
    const base = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() - (6 - i));
      return yyyyMmDd(d);
    });

    const grouped = new Map<string, number>();
    receivables.forEach((item) => {
      if (item.status !== "paid" || !item.paid_at) return;
      const day = item.paid_at.slice(0, 10);
      grouped.set(day, (grouped.get(day) ?? 0) + item.amount);
    });

    return dates.map((day) => ({
      day: new Date(`${day}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      value: grouped.get(day) ?? 0,
    }));
  }, [receivables]);

  const atendimentosPorProfissional = useMemo(
    () => rankingMonth.map((item) => ({ name: item.professionalName, value: item.totalAppointments })),
    [rankingMonth],
  );

  const formasPagamento = useMemo(() => {
    const grouped = new Map<string, number>();
    receivables
      .filter((item) => item.status === "paid")
      .forEach((item) => {
        const method = item.payment_method ?? "nao_informado";
        grouped.set(method, (grouped.get(method) ?? 0) + item.amount);
      });
    return Array.from(grouped.entries()).map(([name, value]) => ({
      name: paymentMethodLabel(name),
      value,
    }));
  }, [receivables]);

  const openCash = async () => {
    if (currentOpenCash) {
      toast.error("Ja existe um caixa aberto.");
      return;
    }

    const { error } = await supabase.from("cash_sessions").insert({
      opening_amount: Number(cashOpenForm.openingAmount || 0),
      opened_by: cashOpenForm.openedBy || "Nao informado",
      opened_at: new Date(cashOpenForm.openedAt).toISOString(),
      status: "open",
    });

    if (error) {
      toast.error("Falha ao abrir caixa.");
      return;
    }

    toast.success("Caixa aberto.");
    setOpenCashModal(false);
    setCashOpenForm({
      openingAmount: "",
      openedBy: "",
      openedAt: new Date().toISOString().slice(0, 16),
    });
    await load();
  };

  const closeCash = async () => {
    if (!currentOpenCash) {
      toast.error("Nao existe caixa aberto.");
      return;
    }

    const { error } = await supabase
      .from("cash_sessions")
      .update({
        closing_amount: Number(cashCloseForm.closingAmount || 0),
        closed_by: cashCloseForm.closedBy || "Nao informado",
        closed_at: new Date(cashCloseForm.closedAt).toISOString(),
        status: "closed",
      })
      .eq("id", currentOpenCash.id);

    if (error) {
      toast.error("Falha ao fechar caixa.");
      return;
    }

    toast.success("Caixa fechado.");
    setCloseCashModal(false);
    setCashCloseForm({
      closingAmount: "",
      closedBy: "",
      closedAt: new Date().toISOString().slice(0, 16),
    });
    await load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Metricas, desempenho, caixa e visao geral do negocio.">
        <div className="flex gap-2">
          <Button onClick={() => setOpenCashModal(true)} className="gradient-primary text-primary-foreground">
            Abrir Caixa
          </Button>
          <Button variant="outline" onClick={() => setCloseCashModal(true)}>
            Fechar Caixa
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Agendamentos do dia" value={metrics.appointmentsToday} icon={<Calendar className="h-5 w-5" />} />
        <StatCard title="Clientes atendidos" value={metrics.clientsAttended} icon={<UserCheck className="h-5 w-5" />} />
        <StatCard title="Caixa do dia" value={toCurrency(metrics.caixaDia)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Contas a receber do dia" value={toCurrency(metrics.receivableToday)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Contas a pagar do dia" value={toCurrency(metrics.payableToday)} icon={<ShoppingBag className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="glass-card rounded-xl p-5 xl:col-span-2">
          <h2 className="font-display font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Faturamento por dia (7 dias)
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={faturamentoPorDia}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 15% 90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => toCurrency(Number(value))} />
              <Bar dataKey="value" fill="hsl(346 60% 55%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5 space-y-4">
          <h2 className="font-display font-semibold">Destaques de desempenho</h2>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Servicos mais realizados no dia</p>
            {serviceTopDay.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados hoje.</p> : (
              <ul className="space-y-1 text-sm">
                {serviceTopDay.map(([name, total]) => <li key={`day-${name}`}>{name} ({total})</li>)}
              </ul>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Servicos mais realizados no mes</p>
            {serviceTopMonth.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados no mes.</p> : (
              <ul className="space-y-1 text-sm">
                {serviceTopMonth.map(([name, total]) => <li key={`month-${name}`}>{name} ({total})</li>)}
              </ul>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Profissional que mais atendeu hoje</p>
            <p className="font-medium">{topProfessionalToday?.professionalName ?? "Sem dados hoje"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-3">Servicos mais realizados</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={serviceTopMonth.map(([name, value]) => ({ name, value }))} dataKey="value" nameKey="name" outerRadius={80}>
                {serviceTopMonth.map((_, index) => <Cell key={`svc-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-3">Atendimentos por profissional</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={atendimentosPorProfissional}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 15% 90%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="hsl(200 60% 50%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-3">Formas de pagamento</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={formasPagamento} dataKey="value" nameKey="name" outerRadius={80}>
                {formasPagamento.map((_, index) => <Cell key={`pay-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: number) => toCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h3 className="font-display font-semibold mb-4">Ranking de funcionario do mes</h3>
        {rankingMonth.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados no periodo.</p> : (
          <div className="space-y-3">
            {rankingMonth.map((item, index) => (
              <div key={item.professionalId} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div className="flex items-center gap-3">
                  {item.photoUrl ? (
                    <img src={item.photoUrl} alt={item.professionalName} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
                      {item.professionalName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{index + 1}. {item.professionalName}</p>
                    <p className="text-xs text-muted-foreground">{item.totalAppointments} atendimentos</p>
                  </div>
                </div>
                <p className="font-semibold">{toCurrency(item.totalRevenue)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={openCashModal} onOpenChange={setOpenCashModal}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Abrir Caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor inicial (troco)</Label>
              <Input
                type="number"
                value={cashOpenForm.openingAmount}
                onChange={(event) => setCashOpenForm((prev) => ({ ...prev, openingAmount: event.target.value }))}
              />
            </div>
            <div>
              <Label>Quem abriu o caixa</Label>
              <Input
                value={cashOpenForm.openedBy}
                onChange={(event) => setCashOpenForm((prev) => ({ ...prev, openedBy: event.target.value }))}
              />
            </div>
            <div>
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={cashOpenForm.openedAt}
                onChange={(event) => setCashOpenForm((prev) => ({ ...prev, openedAt: event.target.value }))}
              />
            </div>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={() => void openCash()}>
              Confirmar abertura
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={closeCashModal} onOpenChange={setCloseCashModal}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Fechar Caixa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor final</Label>
              <Input
                type="number"
                value={cashCloseForm.closingAmount}
                onChange={(event) => setCashCloseForm((prev) => ({ ...prev, closingAmount: event.target.value }))}
              />
            </div>
            <div>
              <Label>Quem fechou o caixa</Label>
              <Input
                value={cashCloseForm.closedBy}
                onChange={(event) => setCashCloseForm((prev) => ({ ...prev, closedBy: event.target.value }))}
              />
            </div>
            <div>
              <Label>Data e hora</Label>
              <Input
                type="datetime-local"
                value={cashCloseForm.closedAt}
                onChange={(event) => setCashCloseForm((prev) => ({ ...prev, closedAt: event.target.value }))}
              />
            </div>
            <Button className="w-full gradient-primary text-primary-foreground" onClick={() => void closeCash()}>
              Confirmar fechamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
