import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import MessageHistoryDialog from "@/components/MessageHistoryDialog";
import { Plus, Search, Phone, Mail, Pencil, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { createId } from "@/lib/database";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  notes: string;
  allowWhatsapp: boolean;
};

const emptyForm = { name: "", phone: "", email: "", birthday: "", notes: "", allowWhatsapp: true };

export default function ClientsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  const loadClients = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone, email, birth_date, notes, accepts_messages")
        .order("name", { ascending: true });
      if (error) throw error;
      setClients((data ?? []).map((item) => ({
        id: String(item.id),
        name: String(item.name ?? ""),
        phone: String(item.phone ?? ""),
        email: String(item.email ?? ""),
        birthday: String(item.birth_date ?? ""),
        notes: String(item.notes ?? ""),
        allowWhatsapp: Boolean(item.accepts_messages ?? true),
      })));
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar clientes.");
    }
  };

  useEffect(() => {
    void loadClients();
  }, [user]);

  const filtered = useMemo(
    () => clients.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)),
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
    if (!user || !form.name || !form.phone) return toast.error("Preencha ao menos nome e telefone.");

    // Validate phone
    const cleanPhone = form.phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) return toast.error("Telefone inválido. Informe com DDD.");

    const body = {
      name: form.name,
      phone: form.phone,
      email: form.email || null,
      birth_date: form.birthday || null,
      notes: form.notes || null,
      accepts_messages: form.allowWhatsapp,
    };

    try {
      if (editingClientId) {
        const { error } = await supabase.from("clients").update(body).eq("id", editingClientId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert({ id: createId(), ...body });
        if (error) throw error;
      }

      toast.success(editingClientId ? "Cliente atualizado com sucesso." : "Cliente salvo com sucesso.");
      setEditingClientId(null);
      setForm(emptyForm);
      await loadClients();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar cliente.");
    }
  };

  const handleDelete = async (clientId: string) => {
    if (!window.confirm("Deseja deletar este cliente?")) return;

    try {
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) throw error;
      toast.success("Cliente deletado com sucesso.");
      await loadClients();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao deletar cliente.");
    }
  };

  const ClientFormFields = () => (
    <div className="space-y-4 mt-2">
      <div><Label>Nome completo</Label><Input placeholder="Nome" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></div>
      <div><Label>Telefone (WhatsApp)</Label><Input placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} /></div>
      <div><Label>E-mail</Label><Input placeholder="email@email.com" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /></div>
      <div><Label>Data de nascimento</Label><Input type="date" value={form.birthday} onChange={(e) => setForm((s) => ({ ...s, birthday: e.target.value }))} /></div>
      <div><Label>Observações</Label><Textarea placeholder="Observações sobre o cliente..." value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></div>
      <div className="flex items-center gap-2">
        <Checkbox id="accepts-msg" checked={form.allowWhatsapp} onCheckedChange={(v) => setForm((s) => ({ ...s, allowWhatsapp: Boolean(v) }))} />
        <Label htmlFor="accepts-msg" className="text-sm">Aceita receber mensagens via WhatsApp</Label>
      </div>
      <Button onClick={() => void handleSave()} className="w-full gradient-primary text-primary-foreground">{editingClientId ? "Salvar alterações" : "Cadastrar"}</Button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Clientes" description="Cadastro e histórico de clientes">
        <Dialog>
          <DialogTrigger asChild><Button onClick={openCreate} className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" /> Novo Cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingClientId ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Nome completo</Label><Input placeholder="Nome" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></div>
              <div><Label>Telefone (WhatsApp)</Label><Input placeholder="(11) 99999-9999" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} /></div>
              <div><Label>E-mail</Label><Input placeholder="email@email.com" type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /></div>
              <div><Label>Aniversário</Label><Input type="date" value={form.birthday} onChange={(e) => setForm((s) => ({ ...s, birthday: e.target.value }))} /></div>
              <div className="flex items-center justify-between rounded-md border p-3"><Label>Permitir WhatsApp</Label><Switch checked={form.allowWhatsapp} onCheckedChange={(checked) => setForm((s) => ({ ...s, allowWhatsapp: checked }))} /></div>
              <div><Label>Observações</Label><Textarea placeholder="Observações sobre o cliente..." value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></div>
              <Button onClick={() => void handleSave()} className="w-full gradient-primary text-primary-foreground">{editingClientId ? "Salvar alterações" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="mb-6"><div className="relative max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" /></div></div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((client, i) => (
          <motion.div key={client.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                  {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-sm">{client.name}</p>
                  {client.allowWhatsapp && <span className="text-xs text-success">✓ WhatsApp</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <MessageHistoryDialog clientId={client.id} clientName={client.name} />
                <Dialog>
                  <DialogTrigger asChild><Button variant="ghost" size="icon" onClick={() => openEdit(client)}><Pencil className="h-4 w-4" /></Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle className="font-display">Editar Cliente</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div><Label>Nome completo</Label><Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></div>
                      <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} /></div>
                      <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /></div>
                      <div><Label>Aniversário</Label><Input type="date" value={form.birthday} onChange={(e) => setForm((s) => ({ ...s, birthday: e.target.value }))} /></div>
                      <div className="flex items-center justify-between rounded-md border p-3"><Label>Permitir WhatsApp</Label><Switch checked={form.allowWhatsapp} onCheckedChange={(checked) => setForm((s) => ({ ...s, allowWhatsapp: checked }))} /></div>
                      <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))} /></div>
                      <Button onClick={() => void handleSave()} className="w-full">Salvar alterações</Button>
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
            <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
              <span>Aniversário: {client.birthday || "-"}</span>
              <span>{client.allowWhatsapp ? "WhatsApp OK" : "Sem WhatsApp"}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
