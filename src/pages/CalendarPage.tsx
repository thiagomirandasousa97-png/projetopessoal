import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/components/ui/sonner";
import { generateMessage, sendWhatsAppMessage } from "@/lib/whatsapp";

type CalendarAppointment = {
  id: string;
  date: string;
  time: string;
  client: string;
  clientId: string;
  clientPhone: string;
  service: string;
  serviceId: string;
  professional: string;
  professionalId: string;
  status: "scheduled" | "confirmed" | "rescheduled" | "cancelled" | "completed";
};

type LookupItem = { id: string; name: string };
type ClientLookup = { id: string; name: string; phone: string; acceptsMessages: boolean };

const hours = Array.from({ length: 12 }, (_, i) => `${(i + 7).toString().padStart(2, "0")}:00`);

const statusLabels: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  present: "Presente",
  completed: "Finalizado",
  rescheduled: "Reagendado",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-warning/15 text-warning",
  confirmed: "bg-success/15 text-success",
  present: "bg-success/15 text-success",
  completed: "bg-success/15 text-success",
  rescheduled: "bg-accent/15 text-accent",
  cancelled: "bg-destructive/15 text-destructive",
};

const emptyAppointmentForm = {
  clientId: "",
  serviceId: "",
  professionalId: "",
  date: new Date().toISOString().slice(0, 10),
  time: "09:00",
};

export default function CalendarPage() {
  const { user } = useAuth();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().slice(0, 10));
  const [appointmentsByDate, setAppointmentsByDate] = useState<Record<string, CalendarAppointment[]>>({});
  const [clients, setClients] = useState<ClientLookup[]>([]);
  const [services, setServices] = useState<(LookupItem & { duration: number })[]>([]);
  const [professionals, setProfessionals] = useState<LookupItem[]>([]);
  const [form, setForm] = useState(emptyAppointmentForm);
  const [editingAppointment, setEditingAppointment] = useState<CalendarAppointment | null>(null);

  const loadAppointments = async () => {
    if (!user) return;

    try {
      const [appointmentsRes, clientsRes, servicesRes, professionalsRes] = await Promise.all([
        supabase.from("appointments").select("id, client_id, service_id, professional_id, start_time, end_time, status, notes, rescheduled_from"),
        supabase.from("clients").select("id, name, phone, accepts_messages").order("name"),
        supabase.from("services").select("id, name, duration_minutes").order("name"),
        supabase.from("professionals").select("id, name").order("name"),
      ]);

      if (appointmentsRes.error) throw appointmentsRes.error;

      setClients((clientsRes.data ?? []).map((c: any) => ({ id: c.id, name: c.name, phone: c.phone ?? "", acceptsMessages: c.accepts_messages !== false })));
      setServices((servicesRes.data ?? []).map(s => ({ id: s.id, name: s.name, duration: Number(s.duration_minutes ?? 60) })));
      setProfessionals((professionalsRes.data ?? []).map(p => ({ id: p.id, name: p.name })));

      const clientMap = new Map((clientsRes.data ?? []).map((c: any) => [c.id, { name: c.name, phone: c.phone ?? "" }]));
      const serviceMap = new Map((servicesRes.data ?? []).map(s => [s.id, s.name]));
      const professionalMap = new Map((professionalsRes.data ?? []).map(p => [p.id, p.name]));

      const grouped: Record<string, CalendarAppointment[]> = {};
      for (const row of appointmentsRes.data ?? []) {
        const startTime = row.start_time ? new Date(row.start_time) : null;
        if (!startTime) continue;

        const date = startTime.toISOString().slice(0, 10);
        const time = startTime.toTimeString().slice(0, 5);
        const clientInfo = clientMap.get(row.client_id);

        const entry: CalendarAppointment = {
          id: String(row.id),
          date,
          time,
          client: clientInfo?.name ?? "Cliente",
          clientId: row.client_id,
          clientPhone: clientInfo?.phone ?? "",
          service: serviceMap.get(row.service_id) ?? "Serviço",
          serviceId: row.service_id,
          professional: professionalMap.get(row.professional_id) ?? "Profissional",
          professionalId: row.professional_id,
          status:
            String(row.status ?? "").includes("cancel")
              ? "cancelled"
              : String(row.status ?? "").includes("complet")
                ? "completed"
                : String(row.status ?? "").includes("resched")
                  ? "rescheduled"
                  : String(row.status ?? "").includes("confirm")
                    ? "confirmed"
                    : "scheduled",
        };

        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(entry);
      }

      setAppointmentsByDate(grouped);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar agendamentos.");
    }
  };

  useEffect(() => { void loadAppointments(); }, [user]);

  useEffect(() => {
    if (professionals.length > 0 && !form.professionalId) {
      setForm((prev) => ({ ...prev, professionalId: professionals[0].id }));
    }
  }, [professionals]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1;
    if (day < 1 || day > daysInMonth) return null;
    return day;
  });

  const monthName = currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const dateKey = (day: number) => `${year}-${(month + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

  const selectedAppointments = useMemo(
    () => (appointmentsByDate[selectedDate] || []).sort((a, b) => a.time.localeCompare(b.time)),
    [appointmentsByDate, selectedDate],
  );

  const saveAppointment = async (isReschedule = false) => {
    if (professionals.length === 0) return toast.error("Cadastre ao menos 1 profissional antes de agendar.");
    if (!form.clientId || !form.serviceId || !form.professionalId || !form.date || !form.time) {
      return toast.error("Preencha todos os campos do agendamento.");
    }

    const selectedService = services.find(s => s.id === form.serviceId);
    const duration = selectedService?.duration ?? 60;
    const startDateTime = new Date(`${form.date}T${form.time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    try {
      if (editingAppointment) {
        const previousStart = new Date(`${editingAppointment.date}T${editingAppointment.time}:00`);
        const { error } = await supabase
          .from("appointments")
          .update({
            client_id: form.clientId,
            service_id: form.serviceId,
            professional_id: form.professionalId,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            status: "rescheduled",
          })
          .eq("id", editingAppointment.id);
        if (error) throw error;

        // Log reschedule in notes
        console.log("Reagendamento registrado:", editingAppointment.id);
        toast.success("Agendamento atualizado.");
      } else {
        const { error } = await supabase
          .from("appointments")
          .insert({
            client_id: form.clientId,
            service_id: form.serviceId,
            professional_id: form.professionalId,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            status: "confirmed",
          });
        if (error) throw error;

        // Send confirmation message
        const client = clients.find(c => c.id === form.clientId);
        if (client?.acceptsMessages) {
          const msg = generateMessage("appointment_confirmation", {
            clientName: client.name,
            date: new Date(form.date + "T12:00").toLocaleDateString("pt-BR"),
            time: form.time,
            service: selectedService?.name ?? "",
            professional: professionals.find(p => p.id === form.professionalId)?.name ?? "",
          });
          await sendWhatsAppMessage({
            clientId: client.id,
            clientPhone: client.phone,
            clientName: client.name,
            type: "appointment_confirmation",
            content: msg,
          });
        }

        toast.success("Agendamento criado.");
      }

      setEditingAppointment(null);
      setForm(emptyAppointmentForm);
      await loadAppointments();
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível salvar o agendamento.");
    }
  };

  const startReschedule = (appointment: CalendarAppointment) => {
    setEditingAppointment(appointment);
    setForm({
      clientId: appointment.clientId,
      serviceId: appointment.serviceId,
      professionalId: appointment.professionalId,
      date: appointment.date,
      time: appointment.time,
    });
  };

  const cancelAppointment = async (appointmentId: string) => {
    if (!window.confirm("Deseja cancelar este agendamento?")) return;

    const { error } = await supabase.from("appointments").update({ status: "cancelled" }).eq("id", appointmentId);
    if (error) {
      console.error(error);
      toast.error("Falha ao cancelar agendamento.");
      return;
    }
    toast.success("Agendamento cancelado.");
    await loadAppointments();
  };

  const AppointmentFormContent = ({ reschedule = false }: { reschedule?: boolean }) => (
    <div className="space-y-4 mt-2">
      {!reschedule && (
        <>
          <div>
            <Label>Cliente</Label>
            <Select value={form.clientId} onValueChange={(v) => setForm(prev => ({ ...prev, clientId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
              <SelectContent>
                {clients.length === 0 ? <SelectItem value="none" disabled>Cadastre clientes primeiro</SelectItem> : clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Serviço</Label>
            <Select value={form.serviceId} onValueChange={(v) => setForm(prev => ({ ...prev, serviceId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
              <SelectContent>
                {services.length === 0 ? <SelectItem value="none" disabled>Cadastre serviços primeiro</SelectItem> : services.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.duration}min)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Profissional</Label>
            <Select value={form.professionalId} onValueChange={(v) => setForm(prev => ({ ...prev, professionalId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {professionals.length === 0 ? <SelectItem value="none" disabled>Cadastre profissionais primeiro</SelectItem> : professionals.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} /></div>
        <div>
          <Label>Horário</Label>
          <Select value={form.time} onValueChange={(value) => setForm((prev) => ({ ...prev, time: value }))}>
            <SelectTrigger><SelectValue placeholder="Horário" /></SelectTrigger>
            <SelectContent>
              {hours.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button className="w-full gradient-primary text-primary-foreground" onClick={() => void saveAppointment(reschedule)}>
        {reschedule ? "Confirmar remarcação" : editingAppointment ? "Salvar alteração" : "Agendar"}
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Agenda" description="Gerencie agendamentos, reagendamentos e cancelamentos.">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground" onClick={() => { setEditingAppointment(null); setForm(emptyAppointmentForm); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Novo Agendamento</DialogTitle></DialogHeader>
            <AppointmentFormContent />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="p-1 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-display font-semibold capitalize">{monthName}</span>
            <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="p-1 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => {
              if (!day) return <div key={i} />;
              const key = dateKey(day);
              const hasAppointments = Boolean(appointmentsByDate[key]?.length);
              const isSelected = selectedDate === key;
              return (
                <button key={i} onClick={() => setSelectedDate(key)} className={cn("h-9 rounded-lg text-sm transition-all relative", isSelected ? "gradient-primary text-primary-foreground font-semibold" : "hover:bg-muted")}>
                  {day}
                  {hasAppointments && !isSelected && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">Agendamentos — {new Date(selectedDate + "T12:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</h2>

          <div className="space-y-3">
            {selectedAppointments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum agendamento para esta data.</p> : null}
            {selectedAppointments.map((apt) => (
              <div key={apt.id} className={cn("rounded-lg border px-4 py-3 transition-colors", apt.status === "cancelled" ? "border-destructive/30 bg-destructive/5" : apt.status === "rescheduled" ? "border-accent/30 bg-accent/5" : "border-border bg-muted/20 hover:bg-muted/40")}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{apt.time.slice(0, 5)} • {apt.client}</p>
                    <p className="text-xs text-muted-foreground">{apt.service} · {apt.professional}</p>
                    <p className={cn("text-xs mt-1", apt.status === "cancelled" ? "text-destructive" : apt.status === "rescheduled" ? "text-warning" : "text-success")}>{apt.status === "cancelled" ? "Cancelado" : apt.status === "completed" ? "Finalizado" : apt.status === "rescheduled" ? "Reagendado" : "Confirmado"}</p>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => startReschedule(apt)} disabled={apt.status === "cancelled"}>Reagendar</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle className="font-display">Reagendar</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} /></div>
                          <div><Label>Horário</Label><Input type="time" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} /></div>
                          <Button onClick={() => void saveAppointment()} className="w-full">Salvar reagendamento</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button variant="destructive" size="sm" onClick={() => void cancelAppointment(apt.id)} disabled={apt.status === "cancelled"}>Cancelar</Button>
                  </div>
                  {apt.status !== "cancelled" && apt.status !== "completed" && apt.status !== "rescheduled" && (
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => startReschedule(apt)}>Remarcar</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle className="font-display">Remarcar agendamento</DialogTitle></DialogHeader>
                          <p className="text-sm text-muted-foreground">O horário anterior será liberado automaticamente.</p>
                          <AppointmentFormContent reschedule />
                        </DialogContent>
                      </Dialog>
                      <Button variant="destructive" size="sm" onClick={() => void cancelAppointment(apt.id)}>Cancelar</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
