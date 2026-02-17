import { useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, DollarSign, Users, Wallet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { toCurrency } from "@/lib/database";
import { paymentMethodLabel } from "@/lib/payments";

type ReceivableRow = {
  amount: number;
  status: string;
  due_date: string;
  paid_at: string | null;
  payment_method: string | null;
  client_id: string | null;
};

type AppointmentRow = {
  status: string;
  start_time: string;
};

export default function Dashboard() {
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);

  const load = async () => {
    const [receivablesRes, appointmentsRes] = await Promise.all([
      supabase.from("financial_receivables").select("amount, status, due_date, paid_at, payment_method, client_id"),
      supabase.from("appointments").select("status, start_time"),
    ]);

    if (!receivablesRes.error) {
      setReceivables(
        (receivablesRes.data ?? []).map((item) => ({
          amount: Number(item.amount ?? 0),
          status: String(item.status ?? "pending"),
          due_date: String(item.due_date ?? ""),
          paid_at: item.paid_at ? String(item.paid_at) : null,
          payment_method: item.payment_method ? String(item.payment_method) : null,
          client_id: item.client_id ? String(item.client_id) : null,
        })),
      );
    }

    if (!appointmentsRes.error) {
      setAppointments(
        (appointmentsRes.data ?? []).map((item) => ({
          status: String(item.status ?? "scheduled"),
          start_time: String(item.start_time ?? ""),
        })),
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  const metrics = useMemo(() => {
    const pendingReceivables = receivables.filter((item) => item.status === "pending");
    const totalToReceive = pendingReceivables.reduce((acc, item) => acc + item.amount, 0);

    const receivedToday = receivables
      .filter((item) => item.status === "paid" && String(item.paid_at ?? "").slice(0, 10) === today)
      .reduce((acc, item) => acc + item.amount, 0);

    const delinquentClientIds = new Set(
      pendingReceivables
        .filter((item) => item.due_date && item.due_date < today)
        .map((item) => item.client_id)
        .filter((id): id is string => Boolean(id)),
    );

    const appointmentsToday = appointments.filter((item) => item.start_time.slice(0, 10) === today);
    const completedToday = appointmentsToday.filter((item) => item.status === "completed");

    const paymentsByMethod = receivables
      .filter((item) => item.status === "paid" && String(item.paid_at ?? "").slice(0, 10) === today)
      .reduce<Record<string, number>>((acc, item) => {
        const method = item.payment_method ?? "nao_informado";
        acc[method] = (acc[method] ?? 0) + item.amount;
        return acc;
      }, {});

    return {
      totalToReceive,
      receivedToday,
      delinquentClients: delinquentClientIds.size,
      appointmentsToday: appointmentsToday.length,
      completedToday: completedToday.length,
      paymentsByMethod,
    };
  }, [appointments, receivables, today]);

  const paymentEntries = Object.entries(metrics.paymentsByMethod);

  return (
    <div className="space-y-6">
      <PageHeader title="Inicio" description="Resumo do dia com dados reais de agenda e financeiro." />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <StatCard title="Total a receber" value={toCurrency(metrics.totalToReceive)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="Valores recebidos no dia" value={toCurrency(metrics.receivedToday)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Clientes inadimplentes" value={metrics.delinquentClients} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Agendamentos do dia" value={metrics.appointmentsToday} icon={<Calendar className="h-5 w-5" />} />
        <StatCard title="Atendimentos finalizados" value={metrics.completedToday} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="font-display font-semibold mb-3">Entradas por forma de pagamento (hoje)</h2>
        {paymentEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum recebimento hoje.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paymentEntries.map(([method, value]) => (
              <div key={method} className="rounded-lg border border-border/60 p-3">
                <p className="text-sm text-muted-foreground">{paymentMethodLabel(method)}</p>
                <p className="font-semibold">{toCurrency(value)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
