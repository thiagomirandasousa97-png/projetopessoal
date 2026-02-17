import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toCurrency } from "@/lib/database";
import { paymentMethodLabel } from "@/lib/payments";

type ReportType =
  | "clients"
  | "professionals"
  | "financial"
  | "payables"
  | "receivables"
  | "cash"
  | "appointments";

type AppointmentRow = {
  id: string;
  date: string;
  status: string;
  clientName: string;
  professionalId: string;
  professionalName: string;
  serviceId: string;
  serviceName: string;
  paymentMethod: string;
};

type ReceivableRow = {
  id: string;
  createdAt: string;
  dueDate: string;
  status: string;
  amount: number;
  clientName: string;
  serviceName: string;
  paymentMethod: string;
};

type PayableRow = {
  id: string;
  createdAt: string;
  dueDate: string;
  status: string;
  amount: number;
  category: string;
  description: string;
};

type CashRow = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openedBy: string;
  closedBy: string | null;
  openingAmount: number;
  closingAmount: number | null;
  status: string;
};

type ClientRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
};

type ProfessionalRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  specialties: string;
  createdAt: string;
};

type ServiceOption = { id: string; name: string };
type ProfessionalOption = { id: string; name: string };

function inDateRange(date: string, from: string, to: string) {
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>("appointments");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [professionalId, setProfessionalId] = useState("all");
  const [serviceId, setServiceId] = useState("all");
  const [status, setStatus] = useState("all");
  const [paymentMethod, setPaymentMethod] = useState("all");

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [receivables, setReceivables] = useState<ReceivableRow[]>([]);
  const [payables, setPayables] = useState<PayableRow[]>([]);
  const [cashSessions, setCashSessions] = useState<CashRow[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [professionalOptions, setProfessionalOptions] = useState<ProfessionalOption[]>([]);

  useEffect(() => {
    const load = async () => {
      const [clientsRes, professionalsRes, servicesRes, appointmentsRes, receivablesRes, payablesRes, cashRes] = await Promise.all([
        supabase.from("clients").select("id, name, phone, email, created_at").order("name"),
        supabase.from("professionals").select("id, name, phone, email, specialties, created_at").order("name"),
        supabase.from("services").select("id, name").order("name"),
        supabase
          .from("appointments")
          .select("id, start_time, status, payment_method, clients(name), professionals(id,name), services(id,name)")
          .order("start_time", { ascending: false }),
        supabase
          .from("financial_receivables")
          .select("id, created_at, due_date, status, amount, client_name, service_name, payment_method")
          .order("created_at", { ascending: false }),
        supabase
          .from("financial_payables")
          .select("id, created_at, due_date, status, amount, category, description")
          .order("created_at", { ascending: false }),
        supabase
          .from("cash_sessions")
          .select("id, opened_at, closed_at, opened_by, closed_by, opening_amount, closing_amount, status")
          .order("opened_at", { ascending: false }),
      ]);

      if (!clientsRes.error) {
        setClients((clientsRes.data ?? []).map((item) => ({
          id: String(item.id),
          name: String(item.name ?? ""),
          phone: String(item.phone ?? ""),
          email: String(item.email ?? ""),
          createdAt: String(item.created_at ?? "").slice(0, 10),
        })));
      }

      if (!professionalsRes.error) {
        const mapped = (professionalsRes.data ?? []).map((item) => ({
          id: String(item.id),
          name: String(item.name ?? ""),
          phone: String(item.phone ?? ""),
          email: String(item.email ?? ""),
          specialties: (item.specialties ?? []).join(", "),
          createdAt: String(item.created_at ?? "").slice(0, 10),
        }));
        setProfessionals(mapped);
        setProfessionalOptions(mapped.map((item) => ({ id: item.id, name: item.name })));
      }

      if (!servicesRes.error) {
        setServiceOptions((servicesRes.data ?? []).map((item) => ({ id: String(item.id), name: String(item.name ?? "") })));
      }

      if (!appointmentsRes.error) {
        setAppointments((appointmentsRes.data ?? []).map((item) => {
          const client = Array.isArray(item.clients) ? item.clients[0] : item.clients;
          const professional = Array.isArray(item.professionals) ? item.professionals[0] : item.professionals;
          const service = Array.isArray(item.services) ? item.services[0] : item.services;
          return {
            id: String(item.id),
            date: String(item.start_time ?? "").slice(0, 10),
            status: String(item.status ?? ""),
            clientName: String(client?.name ?? ""),
            professionalId: String(professional?.id ?? ""),
            professionalName: String(professional?.name ?? ""),
            serviceId: String(service?.id ?? ""),
            serviceName: String(service?.name ?? ""),
            paymentMethod: String(item.payment_method ?? ""),
          };
        }));
      }

      if (!receivablesRes.error) {
        setReceivables((receivablesRes.data ?? []).map((item) => ({
          id: String(item.id),
          createdAt: String(item.created_at ?? "").slice(0, 10),
          dueDate: String(item.due_date ?? ""),
          status: String(item.status ?? ""),
          amount: Number(item.amount ?? 0),
          clientName: String(item.client_name ?? ""),
          serviceName: String(item.service_name ?? ""),
          paymentMethod: String(item.payment_method ?? ""),
        })));
      }

      if (!payablesRes.error) {
        setPayables((payablesRes.data ?? []).map((item) => ({
          id: String(item.id),
          createdAt: String(item.created_at ?? "").slice(0, 10),
          dueDate: String(item.due_date ?? ""),
          status: String(item.status ?? ""),
          amount: Number(item.amount ?? 0),
          category: String(item.category ?? ""),
          description: String(item.description ?? ""),
        })));
      }

      if (!cashRes.error) {
        setCashSessions((cashRes.data ?? []).map((item) => ({
          id: String(item.id),
          openedAt: String(item.opened_at ?? ""),
          closedAt: item.closed_at ? String(item.closed_at) : null,
          openedBy: String(item.opened_by ?? ""),
          closedBy: item.closed_by ? String(item.closed_by) : null,
          openingAmount: Number(item.opening_amount ?? 0),
          closingAmount: item.closing_amount === null ? null : Number(item.closing_amount),
          status: String(item.status ?? ""),
        })));
      }
    };

    void load();
  }, []);

  const filteredAppointments = useMemo(() => {
    return appointments.filter((item) => {
      if (!inDateRange(item.date, dateFrom, dateTo)) return false;
      if (professionalId !== "all" && item.professionalId !== professionalId) return false;
      if (serviceId !== "all" && item.serviceId !== serviceId) return false;
      if (status !== "all" && item.status !== status) return false;
      if (paymentMethod !== "all" && item.paymentMethod !== paymentMethod) return false;
      return true;
    });
  }, [appointments, dateFrom, dateTo, professionalId, serviceId, status, paymentMethod]);

  const filteredReceivables = useMemo(() => {
    return receivables.filter((item) => {
      if (!inDateRange(item.createdAt || item.dueDate, dateFrom, dateTo)) return false;
      if (status !== "all" && item.status !== status) return false;
      if (paymentMethod !== "all" && item.paymentMethod !== paymentMethod) return false;
      return true;
    });
  }, [receivables, dateFrom, dateTo, status, paymentMethod]);

  const filteredPayables = useMemo(() => {
    return payables.filter((item) => {
      if (!inDateRange(item.createdAt || item.dueDate, dateFrom, dateTo)) return false;
      if (status !== "all" && item.status !== status) return false;
      return true;
    });
  }, [payables, dateFrom, dateTo, status]);

  const filteredClients = useMemo(
    () => clients.filter((item) => inDateRange(item.createdAt, dateFrom, dateTo)),
    [clients, dateFrom, dateTo],
  );

  const filteredProfessionals = useMemo(
    () => professionals.filter((item) => inDateRange(item.createdAt, dateFrom, dateTo)),
    [dateFrom, dateTo, professionals],
  );

  const filteredCash = useMemo(
    () => cashSessions.filter((item) => inDateRange(item.openedAt.slice(0, 10), dateFrom, dateTo)),
    [cashSessions, dateFrom, dateTo],
  );

  const financialCombined = useMemo(() => {
    const receivableRows = filteredReceivables.map((item) => ({
      id: `r-${item.id}`,
      type: "Receber",
      date: item.createdAt || item.dueDate,
      description: `${item.clientName} - ${item.serviceName}`,
      amount: item.amount,
      status: item.status,
    }));
    const payableRows = filteredPayables.map((item) => ({
      id: `p-${item.id}`,
      type: "Pagar",
      date: item.createdAt || item.dueDate,
      description: item.description,
      amount: item.amount,
      status: item.status,
    }));
    return [...receivableRows, ...payableRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredPayables, filteredReceivables]);

  return (
    <div>
      <PageHeader title="Relatorios" description="Consultas com filtros por data, profissional, servico, status e pagamento." />

      <div className="glass-card rounded-xl p-4 mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="clients">Lista de clientes</SelectItem>
            <SelectItem value="professionals">Lista de funcionarios</SelectItem>
            <SelectItem value="financial">Financeiro</SelectItem>
            <SelectItem value="payables">Contas a pagar</SelectItem>
            <SelectItem value="receivables">Contas a receber</SelectItem>
            <SelectItem value="cash">Movimentacao de caixa</SelectItem>
            <SelectItem value="appointments">Atendimentos</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <Select value={professionalId} onValueChange={setProfessionalId}>
          <SelectTrigger><SelectValue placeholder="Profissional" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos profissionais</SelectItem>
            {professionalOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger><SelectValue placeholder="Servico" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos servicos</SelectItem>
            {serviceOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="scheduled">Agendado</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="completed">Finalizado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago/Recebido</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger><SelectValue placeholder="Pagamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas formas</SelectItem>
            <SelectItem value="pix">Pix</SelectItem>
            <SelectItem value="cash">Dinheiro</SelectItem>
            <SelectItem value="credit_card">Cartao de credito</SelectItem>
            <SelectItem value="debit_card">Cartao de debito</SelectItem>
            <SelectItem value="account">Conta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-xl p-5 overflow-x-auto">
        {reportType === "clients" ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Nome</th><th className="pb-2">Telefone</th><th className="pb-2">Email</th><th className="pb-2">Cadastro</th></tr></thead>
            <tbody>{filteredClients.map((item) => <tr key={item.id} className="border-b border-border/50"><td className="py-2">{item.name}</td><td>{item.phone}</td><td>{item.email}</td><td>{item.createdAt}</td></tr>)}</tbody>
          </table>
        ) : null}

        {reportType === "professionals" ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Nome</th><th className="pb-2">Telefone</th><th className="pb-2">Email</th><th className="pb-2">Especialidades</th></tr></thead>
            <tbody>{filteredProfessionals.map((item) => <tr key={item.id} className="border-b border-border/50"><td className="py-2">{item.name}</td><td>{item.phone}</td><td>{item.email}</td><td>{item.specialties}</td></tr>)}</tbody>
          </table>
        ) : null}

        {reportType === "financial" ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Tipo</th><th className="pb-2">Data</th><th className="pb-2">Descricao</th><th className="pb-2">Valor</th><th className="pb-2">Status</th></tr></thead>
            <tbody>{financialCombined.map((item) => <tr key={item.id} className="border-b border-border/50"><td className="py-2">{item.type}</td><td>{item.date}</td><td>{item.description}</td><td>{toCurrency(item.amount)}</td><td>{item.status}</td></tr>)}</tbody>
          </table>
        ) : null}

        {reportType === "payables" ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Descricao</th><th className="pb-2">Categoria</th><th className="pb-2">Valor</th><th className="pb-2">Vencimento</th><th className="pb-2">Status</th></tr></thead>
            <tbody>{filteredPayables.map((item) => <tr key={item.id} className="border-b border-border/50"><td className="py-2">{item.description}</td><td>{item.category}</td><td>{toCurrency(item.amount)}</td><td>{item.dueDate}</td><td>{item.status}</td></tr>)}</tbody>
          </table>
        ) : null}

        {reportType === "receivables" ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Cliente</th><th className="pb-2">Servico</th><th className="pb-2">Valor</th><th className="pb-2">Previsto</th><th className="pb-2">Pagamento</th><th className="pb-2">Status</th></tr></thead>
            <tbody>{filteredReceivables.map((item) => <tr key={item.id} className="border-b border-border/50"><td className="py-2">{item.clientName}</td><td>{item.serviceName}</td><td>{toCurrency(item.amount)}</td><td>{item.dueDate}</td><td>{paymentMethodLabel(item.paymentMethod)}</td><td>{item.status}</td></tr>)}</tbody>
          </table>
        ) : null}

        {reportType === "cash" ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Abertura</th><th className="pb-2">Quem abriu</th><th className="pb-2">Fechamento</th><th className="pb-2">Quem fechou</th><th className="pb-2">Inicial</th><th className="pb-2">Final</th><th className="pb-2">Status</th></tr></thead>
            <tbody>{filteredCash.map((item) => <tr key={item.id} className="border-b border-border/50"><td className="py-2">{new Date(item.openedAt).toLocaleString("pt-BR")}</td><td>{item.openedBy}</td><td>{item.closedAt ? new Date(item.closedAt).toLocaleString("pt-BR") : "-"}</td><td>{item.closedBy || "-"}</td><td>{toCurrency(item.openingAmount)}</td><td>{item.closingAmount === null ? "-" : toCurrency(item.closingAmount)}</td><td>{item.status}</td></tr>)}</tbody>
          </table>
        ) : null}

        {reportType === "appointments" ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Data</th><th className="pb-2">Cliente</th><th className="pb-2">Profissional</th><th className="pb-2">Servico</th><th className="pb-2">Pagamento</th><th className="pb-2">Status</th></tr></thead>
            <tbody>{filteredAppointments.map((item) => <tr key={item.id} className="border-b border-border/50"><td className="py-2">{item.date}</td><td>{item.clientName}</td><td>{item.professionalName}</td><td>{item.serviceName}</td><td>{paymentMethodLabel(item.paymentMethod)}</td><td>{item.status}</td></tr>)}</tbody>
          </table>
        ) : null}
      </div>
    </div>
  );
}
