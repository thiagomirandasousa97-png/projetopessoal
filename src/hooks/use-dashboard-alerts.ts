import { useMemo } from "react";

export type DashboardAlert = {
  id: string;
  title: string;
  description: string;
  tone: "danger" | "warning" | "info";
};

export function useDashboardAlerts(input: {
  overdueCount: number;
  birthdaysToday: number;
  appointmentsToday: number;
}) {
  return useMemo<DashboardAlert[]>(() => {
    const alerts: DashboardAlert[] = [];

    if (input.overdueCount > 0) {
      alerts.push({
        id: "overdue",
        title: "Contas em atraso",
        description: `${input.overdueCount} contas estão vencidas e precisam de atenção.`,
        tone: "danger",
      });
    }

    if (input.birthdaysToday > 0) {
      alerts.push({
        id: "birthday",
        title: "Aniversariantes",
        description: `Hoje existem ${input.birthdaysToday} clientes aniversariantes.`,
        tone: "info",
      });
    }

    if (input.appointmentsToday > 10) {
      alerts.push({
        id: "busy-day",
        title: "Agenda intensa",
        description: `Você tem ${input.appointmentsToday} agendamentos para hoje.`,
        tone: "warning",
      });
    }

    return alerts;
  }, [input.appointmentsToday, input.birthdaysToday, input.overdueCount]);
}
