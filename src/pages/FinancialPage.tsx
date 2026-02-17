import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import StatCard from "@/components/StatCard";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toCurrency } from "@/lib/database";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { paymentMethodLabel } from "@/lib/payments";

type ReceivableRow = {
  id: string;
  appointmentId: string | null;
  clientId: string | null;
  clientName: string;
  serviceName: string;
  description: string;
  amount: number;
  launchDate: string;
  serviceDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  paymentMethod: string;
};

type PayableRow = {
  id: string;
  description: string;
  category: string;
  amount: number;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
};

type CashSessionRow = {
  id: string;
  openingAmount: number;
  closingAmount: number | null;
  openedBy: string;
  closedBy: string | null;
  openedAt: string;
  closedAt: string | null;
  status: "open" | "closed";
};

function normalizeStatus(value: unknown, dueDate: string): "paid" | "pending" | "overdue" {
  const status = String(value ?? "").toLowerCase();
  if (status === "paid" || status === "pago") return "paid";
  if (status === "overdue" || status === "vencido") return "overdue";
  if (dueDate && status !== "paid" && dueDate < new Date().toISOString().slice(0, 10)) return "overdue";
  return "pending";
}

export default function FinancialPage() {
  const { user } = useAuth();
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [payables, setPayables] = useState<PayableRow[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSessionRow[]>([]);
  const [newPayable, setNewPayable] = useState({ description: "", value: "", date: "", category: "Fixa" });

  const load = async () => {
    if (!user) return;

    const [receivablesRes, payablesRes, cashRes] = await Promise.all([
      supabase
        .from("financial_receivables")
        .select("id, appointment_id, client_id, client_name, service_name, description, amount, created_at, service_date, due_date, status, payment_method")
        .order("created_at", { ascending: false }),
      supabase.from("financial_payables").select("id, description, amount, due_date, status, category").order("created_at", { ascending: false }),
      supabase
        .from("cash_sessions")
        .select("id, opening_amount, closing_amount, opened_by, closed_by, opened_at, closed_at, status")
        .order("opened_at", { ascending: false }),
    ]);

    if (!receivablesRes.error) {
      setReceivables(
        (receivablesRes.data ?? []).map((item) => ({
          id: String(item.id),
          appointmentId: item.appointment_id ? String(item.appointment_id) : null,
          clientId: item.client_id ? String(item.client_id) : null,
          clientName: String(item.client_name ?? "Nao informado"),
          serviceName: String(item.service_name ?? "Nao informado"),
          description: String(item.description ?? ""),
          amount: Number(item.amount ?? 0),
          launchDate: String(item.created_at ?? "").slice(0, 10),
          serviceDate: String(item.service_date ?? ""),
          dueDate: String(item.due_date ?? ""),
          status: normalizeStatus(item.status, String(item.due_date ?? "")),
          paymentMethod: String(item.payment_method ?? ""),
        })),
      );
    }

    if (!payablesRes.error) {
      setPayables(
        (payablesRes.data ?? []).map((item) => ({
          id: String(item.id),
          description: String(item.description ?? ""),
          category: String(item.category ?? "Geral"),
          amount: Number(item.amount ?? 0),
          dueDate: String(item.due_date ?? ""),
          status: normalizeStatus(item.status, String(item.due_date ?? "")),
        })),
      );
    }

    if (!cashRes.error) {
      setCashSessions(
        (cashRes.data ?? []).map((item) => ({
          id: String(item.id),
          openingAmount: Number(item.opening_amount ?? 0),
          closingAmount: item.closing_amount === null ? null : Number(item.closing_amount),
          openedBy: String(item.opened_by ?? ""),
          closedBy: item.closed_by ? String(item.closed_by) : null,
          openedAt: String(item.opened_at ?? ""),
          closedAt: item.closed_at ? String(item.closed_at) : null,
          status: (String(item.status ?? "open") === "closed" ? "closed" : "open"),
        })),
      );
    }
  };

  useEffect(() => {
    void load();
  }, [user]);

  const totals = useMemo(() => {
    const incomes = receivables.reduce((acc, item) => acc + item.amount, 0);
    const paidIncomes = receivables.filter((item) => item.status === "paid").reduce((acc, item) => acc + item.amount, 0);
    const expenses = payables.reduce((acc, item) => acc + item.amount, 0);
    const paidExpenses = payables.filter((item) => item.status === "paid").reduce((acc, item) => acc + item.amount, 0);
    return { incomes, expenses, profit: paidIncomes - paidExpenses };
  }, [payables, receivables]);

  const pendingDebts = useMemo(
    () => receivables.filter((item) => item.status !== "paid").map((item) => ({
      ...item,
      overdueDays: item.dueDate ? Math.max(0, Math.floor((Date.now() - new Date(`${item.dueDate}T00:00:00`).getTime()) / 86400000)) : 0,
    })),
    [receivables],
  );

  const markReceivableAsPaid = async (row: ReceivableRow) => {
    const now = new Date().toISOString();
    const { error } = await supabase.from("financial_receivables").update({ status: "paid", paid_at: now }).eq("id", row.id);
    if (error) return;

    if (row.appointmentId) {
      await supabase.from("appointments").update({ payment_status: "paid", paid_at: now }).eq("id", row.appointmentId);
    }

    await load();
  };

  const markPayableAsPaid = async (id: string) => {
    await supabase.from("financial_payables").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
    await load();
  };

  const addPayable = async () => {
    if (!newPayable.description || !newPayable.value || !newPayable.date) return;

    await supabase.from("financial_payables").insert({
      description: newPayable.description,
      amount: Number(newPayable.value),
      due_date: newPayable.date,
      category: newPayable.category,
      status: "pending",
    });

    setNewPayable({ description: "", value: "", date: "", category: "Fixa" });
    await load();
  };

  return (
    <div>
      <PageHeader title="Financeiro" description="Controle de contas a receber, contas a pagar e inadimplencia." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Entradas" value={toCurrency(totals.incomes)} icon={<ArrowUpCircle className="h-5 w-5" />} />
        <StatCard title="Saidas" value={toCurrency(totals.expenses)} icon={<ArrowDownCircle className="h-5 w-5" />} />
        <StatCard title="Saldo" value={toCurrency(totals.profit)} icon={<Wallet className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="receivables" className="glass-card rounded-xl p-5">
        <TabsList className="mb-4">
          <TabsTrigger value="receivables">Contas a Receber</TabsTrigger>
          <TabsTrigger value="payables">Contas a Pagar</TabsTrigger>
          <TabsTrigger value="debtors">Inadimplencia</TabsTrigger>
          <TabsTrigger value="cash">Caixa</TabsTrigger>
        </TabsList>

        <TabsContent value="receivables" className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2">De quem</th>
                  <th className="pb-2">Servico</th>
                  <th className="pb-2">Valor</th>
                  <th className="pb-2">Lancamento</th>
                  <th className="pb-2">Previsto</th>
                  <th className="pb-2">Situacao</th>
                  <th className="pb-2">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((row, index) => (
                  <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.02 }} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3">
                      <p className="font-medium">{row.clientName}</p>
                      <p className="text-xs text-muted-foreground">{row.description}</p>
                    </td>
                    <td className="py-3">{row.serviceName}</td>
                    <td className="py-3 font-semibold">{toCurrency(row.amount)}</td>
                    <td className="py-3">{row.launchDate || "-"}</td>
                    <td className="py-3">{row.dueDate || "-"}</td>
                    <td className="py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", row.status === "paid" ? "bg-success/15 text-success" : row.status === "overdue" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>
                        {row.status === "paid" ? "Recebido" : row.status === "overdue" ? "Vencido" : "Pendente"}
                      </span>
                      {row.paymentMethod ? <p className="text-xs text-muted-foreground mt-1">{paymentMethodLabel(row.paymentMethod)}</p> : null}
                    </td>
                    <td className="py-3">
                      {row.status !== "paid" ? <Button size="sm" variant="outline" onClick={() => void markReceivableAsPaid(row)}>Receber</Button> : null}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="payables" className="space-y-4">
          <div className="grid md:grid-cols-5 gap-3">
            <Input placeholder="Descricao" value={newPayable.description} onChange={(event) => setNewPayable((prev) => ({ ...prev, description: event.target.value }))} />
            <Input placeholder="Categoria" value={newPayable.category} onChange={(event) => setNewPayable((prev) => ({ ...prev, category: event.target.value }))} />
            <Input type="number" placeholder="Valor" value={newPayable.value} onChange={(event) => setNewPayable((prev) => ({ ...prev, value: event.target.value }))} />
            <Input type="date" value={newPayable.date} onChange={(event) => setNewPayable((prev) => ({ ...prev, date: event.target.value }))} />
            <Button onClick={() => void addPayable()}>Adicionar</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2">Descricao</th>
                  <th className="pb-2">Categoria</th>
                  <th className="pb-2">Valor</th>
                  <th className="pb-2">Vencimento</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Acao</th>
                </tr>
              </thead>
              <tbody>
                {payables.map((row, index) => (
                  <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.02 }} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-medium">{row.description}</td>
                    <td className="py-3">{row.category}</td>
                    <td className="py-3 font-semibold">{toCurrency(row.amount)}</td>
                    <td className="py-3">{row.dueDate}</td>
                    <td className="py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", row.status === "paid" ? "bg-success/15 text-success" : row.status === "overdue" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>
                        {row.status === "paid" ? "Pago" : row.status === "overdue" ? "Vencido" : "Pendente"}
                      </span>
                    </td>
                    <td className="py-3">{row.status !== "paid" ? <Button size="sm" variant="outline" onClick={() => void markPayableAsPaid(row.id)}>Pagar</Button> : null}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="debtors">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2">Servico</th>
                  <th className="pb-2">Valor</th>
                  <th className="pb-2">Previsto</th>
                  <th className="pb-2">Dias em atraso</th>
                  <th className="pb-2">Sinal</th>
                </tr>
              </thead>
              <tbody>
                {pendingDebts.map((row) => (
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-medium">{row.clientName}</td>
                    <td className="py-3">{row.serviceName}</td>
                    <td className="py-3">{toCurrency(row.amount)}</td>
                    <td className="py-3">{row.dueDate}</td>
                    <td className="py-3">{row.overdueDays} dias</td>
                    <td className="py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", row.overdueDays > 30 ? "bg-destructive/15 text-destructive" : row.overdueDays >= 20 ? "bg-warning/15 text-warning" : "bg-success/15 text-success")}>
                        {row.overdueDays > 30 ? "Vermelho" : row.overdueDays >= 20 ? "Amarelo" : "Verde"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="cash">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2">Abertura</th>
                  <th className="pb-2">Quem abriu</th>
                  <th className="pb-2">Fechamento</th>
                  <th className="pb-2">Quem fechou</th>
                  <th className="pb-2">Valor inicial</th>
                  <th className="pb-2">Valor final</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {cashSessions.map((session) => (
                  <tr key={session.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3">{new Date(session.openedAt).toLocaleString("pt-BR")}</td>
                    <td className="py-3">{session.openedBy}</td>
                    <td className="py-3">{session.closedAt ? new Date(session.closedAt).toLocaleString("pt-BR") : "-"}</td>
                    <td className="py-3">{session.closedBy || "-"}</td>
                    <td className="py-3">{toCurrency(session.openingAmount)}</td>
                    <td className="py-3">{session.closingAmount === null ? "-" : toCurrency(session.closingAmount)}</td>
                    <td className="py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", session.status === "closed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
                        {session.status === "closed" ? "Fechado" : "Aberto"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
