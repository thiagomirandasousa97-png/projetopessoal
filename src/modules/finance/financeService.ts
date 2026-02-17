import { supabase } from "@/integrations/supabase/client";

export type FinanceOverview = {
  monthlyRevenue: number;
  overdueCount: number;
};

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: receivables }, { data: overdue }] = await Promise.all([
    supabase
      .from("financial_receivables")
      .select("amount")
      .eq("status", "paid")
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("financial_receivables")
      .select("id")
      .eq("status", "overdue"),
  ]);

  return {
    monthlyRevenue: (receivables ?? []).reduce((acc, item) => acc + Number(item.amount ?? 0), 0),
    overdueCount: (overdue ?? []).length,
  };
}
