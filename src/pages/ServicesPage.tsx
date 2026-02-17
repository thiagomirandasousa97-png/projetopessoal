import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Clock, DollarSign, Pencil, Trash2, FolderCog } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { createId, toCurrency } from "@/lib/database";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

type ServiceRow = {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  category: string;
};

const emptyForm = { name: "", durationMin: "", price: "", category: "" };

export default function ServicesPage() {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  const loadServices = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.from("services").select("id, name, duration_minutes, price, category, active").order("name", { ascending: true });
      if (error) throw error;
      setServices((data ?? []).map((item) => ({
        id: String(item.id),
        name: String(item.name ?? ""),
        durationMin: Number(item.duration_minutes ?? 0),
        price: Number(item.price ?? 0),
        category: String(item.category ?? "Geral"),
      })));
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar serviços.");
    }
  };

  useEffect(() => {
    void loadServices();
  }, [user]);

  const categories = useMemo(() => [...new Set(services.map((s) => s.category))].sort((a, b) => a.localeCompare(b)), [services]);
  const filtered = activeCategory ? services.filter((s) => s.category === activeCategory) : services;

  const openCreate = () => {
    setEditingServiceId(null);
    setForm(emptyForm);
  };

  const openEdit = (service: ServiceRow) => {
    setEditingServiceId(service.id);
    setForm({ name: service.name, durationMin: String(service.durationMin), price: String(service.price), category: service.category });
  };

  const handleSave = async () => {
    if (!user || !form.name || !form.durationMin || !form.price || !form.category) {
      return toast.error("Preencha todos os campos do serviço.");
    }

    const body = {
      name: form.name,
      duration_minutes: Number(form.durationMin),
      price: Number(form.price),
      category: form.category,
    };

    try {
      if (editingServiceId) {
        const { error } = await supabase.from("services").update(body).eq("id", editingServiceId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert({ id: createId(), ...body });
        if (error) throw error;
      }

      toast.success(editingServiceId ? "Serviço atualizado com sucesso." : "Serviço salvo com sucesso.");
      setEditingServiceId(null);
      setForm(emptyForm);
      await loadServices();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar serviço.");
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!window.confirm("Deseja deletar este serviço?")) return;

    try {
      const { error } = await supabase.from("services").delete().eq("id", serviceId);
      if (error) throw error;
      toast.success("Serviço deletado com sucesso.");
      await loadServices();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao deletar serviço.");
    }
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    setForm((prev) => ({ ...prev, category: newCategoryName.trim() }));
    setNewCategoryName("");
    toast.success("Categoria criada. Salve o serviço para persistir.");
  };

  const renameCategory = async (oldCategory: string) => {
    const next = window.prompt(`Novo nome para a categoria '${oldCategory}':`, oldCategory)?.trim();
    if (!next || next === oldCategory) return;

    try {
      const { error } = await supabase.from("services").update({ category: next }).eq("category", oldCategory);
      if (error) throw error;
      toast.success("Categoria renomeada.");
      await loadServices();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao renomear categoria.");
    }
  };

  const deleteCategory = async (category: string) => {
    const ok = window.confirm(`Excluir categoria '${category}'? Os serviços vão para 'Sem categoria'.`);
    if (!ok) return;

    try {
      const { error } = await supabase.from("services").update({ category: "Sem categoria" }).eq("category", category);
      if (error) throw error;
      toast.success("Categoria removida.");
      await loadServices();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir categoria.");
    }
  };

  return (
    <div>
      <PageHeader title="Serviços" description="Cadastre, edite e organize serviços e categorias.">
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild><Button onClick={openCreate} className="gradient-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" /> Novo Serviço</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">{editingServiceId ? "Editar Serviço" : "Novo Serviço"}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div><Label>Nome do serviço</Label><Input placeholder="Ex: Corte feminino" value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3"><div><Label>Duração (min)</Label><Input type="number" placeholder="45" value={form.durationMin} onChange={(e) => setForm((s) => ({ ...s, durationMin: e.target.value }))} /></div><div><Label>Preço (R$)</Label><Input type="number" placeholder="80.00" value={form.price} onChange={(e) => setForm((s) => ({ ...s, price: e.target.value }))} /></div></div>
                <div>
                  <Label>Categoria</Label>
                  <Input placeholder="Ex: Cabelo, Unhas, Estética" value={form.category} onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))} list="categories-list" />
                  <datalist id="categories-list">
                    {categories.map((category) => <option key={category} value={category} />)}
                  </datalist>
                </div>
                <Button onClick={() => void handleSave()} className="w-full gradient-primary text-primary-foreground">{editingServiceId ? "Salvar alterações" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild><Button variant="outline"><FolderCog className="h-4 w-4 mr-2" /> Categorias</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">Gerenciar categorias</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="flex gap-2">
                  <Input placeholder="Nova categoria" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                  <Button onClick={handleCreateCategory}>Adicionar</Button>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {categories.map((category) => (
                    <div key={category} className="flex items-center justify-between rounded border border-border px-3 py-2">
                      <span className="text-sm">{category}</span>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => void renameCategory(category)}>Renomear</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void deleteCategory(category)}>Excluir</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant={activeCategory === null ? "default" : "outline"} onClick={() => setActiveCategory(null)} className={cn(activeCategory === null && "gradient-primary text-primary-foreground")}>Todos</Button>
        {categories.map((category) => (
          <Button key={category} variant={activeCategory === category ? "default" : "outline"} onClick={() => setActiveCategory(category)} className={cn(activeCategory === category && "gradient-primary text-primary-foreground")}>{category}</Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((service, i) => (
          <motion.div key={service.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass-card rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between mb-3"><span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{service.category}</span><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(service)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => void handleDelete(service.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>
            <h3 className="font-display font-semibold mb-2">{service.name}</h3>
            <div className="space-y-1 text-sm"><p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{service.durationMin} min</p><p className="flex items-center gap-2 font-semibold text-primary"><DollarSign className="h-3.5 w-3.5" />{toCurrency(service.price)}</p></div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}