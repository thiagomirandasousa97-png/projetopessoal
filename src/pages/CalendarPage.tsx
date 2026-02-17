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
import PaymentMethodFields from "@/components/PaymentMethodFields";
import { type PaymentMethod } from "@/lib/payments";

type CalendarAppointment = {
  id: string;
  date: string;
  time: string;
  client: string;
  clientId: string;
  clientPhone: string;
  service: string;
  serviceId: string;
  servicePrice: number;
  professional: string;
  professionalId: string;
  status: "scheduled" | "confirmed" | "rescheduled" | "cancelled" | "completed" | "no_show";
  attendanceConfirmed: boolean;
  paymentStatus: "unpaid" | "paid" | "open_account";
};

type LookupItem = { id: string; name: string };
type ServiceLookup = LookupItem & { duration: number; price: number };
type ClientLookup = { id: string; name: string; phone: string; acceptsMessages: boolean };

const hours = Array.from({ length: 12 }, (_, i) => `${(i + 7).toString().padStart(2, "0")}:00`);

const statusColors: Record<CalendarAppointment["status"], string> = {
  scheduled: "bg-warning/15 text-warning",
  confirmed: "bg-primary/15 text-primary",
  rescheduled: "bg-accent/15 text-accent",
  cancelled: "bg-destructive/15 text-destructive",
  completed: "bg-success/15 text-success",
  no_show: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<CalendarAppointment["status"], string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  rescheduled: "Remarcado",
  cancelled: "Cancelado",
  completed: "Finalizado",
  no_show: "Nao compareceu",
};

const emptyAppointmentForm = {
  clientId: "",
  serviceId: "",
  professionalId: "",
  date: new Date().toISOString().slice(0, 10),
  time: "09:00",
};

function nextMonthDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const { user } = useAuth();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().slice(0, 10));
  const [appointmentsByDate, setAppointmentsByDate] = useState<Record<string, CalendarAppointment[]>>({});
  const [clients, setClients] = useState<ClientLookup[]>([]);
  const [services, setServices] = useState<ServiceLookup[]>([]);
  const [professionals, setProfessionals] = useState<LookupItem[]>([]);
  const [form, setForm] = useState(emptyAppointmentForm);
  const [editingAppointment, setEditingAppointment] = useState<CalendarAppointment | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [expectedReceiptDate, setExpectedReceiptDate] = useState(nextMonthDate());

  const loadAppointments = async () => {
    if (!user) return;

    const [appointmentsRes, clientsRes, servicesRes, professionalsRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, client_id, service_id, professional_id, start_time, end_time, status, attendance_confirmed, payment_status"),
      supabase.from("clients").select("id, name, phone, accepts_messages").order("name"),
      supabase.from("services").select("id, name, duration_minutes, price").order("name"),
      supabase.from("professionals").select("id, name").order("name"),
    ]);

    if (appointmentsRes.error) {
      toast.error("Erro ao carregar agendamentos.");
      return;
    }

    if (!clientsRes.error) {
      setClients(
        (clientsRes.data ?? []).map((item) => ({
          id: String(item.id),
          name: String(item.name ?? ""),
          phone: String(item.phone ?? ""),
          acceptsMessages: Boolean(item.accepts_messages ?? true),
        })),
      );
    }

    if (!servicesRes.error) {
      setServices(
        (servicesRes.data ?? []).map((item) => ({
          id: String(item.id),
          name: String(item.name ?? ""),
          duration: Number(item.duration_minutes ?? 60),
          price: Number(item.price ?? 0),
        })),
      );
    }

    if (!professionalsRes.error) {
      setProfessionals(
        (professionalsRes.data ?? []).map((item) => ({
          id: String(item.id),
          name: String(item.name ?? ""),
        })),
      );
    }

    const clientMap = new Map((clientsRes.data ?? []).map((item) => [String(item.id), item]));
    const serviceMap = new Map((servicesRes.data ?? []).map((item) => [String(item.id), item]));
    const professionalMap = new Map((professionalsRes.data ?? []).map((item) => [String(item.id), item]));

    const grouped: Record<string, CalendarAppointment[]> = {};
    for (const row of appointmentsRes.data ?? []) {
      const startTime = row.start_time ? new Date(row.start_time) : null;
      if (!startTime) continue;

      const date = startTime.toISOString().slice(0, 10);
      const time = startTime.toTimeString().slice(0, 5);
      const client = clientMap.get(String(row.client_id));
      const service = serviceMap.get(String(row.service_id));
      const professional = professionalMap.get(String(row.professional_id));
      const rawStatus = String(row.status ?? "scheduled");
      const safeStatus = (
        ["scheduled", "confirmed", "rescheduled", "cancelled", "completed", "no_show"].includes(rawStatus)
          ? rawStatus
          : "scheduled"
      ) as CalendarAppointment["status"];
      const rawPaymentStatus = String(row.payment_status ?? "unpaid");
      const safePaymentStatus = (
        ["unpaid", "paid", "open_account"].includes(rawPaymentStatus) ? rawPaymentStatus : "unpaid"
      ) as CalendarAppointment["paymentStatus"];

      const appointment: CalendarAppointment = {
        id: String(row.id),
        date,
        time,
        client: String(client?.name ?? "Cliente"),
        clientId: String(row.client_id),
        clientPhone: String(client?.phone ?? ""),
        service: String(service?.name ?? "Servico"),
        serviceId: String(row.service_id),
        servicePrice: Number(service?.price ?? 0),
        professional: String(professional?.name ?? "Profissional"),
        professionalId: String(row.professional_id),
        status: safeStatus,
        attendanceConfirmed: Boolean(row.attendance_confirmed ?? false),
        paymentStatus: safePaymentStatus,
      };

      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(appointment);
    }

    setAppointmentsByDate(grouped);
  };

  useEffect(() => {
    void loadAppointments();
  }, [user]);

  useEffect(() => {
    if (professionals.length > 0 && !form.professionalId) {
      setForm((prev) => ({ ...prev, professionalId: professionals[0].id }));
    }
  }, [form.professionalId, professionals]);

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

  const saveAppointment = async () => {
    if (professionals.length === 0) {
      toast.error("Cadastre ao menos um profissional antes de agendar.");
      return;
    }

    if (!form.clientId || !form.serviceId || !form.professionalId || !form.date || !form.time) {
      toast.error("Preencha todos os campos do agendamento.");
      return;
    }

    const selectedService = services.find((item) => item.id === form.serviceId);
    const duration = selectedService?.duration ?? 60;
    const startDateTime = new Date(`${form.date}T${form.time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 1000);

    if (editingAppointment) {
      const { error } = await supabase
        .from("appointments")
        .update({
          professional_id: form.professionalId,
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          status: "rescheduled",
        })
        .eq("id", editingAppointment.id);

      if (error) {
        toast.error("Falha ao remarcar agendamento.");
        return;
      }

      toast.success("Agendamento remarcado.");
      setEditingAppointment(null);
      setRescheduleOpen(false);
      await loadAppointments();
      return;
    }

    const { error } = await supabase.from("appointments").insert({
      client_id: form.clientId,
      service_id: form.serviceId,
      professional_id: form.professionalId,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      status: "confirmed",
      attendance_confirmed: false,
      payment_status: "unpaid",
    });

    if (error) {
      toast.error("Falha ao criar agendamento.");
      return;
    }

    const client = clients.find((item) => item.id === form.clientId);
    if (client?.acceptsMessages) {
      const msg = generateMessage("appointment_confirmation", {
        clientName: client.name,
        date: new Date(`${form.date}T12:00:00`).toLocaleDateString("pt-BR"),
        time: form.time,
        service: selectedService?.name ?? "",
        professional: professionals.find((item) => item.id === form.professionalId)?.name ?? "",
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
    setForm(emptyAppointmentForm);
    await loadAppointments();
  };

  const updateAppointmentStatus = async (appointmentId: string, payload: Record<string, unknown>) => {
    const { error } = await supabase.from("appointments").update(payload).eq("id", appointmentId);
    if (error) {
      toast.error("Nao foi possivel atualizar agendamento.");
      return false;
    }
    await loadAppointments();
    return true;
  };

  const openActionModal = (appointment: CalendarAppointment) => {
    setSelectedAppointment(appointment);
    setActionsOpen(true);
  };

  const startReschedule = () => {
    if (!selectedAppointment) return;
    setEditingAppointment(selectedAppointment);
    setForm({
      clientId: selectedAppointment.clientId,
      serviceId: selectedAppointment.serviceId,
      professionalId: selectedAppointment.professionalId,
      date: selectedAppointment.date,
      time: selectedAppointment.time,
    });
    setActionsOpen(false);
    setRescheduleOpen(true);
  };

  const confirmAttendance = async () => {
    if (!selectedAppointment) return;
    const ok = await updateAppointmentStatus(selectedAppointment.id, {
      status: "confirmed",
      attendance_confirmed: true,
    });
    if (ok) toast.success("Comparecimento confirmado.");
  };

  const completeAttendance = async () => {
    if (!selectedAppointment) return;
    const ok = await updateAppointmentStatus(selectedAppointment.id, {
      status: "completed",
      attendance_confirmed: true,
    });
    if (ok) toast.success("Atendimento finalizado.");
  };

  const cancelAppointment = async () => {
    if (!selectedAppointment) return;
    const ok = await updateAppointmentStatus(selectedAppointment.id, {
      status: "cancelled",
    });
    if (ok) {
      toast.success("Agendamento cancelado.");
      setActionsOpen(false);
    }
  };

  const receiveAppointment = async () => {
    if (!selectedAppointment) return;
    const now = new Date().toISOString();
    const serviceDate = selectedAppointment.date;
    const dueDate = paymentMethod === "account" ? expectedReceiptDate : serviceDate;
    const receivableStatus = paymentMethod === "account" ? "pending" : "paid";

    const { data: existing } = await supabase
      .from("financial_receivables")
      .select("id")
      .eq("appointment_id", selectedAppointment.id)
      .maybeSingle();

    const receivablePayload = {
      appointment_id: selectedAppointment.id,
      client_id: selectedAppointment.clientId,
      client_name: selectedAppointment.client,
      service_name: selectedAppointment.service,
      service_date: serviceDate,
      description: `${selectedAppointment.client} - ${selectedAppointment.service}`,
      amount: selectedAppointment.servicePrice,
      payment_method: paymentMethod,
      due_date: dueDate,
      status: receivableStatus,
      paid_at: paymentMethod === "account" ? null : now,
    };

    const receivableError = existing
      ? await supabase.from("financial_receivables").update(receivablePayload).eq("id", existing.id)
      : await supabase.from("financial_receivables").insert(receivablePayload);

    if (receivableError.error) {
      toast.error("Erro ao lancar no financeiro.");
      return;
    }

    const appointmentPayload = {
      payment_status: paymentMethod === "account" ? "open_account" : "paid",
      payment_method: paymentMethod,
      paid_at: paymentMethod === "account" ? null : now,
      status: "completed",
      attendance_confirmed: true,
    };

    const ok = await updateAppointmentStatus(selectedAppointment.id, appointmentPayload);
    if (!ok) return;

    toast.success(paymentMethod === "account" ? "Lancado em contas a receber." : "Pagamento recebido.");
    setPaymentOpen(false);
    setActionsOpen(false);
  };

  return (
    <div>
      <PageHeader title="Agenda" description="Gerencie agendamentos, comparecimento, remarcacao e recebimento." >
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground" onClick={() => setForm(emptyAppointmentForm)}>
              <Plus className="h-4 w-4 mr-2" /> Novo Agendamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">Novo Agendamento</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Cliente</Label>
                <Select value={form.clientId} onValueChange={(value) => setForm((prev) => ({ ...prev, clientId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Servico</Label>
                <Select value={form.serviceId} onValueChange={(value) => setForm((prev) => ({ ...prev, serviceId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o servico" /></SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} ({service.duration} min)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Profissional</Label>
                <Select value={form.professionalId} onValueChange={(value) => setForm((prev) => ({ ...prev, professionalId: value }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione o profissional" /></SelectTrigger>
                  <SelectContent>
                    {professionals.map((professional) => (
                      <SelectItem key={professional.id} value={professional.id}>{professional.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} /></div>
                <div>
                  <Label>Horario</Label>
                  <Select value={form.time} onValueChange={(value) => setForm((prev) => ({ ...prev, time: value }))}>
                    <SelectTrigger><SelectValue placeholder="Horario" /></SelectTrigger>
                    <SelectContent>
                      {hours.map((hour) => (
                        <SelectItem key={hour} value={hour}>{hour}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button className="w-full gradient-primary text-primary-foreground" onClick={() => void saveAppointment()}>
                Agendar
              </Button>
            </div>
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
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => <div key={day} className="py-1">{day}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (!day) return <div key={index} />;
              const key = dateKey(day);
              const hasAppointments = Boolean(appointmentsByDate[key]?.length);
              const isSelected = selectedDate === key;
              return (
                <button key={index} onClick={() => setSelectedDate(key)} className={cn("h-9 rounded-lg text-sm transition-all relative", isSelected ? "gradient-primary text-primary-foreground font-semibold" : "hover:bg-muted")}>
                  {day}
                  {hasAppointments && !isSelected ? <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" /> : null}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="lg:col-span-2 glass-card rounded-xl p-5">
          <h2 className="font-display font-semibold mb-4">
            Agendamentos - {new Date(`${selectedDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </h2>

          <div className="space-y-3">
            {selectedAppointments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum agendamento para esta data.</p> : null}

            {selectedAppointments.map((appointment) => (
              <button
                key={appointment.id}
                className={cn(
                  "w-full text-left rounded-lg border px-4 py-3 transition-colors",
                  appointment.status === "cancelled" ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/20 hover:bg-muted/40",
                )}
                onClick={() => openActionModal(appointment)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{appointment.time} - {appointment.client}</p>
                    <p className="text-xs text-muted-foreground">{appointment.service} · {appointment.professional}</p>
                    <span className={cn("text-xs font-medium px-2 py-1 rounded-full inline-block mt-2", statusColors[appointment.status])}>
                      {statusLabels[appointment.status]}
                    </span>
                  </div>
                  {appointment.status === "completed" && appointment.paymentStatus !== "paid" ? (
                    <span className="text-xs px-2 py-1 rounded-full bg-warning/15 text-warning">Aguardando recebimento</span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <Dialog open={actionsOpen} onOpenChange={setActionsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Acoes do agendamento</DialogTitle></DialogHeader>
          {selectedAppointment ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {selectedAppointment.client} - {selectedAppointment.service} - {selectedAppointment.time}
              </p>

              {selectedAppointment.status !== "cancelled" && !selectedAppointment.attendanceConfirmed ? (
                <Button className="w-full" onClick={() => void confirmAttendance()}>Confirmar comparecimento</Button>
              ) : null}

              {selectedAppointment.status !== "cancelled" && selectedAppointment.status !== "completed" ? (
                <Button className="w-full" variant="outline" onClick={() => void completeAttendance()}>Finalizar atendimento</Button>
              ) : null}

              {selectedAppointment.status !== "cancelled" ? (
                <Button className="w-full" variant="outline" onClick={startReschedule}>Remarcar</Button>
              ) : null}

              {selectedAppointment.status !== "cancelled" ? (
                <Button className="w-full" variant="destructive" onClick={() => void cancelAppointment()}>Cancelar</Button>
              ) : null}

              {selectedAppointment.status === "completed" ? (
                <Button className="w-full gradient-primary text-primary-foreground" onClick={() => setPaymentOpen(true)}>
                  Receber
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Remarcar agendamento</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Profissional</Label>
              <Select value={form.professionalId} onValueChange={(value) => setForm((prev) => ({ ...prev, professionalId: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {professionals.map((professional) => (
                    <SelectItem key={professional.id} value={professional.id}>{professional.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} /></div>
              <div><Label>Horario</Label><Input type="time" value={form.time} onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))} /></div>
            </div>
            <Button className="w-full" onClick={() => void saveAppointment()}>Salvar remarcacao</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Receber atendimento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <PaymentMethodFields
              method={paymentMethod}
              onMethodChange={setPaymentMethod}
              expectedDate={expectedReceiptDate}
              onExpectedDateChange={setExpectedReceiptDate}
            />
            <Button className="w-full gradient-primary text-primary-foreground" onClick={() => void receiveAppointment()}>
              Confirmar recebimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
