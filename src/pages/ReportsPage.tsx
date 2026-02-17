import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { Calendar, DollarSign, Scissors, Users, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { toCurrency } from "@/lib/database";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FilterMode = "day" | "month" | "year";

const COLORS = ["hsl(346 60% 55%)", "hsl(38 70% 55%)", "hsl(152 55% 42%)", "hsl(200 60% 50%)", "hsl(270 50% 55%)"];

type ProfessionalReport = { name: string; appointments: number; revenue: number; commission: number };

export default function ReportsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<{ date: string; service: string; professionalId: string; servicePrice: number; status: string }[]>([]);
  const [receivables, setReceivables] = useState<{ amount: number; date: string }[]>([]);
  const [clients, setClients] = useState<{ birthDate?: string }[]>([]);
  const [professionalMap, setProfessionalMap] = useState<Map<string, { name: string; commission: number }>>(new Map());
  const [filterMode, setFilterMode] = useState<FilterMode>("month");
  const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      try {
        const [appointmentsRes, receivablesRes, clientsRes, servicesRes, professionalsRes] = await Promise.all([
          supabase.from("appointments").select("start_time, service_id, professional_id, status"),
          supabase.from("financial_receivables").select("amount, due_date"),
          supabase.from("clients").select("birth_date"),
          supabase.from("services").select("id, name, price"),
          supabase.from("professionals").select("id, name, commission_percent"),
        ]);

        if (appointmentsRes.error) throw appointmentsRes.error;

        const serviceMap = new Map((servicesRes.data ?? []).map(s => [s.id, { name: s.name, price: Number(s.price ?? 0) }]));
        const profMap = new Map((professionalsRes.data ?? []).map((p: any) => [p.id, { name: p.name, commission: Number(p.commission_percent ?? 0) }]));
        setProfessionalMap(profMap);

        setAppointments((appointmentsRes.data ?? []).map((a) => {
          const svc = serviceMap.get(a.service_id);
          return {
            date: a.start_time ? new Date(a.start_time).toISOString().slice(0, 10) : "",
            service: svc?.name ?? "Serviço",
            professionalId: a.professional_id,
            servicePrice: svc?.price ?? 0,
            status: String(a.status ?? "scheduled").toLowerCase(),
          };
        }));
        setReceivables((receivablesRes.data ?? []).map((r) => ({ amount: Number(r.amount ?? 0), date: String(r.due_date ?? "") })));
        setClients((clientsRes.data ?? []).map((c) => ({ birthDate: String(c.birth_date ?? "") })));
      } catch (err) {
        console.error("Erro ao carregar relatórios:", err);
      }
    };

    void load();
  }, [user]);

  const base = useMemo(() => new Date(`${filterDate}T00:00:00`), [filterDate]);

  const matchesFilter = (dateString: string) => {
    if (!dateString) return false;
    const date = new Date(`${dateString}T00:00:00`);
    if (filterMode === "day") return date.toISOString().slice(0, 10) === base.toISOString().slice(0, 10);
    if (filterMode === "month") return date.getMonth() === base.getMonth() && date.getFullYear() === base.getFullYear();
    return date.getFullYear() === base.getFullYear();
  };

  const filteredAppointments = appointments.filter((a) => matchesFilter(a.date));
  const filteredReceivables = receivables.filter((r) => matchesFilter(r.date));

  const revenue = filteredReceivables.reduce((acc, item) => acc + item.amount, 0);
  const totalAppointments = filteredAppointments.length;

  // Professional reports
  const professionalReports = useMemo(() => {
    const map: Record<string, ProfessionalReport> = {};
    filteredAppointments.forEach((a) => {
      const prof = professionalMap.get(a.professionalId);
      if (!prof) return;
      if (!map[a.professionalId]) map[a.professionalId] = { name: prof.name, appointments: 0, revenue: 0, commission: 0 };
      map[a.professionalId].appointments++;
      if (a.status === "completed") {
        map[a.professionalId].revenue += a.servicePrice;
        map[a.professionalId].commission += a.servicePrice * (prof.commission / 100);
      }
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredAppointments, professionalMap]);

  const serviceFrequency = Object.entries(
    filteredAppointments.reduce<Record<string, number>>((acc, item) => {
      acc[item.service] = (acc[item.service] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  const barData = filteredAppointments.reduce<Record<string, number>>((acc, item) => {
    acc[item.date] = (acc[item.date] ?? 0) + 1;
    return acc;
  }, {});

  const chartAppointments = Object.entries(barData)
    .map(([date, count]) => ({ day: new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), agendamentos: count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return (
    <div>
      <PageHeader title="Relatórios" description="Análises, métricas e relatório por profissional." />

      <div className="glass-card rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-3 items-start md:items-center">
        <Select value={filterMode} onValueChange={(value) => setFilterMode(value as FilterMode)}>
          <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Dia</SelectItem>
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="year">Ano</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full md:w-56" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Agendamentos" value={totalAppointments} icon={<Calendar className="h-5 w-5" />} />
        <StatCard title="Faturamento" value={toCurrency(revenue)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Serviços" value={serviceFrequency.reduce((acc, item) => acc + item.value, 0)} icon={<Scissors className="h-5 w-5" />} />
        <StatCard title="Profissionais" value={professionalReports.length} icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Agendamentos no período</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartAppointments}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 15% 90%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="agendamentos" fill="hsl(346 60% 55%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-5">
          <h3 className="font-display font-semibold mb-4">Serviços mais realizados</h3>
          {serviceFrequency.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados para o filtro selecionado.</p> : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={serviceFrequency} cx="50%" cy="50%" outerRadius={80} dataKey="value" stroke="none">
                    {serviceFrequency.map((service, i) => <Cell key={service.name} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {serviceFrequency.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 text-sm"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} /><span>{s.name}</span><span className="text-muted-foreground">({s.value})</span></div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Professional reports */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-5">
        <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />Relatório por Profissional</h3>
        {professionalReports.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados para o período.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="pb-2">Profissional</th><th className="pb-2">Atendimentos</th><th className="pb-2">Faturamento</th><th className="pb-2">Comissão</th></tr></thead>
              <tbody>
                {professionalReports.map((p, i) => (
                  <tr key={p.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-medium flex items-center gap-2">
                      {i === 0 && <Trophy className="h-4 w-4 text-warning" />}
                      {p.name}
                    </td>
                    <td className="py-3">{p.appointments}</td>
                    <td className="py-3 font-semibold">{toCurrency(p.revenue)}</td>
                    <td className="py-3 text-primary">{toCurrency(p.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
