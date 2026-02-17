import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpCircle, ArrowDownCircle, Wallet, CheckCircle } from "lucide-react";
import StatCard from "@/components/StatCard";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toCurrency } from "@/lib/database";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";

type FinanceRow = {
  id: string;
  description: string;
  value: number;
  date: string;
  status: "pago" | "pendente" | "vencido";
  payment?: string;
  category?: string;
};

function toStatus(value: unknown): "pago" | "pendente" | "vencido" {
  const s = String(value ?? "").toLowerCase();
  if (s === "paid" || s === "pago") return "pago";
  if (s === "overdue" || s === "vencido") return "vencido";
  return "pendente";
}

function daysOverdue(date: string) {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86400000));
}

export default function FinancialPage() {
  const { user } = useAuth();
  const [receivables, setReceivables] = useState<FinanceRow[]>([]);
  const [payables, setPayables] = useState<FinanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newReceivable, setNewReceivable] = useState({ description: "", value: "", date: "", payment: "pix" });
  const [newPayable, setNewPayable] = useState({ description: "", value: "", date: "", category: "Fixa" });

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    setLoadError(null);

    try {
      const [receivablesRes, payablesRes] = await Promise.all([
        supabase.from("financial_receivables").select("id, description, amount, due_date, status, payment_method").order("created_at", { ascending: false }),
        supabase.from("financial_payables").select("id, description, amount, due_date, status, category").order("created_at", { ascending: false }),
      ]);

      if (receivablesRes.error) throw receivablesRes.error;
      if (payablesRes.error) throw payablesRes.error;

      setReceivables((receivablesRes.data ?? []).map((item) => ({
        id: String(item.id),
        description: String(item.description ?? ""),
        value: Number(item.amount ?? 0),
        date: String(item.due_date ?? ""),
        status: toStatus(item.status),
        payment: String(item.payment_method ?? "conta"),
      })));

      setPayables((payablesRes.data ?? []).map((item) => ({
        id: String(item.id),
        description: String(item.description ?? "Despesa"),
        value: Number(item.amount ?? 0),
        date: String(item.due_date ?? ""),
        status: toStatus(item.status),
        category: String(item.category ?? "Geral"),
      })));
    } catch (err) {
      console.error("Erro ao carregar financeiro:", err);
      setLoadError("Não foi possível carregar o financeiro.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user]);

  const totals = useMemo(() => {
    const incomes = receivables.reduce((acc, item) => acc + item.value, 0);
    const paidIncomes = receivables.filter(r => r.status === "pago").reduce((acc, item) => acc + item.value, 0);
    const expenses = payables.reduce((acc, item) => acc + item.value, 0);
    const paidExpenses = payables.filter(p => p.status === "pago").reduce((acc, item) => acc + item.value, 0);
    return { incomes, paidIncomes, expenses, paidExpenses, profit: paidIncomes - paidExpenses };
  }, [payables, receivables]);

  const pendingDebts = useMemo(
    () => receivables.filter((r) => r.status !== "pago").map((r) => ({ ...r, overdueDays: daysOverdue(r.date) })),
    [receivables],
  );

  const markAsPaid = async (table: "financial_receivables" | "financial_payables", id: string) => {
    try {
      const { error } = await supabase.from(table).update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      toast.success("Marcado como pago.");
      await load();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao marcar como pago.");
    }
  };

  const addReceivable = async () => {
    if (!newReceivable.description || !newReceivable.value || !newReceivable.date) return toast.error("Preencha descrição, valor e vencimento.");

    const { error } = await supabase.from("financial_receivables").insert({
      description: newReceivable.description,
      amount: Number(newReceivable.value),
      due_date: newReceivable.date,
      payment_method: newReceivable.payment,
      status: "pending",
    });

    if (error) {
      toast.error("Erro ao criar conta a receber.");
      return;
    }

    setNewReceivable({ description: "", value: "", date: "", payment: "pix" });
    toast.success("Conta a receber cadastrada.");
    await load();
  };

  const addPayable = async () => {
    if (!newPayable.description || !newPayable.value || !newPayable.date) return toast.error("Preencha descrição, valor e vencimento.");

    const { error } = await supabase.from("financial_payables").insert({
      description: newPayable.description,
      amount: Number(newPayable.value),
      due_date: newPayable.date,
      category: newPayable.category,
      status: "pending",
    });

    if (error) {
      toast.error("Erro ao criar conta a pagar.");
      return;
    }

    setNewPayable({ description: "", value: "", date: "", category: "Fixa" });
    toast.success("Conta a pagar cadastrada.");
    await load();
  };

  return (
    <div>
      <PageHeader title="Financeiro" description="Controle de caixa, contas a pagar e contas a receber" />

      {isLoading ? <p className="text-sm text-muted-foreground mb-4">Carregando dados financeiros...</p> : null}
      {loadError ? <p className="text-sm text-destructive mb-4">{loadError}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard title="Entradas" value={toCurrency(totals.incomes)} icon={<ArrowUpCircle className="h-5 w-5" />} />
        <StatCard title="Saídas" value={toCurrency(totals.expenses)} icon={<ArrowDownCircle className="h-5 w-5" />} />
        <StatCard title="Saldo" value={toCurrency(totals.profit)} icon={<Wallet className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="receivables" className="glass-card rounded-xl p-5">
        <TabsList className="mb-4"><TabsTrigger value="receivables">Contas a Receber</TabsTrigger><TabsTrigger value="payables">Contas a Pagar</TabsTrigger><TabsTrigger value="debtors">Inadimplência</TabsTrigger></TabsList>

        <TabsContent value="receivables" className="space-y-4">
          <div className="grid md:grid-cols-5 gap-3">
            <Input placeholder="Descrição" value={newReceivable.description} onChange={(e) => setNewReceivable((s) => ({ ...s, description: e.target.value }))} />
            <Select value={newReceivable.payment} onValueChange={(v) => setNewReceivable((s) => ({ ...s, payment: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="conta">Conta</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Valor" value={newReceivable.value} onChange={(e) => setNewReceivable((s) => ({ ...s, value: e.target.value }))} />
            <Input type="date" value={newReceivable.date} onChange={(e) => setNewReceivable((s) => ({ ...s, date: e.target.value }))} />
            <Button onClick={() => void addReceivable()}>Adicionar</Button>
          </div>
          {receivables.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conta a receber cadastrada.</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Descrição</th><th className="pb-2">Valor</th><th className="pb-2">Vencimento</th><th className="pb-2">Pagamento</th><th className="pb-2">Status</th><th className="pb-2">Ação</th></tr></thead>
              <tbody>
                {receivables.map((r, i) => (
                  <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-medium">{r.description}</td>
                    <td className="py-3 font-semibold">{toCurrency(r.value)}</td>
                    <td className="py-3">{r.date}</td>
                    <td className="py-3">{r.payment}</td>
                    <td className="py-3"><span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", r.status === "pago" ? "bg-success/15 text-success" : r.status === "vencido" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>{r.status === "pago" ? "Pago" : r.status === "vencido" ? "Vencido" : "Pendente"}</span></td>
                    <td className="py-3">{r.status !== "pago" && <Button size="sm" variant="outline" onClick={() => void markAsPaid("financial_receivables", r.id)}>Pagar</Button>}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="payables" className="space-y-4">
          <div className="grid md:grid-cols-5 gap-3">
            <Input placeholder="Descrição" value={newPayable.description} onChange={(e) => setNewPayable((s) => ({ ...s, description: e.target.value }))} />
            <Input placeholder="Categoria" value={newPayable.category} onChange={(e) => setNewPayable((s) => ({ ...s, category: e.target.value }))} />
            <Input type="number" placeholder="Valor" value={newPayable.value} onChange={(e) => setNewPayable((s) => ({ ...s, value: e.target.value }))} />
            <Input type="date" value={newPayable.date} onChange={(e) => setNewPayable((s) => ({ ...s, date: e.target.value }))} />
            <Button onClick={() => void addPayable()}>Adicionar</Button>
          </div>
          {payables.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma conta a pagar cadastrada.</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Descrição</th><th className="pb-2">Categoria</th><th className="pb-2">Valor</th><th className="pb-2">Vencimento</th><th className="pb-2">Status</th><th className="pb-2">Ação</th></tr></thead>
              <tbody>
                {payables.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-medium">{p.description}</td>
                    <td className="py-3">{p.category}</td>
                    <td className="py-3 font-semibold">{toCurrency(p.value)}</td>
                    <td className="py-3">{p.date}</td>
                    <td className="py-3"><span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", p.status === "pago" ? "bg-success/15 text-success" : p.status === "vencido" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>{p.status === "pago" ? "Pago" : p.status === "vencido" ? "Vencido" : "Pendente"}</span></td>
                    <td className="py-3">{p.status !== "pago" && <Button size="sm" variant="outline" onClick={() => void markAsPaid("financial_payables", p.id)}>Pagar</Button>}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="debtors">
          {pendingDebts.length === 0 ? <p className="text-sm text-muted-foreground">Sem inadimplência no momento.</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Descrição</th><th className="pb-2">Valor</th><th className="pb-2">Vencimento</th><th className="pb-2">Dias devendo</th><th className="pb-2">Sinal</th></tr></thead>
              <tbody>
                {pendingDebts.map((d) => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-medium">{d.description}</td>
                    <td className="py-3">{toCurrency(d.value)}</td>
                    <td className="py-3">{d.date}</td>
                    <td className="py-3 font-semibold">{d.overdueDays} dias</td>
                    <td className="py-3"><span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", d.overdueDays >= 30 ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>{d.overdueDays >= 30 ? "Crítico" : "Atenção"}</span></td>
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
