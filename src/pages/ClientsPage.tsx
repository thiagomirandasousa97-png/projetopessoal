import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MessageHistoryDialog from "@/components/MessageHistoryDialog";
import { Plus, Search, Phone, Mail, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { createId, toCurrency } from "@/lib/database";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import PaymentMethodFields from "@/components/PaymentMethodFields";
import { type PaymentMethod } from "@/lib/payments";
import { cn } from "@/lib/utils";

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  notes: string;
  allowWhatsapp: boolean;
  overdueDays: number;
  overdueCount: number;
};

type ReceivableRow = {
  id: string;
  client_id: string | null;
  appointment_id: string | null;
  description: string;
  service_name: string | null;
  amount: number;
  due_date: string;
  status: string;
};

const emptyForm = { name: "", phone: "", email: "", birthday: "", notes: "", allowWhatsapp: true };

function delinquencyTone(days: number) {
  if (days > 30) return "danger";
  if (days >= 20) return "warning";
  return "ok";
}

export default function ClientsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientRow | null>(null);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");

  const loadData = async () => {
    if (!user) return;

    const [clientsRes, receivablesRes] = await Promise.all([
      supabase.from("clients").select("id, name, phone, email, birth_date, notes, accepts_messages").order("name", { ascending: true }),
      supabase
        .from("financial_receivables")
        .select("id, client_id, appointment_id, description, service_name, amount, due_date, status")
        .order("due_date", { ascending: true }),
    ]);

    if (clientsRes.error) {
      toast.error("Erro ao carregar clientes.");
      return;
    }
    if (receivablesRes.error) {
      toast.error("Erro ao carregar inadimplencia.");
      return;
    }

    const allReceivables = (receivablesRes.data ?? []).map((item) => ({
      id: String(item.id),
      client_id: item.client_id ? String(item.client_id) : null,
      appointment_id: item.appointment_id ? String(item.appointment_id) : null,
      description: String(item.description ?? ""),
      service_name: item.service_name ? String(item.service_name) : null,
      amount: Number(item.amount ?? 0),
      due_date: String(item.due_date ?? ""),
      status: String(item.status ?? "pending"),
    }));
    setReceivables(allReceivables);

    const today = new Date().toISOString().slice(0, 10);
    const byClient = allReceivables.reduce<Record<string, ReceivableRow[]>>((acc, item) => {
      if (!item.client_id) return acc;
      if (!acc[item.client_id]) acc[item.client_id] = [];
      acc[item.client_id].push(item);
      return acc;
    }, {});

    setClients((clientsRes.data ?? []).map((item) => {
      const clientReceivables = byClient[String(item.id)] ?? [];
      const overdue = clientReceivables.filter((row) => row.status === "pending" && row.due_date < today);
      const maxOverdueDays = overdue.reduce((max, row) => {
        const days = Math.floor((Date.now() - new Date(`${row.due_date}T00:00:00`).getTime()) / 86400000);
        return Math.max(max, Math.max(0, days));
      }, 0);

      return {
        id: String(item.id),
        name: String(item.name ?? ""),
        phone: String(item.phone ?? ""),
        email: String(item.email ?? ""),
        birthday: String(item.birth_date ?? ""),
        notes: String(item.notes ?? ""),
        allowWhatsapp: Boolean(item.accepts_messages ?? true),
        overdueDays: maxOverdueDays,
        overdueCount: overdue.length,
      };
    }));
  };

  useEffect(() => {
    void loadData();
  }, [user]);

  const filtered = useMemo(
    () => clients.filter((client) => client.name.toLowerCase().includes(search.toLowerCase()) || client.phone.includes(search)),
    [clients, search],
  );

  const openCreate = () => {
    setEditingClientId(null);
    setForm(emptyForm);
  };

  const openEdit = (client: ClientRow) => {
    setEditingClientId(client.id);
    setForm({
      name: client.name,
      phone: client.phone,
      email: client.email,
      birthday: client.birthday,
      notes: client.notes || "",
      allowWhatsapp: client.allowWhatsapp,
    });
  };

  const handleSave = async () => {
    if (!user || !form.name || !form.phone) {
      toast.error("Preencha ao menos nome e telefone.");
      return;
    }

    const cleanPhone = form.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Telefone invalido. Informe com DDD.");
      return;
    }

    const body = {
      name: form.name,
      phone: form.phone,
      email: form.email || null,
      birth_date: form.birthday || null,
      notes: form.notes || null,
      accepts_messages: form.allowWhatsapp,
    };

    const result = editingClientId
      ? await supabase.from("clients").update(body).eq("id", editingClientId)
      : await supabase.from("clients").insert({ id: createId(), ...body });

    if (result.error) {
      toast.error("Erro ao salvar cliente.");
      return;
    }

    toast.success(editingClientId ? "Cliente atualizado com sucesso." : "Cliente salvo com sucesso.");
    setEditingClientId(null);
    setForm(emptyForm);
    await loadData();
  };

  const handleDelete = async (clientId: string) => {
    if (!window.confirm("Deseja deletar este cliente?")) return;

    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) {
      toast.error("Erro ao deletar cliente.");
      return;
    }

    toast.success("Cliente deletado com sucesso.");
    await loadData();
  };

  const openReceivePayment = (client: ClientRow) => {
    setSelectedClient(client);
    setReceiveOpen(true);
    const firstPending = receivables.find((item) => item.client_id === client.id && item.status === "pending");
    setSelectedReceivableId(firstPending?.id ?? "");
  };

  const settleReceivable = async () => {
    if (!selectedReceivableId) {
      toast.error("Selecione um lancamento pendente.");
      return;
    }
    if (paymentMethod === "account") {
      toast.error("Para receber agora, escolha pix, dinheiro ou cartao.");
      return;
    }

    const receivable = receivables.find((item) => item.id === selectedReceivableId);
    if (!receivable) {
      toast.error("Lancamento nao encontrado.");
      return;
    }

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("financial_receivables")
      .update({ status: "paid", payment_method: paymentMethod, paid_at: now })
      .eq("id", selectedReceivableId);

    if (error) {
      toast.error("Nao foi possivel receber pagamento.");
      return;
    }

    if (receivable.appointment_id) {
      await supabase
        .from("appointments")
        .update({ payment_status: "paid", payment_method: paymentMethod, paid_at: now })
        .eq("id", receivable.appointment_id);
    }

    toast.success("Pagamento recebido.");
    setReceiveOpen(false);
    await loadData();
  };

  const pendingForSelectedClient = selectedClient
    ? receivables.filter((item) => item.client_id === selectedClient.id && item.status === "pending")
    : [];

  return (
    <div>
      <PageHeader title="Clientes" description="Cadastro, historico e controle de inadimplencia.">
        <Dialog>
          <DialogTrigger asChild><Button onClick={openCreate} className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" /> Novo Cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingClientId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Nome completo</Label><Input placeholder="Nome" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
              <div><Label>Telefone (WhatsApp)</Label><Input placeholder="(11) 99999-9999" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} /></div>
              <div><Label>E-mail</Label><Input placeholder="email@email.com" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} /></div>
              <div><Label>Aniversario</Label><Input type="date" value={form.birthday} onChange={(event) => setForm((prev) => ({ ...prev, birthday: event.target.value }))} /></div>
              <div className="flex items-center justify-between rounded-md border p-3"><Label>Permitir WhatsApp</Label><Switch checked={form.allowWhatsapp} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allowWhatsapp: checked }))} /></div>
              <div><Label>Observacoes</Label><Textarea placeholder="Observacoes sobre o cliente..." value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
              <Button onClick={() => void handleSave()} className="w-full gradient-primary text-primary-foreground">{editingClientId ? "Salvar alteracoes" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client, index) => {
          const tone = delinquencyTone(client.overdueDays);
          return (
            <motion.div
              key={client.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "glass-card rounded-xl p-5 hover:shadow-md transition-shadow border",
                tone === "danger" ? "border-destructive/40 bg-destructive/5" : tone === "warning" ? "border-warning/40 bg-warning/5" : "border-success/30",
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                    {client.name.split(" ").map((namePart) => namePart[0]).join("").slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{client.name}</p>
                    {client.allowWhatsapp ? <span className="text-xs text-success">WhatsApp</span> : null}
                  </div>
                </div>
                <div className="flex gap-1">
                  <MessageHistoryDialog clientId={client.id} clientName={client.name} />
                  <Dialog>
                    <DialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => openEdit(client)}><Pencil className="h-4 w-4" /></Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle className="font-display">Editar Cliente</DialogTitle></DialogHeader>
                      <div className="space-y-4 mt-2">
                        <div><Label>Nome completo</Label><Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
                        <div><Label>Telefone</Label><Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} /></div>
                        <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} /></div>
                        <div><Label>Aniversario</Label><Input type="date" value={form.birthday} onChange={(event) => setForm((prev) => ({ ...prev, birthday: event.target.value }))} /></div>
                        <div className="flex items-center justify-between rounded-md border p-3"><Label>Permitir WhatsApp</Label><Switch checked={form.allowWhatsapp} onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allowWhatsapp: checked }))} /></div>
                        <div><Label>Observacoes</Label><Textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} /></div>
                        <Button onClick={() => void handleSave()} className="w-full">Salvar alteracoes</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" size="icon" onClick={() => void handleDelete(client.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>

              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /><span>{client.phone}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /><span className="truncate">{client.email || "-"}</span></div>
              </div>

              <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Aniversario: {client.birthday || "-"}</span>
                  <span>{client.overdueCount > 0 ? `${client.overdueCount} em aberto` : "Em dia"}</span>
                </div>
                <div className={cn(
                  "font-medium",
                  tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-success",
                )}>
                  {tone === "danger"
                    ? `Atraso alto (${client.overdueDays} dias)`
                    : tone === "warning"
                      ? `Atraso moderado (${client.overdueDays} dias)`
                      : "Sem atraso relevante"}
                </div>
              </div>

              {client.overdueCount > 0 ? (
                <Button className="w-full mt-3 gradient-primary text-primary-foreground" onClick={() => openReceivePayment(client)}>
                  Receber pagamento
                </Button>
              ) : null}
            </motion.div>
          );
        })}
      </div>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Receber pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Lancamento pendente</Label>
              <Select value={selectedReceivableId} onValueChange={setSelectedReceivableId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pendingForSelectedClient.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.service_name || item.description} - {toCurrency(item.amount)} - vence {item.due_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <PaymentMethodFields
              method={paymentMethod}
              onMethodChange={setPaymentMethod}
              expectedDate={new Date().toISOString().slice(0, 10)}
              onExpectedDateChange={() => {}}
              showExpectedDateForAccount={false}
            />

            <Button className="w-full gradient-primary text-primary-foreground" onClick={() => void settleReceivable()}>
              Confirmar recebimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
