import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/components/ui/sonner";
import { toCurrency } from "@/lib/database";

type ProfessionalRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  commissionPercent: number;
};

type ProfessionalStats = { totalRevenue: number; appointmentCount: number };

const emptyForm = { name: "", email: "", phone: "", specialty: "", commissionPercentage: "0" };

export default function ProfessionalsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<ProfessionalRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, ProfessionalStats>>({});

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("professionals")
        .select("id, name, email, phone, specialties, commission_percent")
        .order("name", { ascending: true });
      if (error) throw error;
      setItems((data ?? []).map((p) => ({
        id: String(p.id),
        name: String(p.name ?? ""),
        email: String(p.email ?? ""),
        phone: String(p.phone ?? ""),
        specialty: (p.specialties ?? []).join(", "),
        commissionPercent: Number(p.commission_percent ?? 0),
      })));

      // Load stats
      const { data: appointments } = await supabase
        .from("appointments")
        .select("professional_id, status, services(price)")
        .eq("status", "completed");
      const statsMap: Record<string, ProfessionalStats> = {};
      for (const apt of appointments ?? []) {
        const pid = String(apt.professional_id);
        if (!statsMap[pid]) statsMap[pid] = { totalRevenue: 0, appointmentCount: 0 };
        const svc = Array.isArray(apt.services) ? apt.services[0] : apt.services;
        statsMap[pid].totalRevenue += Number((svc as any)?.price ?? 0);
        statsMap[pid].appointmentCount += 1;
      }
      setStats(statsMap);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar profissionais.");
      setItems([]);
    }
  };

  useEffect(() => {
    void load();
  }, [user]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); };

  const openEdit = (item: ProfessionalRow) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      email: item.email ?? "",
      phone: item.phone ?? "",
      specialty: item.specialty,
      commissionPercentage: String(item.commissionPercent),
    });
  };

  const save = async () => {
    if (!isAdmin) return toast.error("Apenas administradores podem salvar profissionais.");
    if (!form.name.trim()) return toast.error("Informe o nome do profissional.");

    try {
      const body = {
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        specialties: form.specialty ? form.specialty.split(",").map(s => s.trim()).filter(Boolean) : [],
        commission_percent: Number(form.commissionPercentage || 0),
      };
      if (editingId) {
        const { error } = await supabase.from("professionals").update(body).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("professionals").insert(body);
        if (error) throw error;
      }

      toast.success(editingId ? "Profissional atualizado." : "Profissional cadastrado.");
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível salvar o profissional.");
    }
  };

  const remove = async (id: string) => {
    if (!isAdmin) return toast.error("Apenas administradores podem excluir profissionais.");
    if (!window.confirm("Excluir este profissional?")) return;

    try {
      const { error } = await supabase.from("professionals").delete().eq("id", id);
      if (error) throw error;
      toast.success("Profissional excluído.");
      await load();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir profissional.");
    }
  };

  const FormFields = () => (
    <div className="space-y-3 mt-2">
      <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></div>
      <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /></div>
      <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} /></div>
      <div><Label>Especialidades (separadas por vírgula)</Label><Input value={form.specialty} onChange={(e) => setForm((s) => ({ ...s, specialty: e.target.value }))} /></div>
      <div><Label>Comissão (%)</Label><Input type="number" min="0" max="100" value={form.commissionPercentage} onChange={(e) => setForm((s) => ({ ...s, commissionPercentage: e.target.value }))} /></div>
      <Button className="w-full gradient-primary text-primary-foreground" disabled={!isAdmin} onClick={() => void save()}>{editingId ? "Salvar" : "Cadastrar"}</Button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Profissionais" description="Cadastre e gerencie comissões e especialidades.">
        <Dialog>
          <DialogTrigger asChild><Button onClick={openCreate} disabled={!isAdmin} className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Novo profissional</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingId ? "Editar profissional" : "Novo profissional"}</DialogTitle></DialogHeader>
            <FormFields />
          </DialogContent>
        </Dialog>
      </PageHeader>

      {!isAdmin && (
        <p className="text-sm text-muted-foreground mb-4">
          Você possui acesso somente leitura. Para cadastrar ou editar profissionais, solicite permissão de administrador.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => {
          const s = stats[item.id];
          const commission = s ? s.totalRevenue * (item.commissionPercent / 100) : 0;

          return (
            <Card key={item.id} className="glass-card hover:shadow-md transition-shadow">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                      {item.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.email || "-"} • {item.phone || "-"}</p>
                      {item.specialty && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.specialty.split(",").map((spec) => (
                            <span key={spec.trim()} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{spec.trim()}</span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-primary mt-1">Comissão: {item.commissionPercent}%</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Dialog>
                      <DialogTrigger asChild><Button variant="ghost" size="icon" disabled={!isAdmin} onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle className="font-display">Editar profissional</DialogTitle></DialogHeader>
                        <FormFields />
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="icon" disabled={!isAdmin} onClick={() => void remove(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
                {s && (
                  <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground flex justify-between">
                    <span>{s.appointmentCount} atendimentos</span>
                    <span>Faturado: {toCurrency(s.totalRevenue)}</span>
                    {item.commissionPercent > 0 && <span>Comissão: {toCurrency(commission)}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
