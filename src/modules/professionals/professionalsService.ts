import { supabase } from "@/integrations/supabase/client";

export type ProfessionalListItem = {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  commissionPercentage: number;
};

export async function getProfessionals(): Promise<ProfessionalListItem[]> {
  const { data, error } = await supabase
    .from("professionals")
    .select("id, name, email, phone, specialties, commission_percent")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.name ?? ""),
    email: String(p.email ?? ""),
    phone: String(p.phone ?? ""),
    specialty: (p.specialties ?? []).join(", "),
    commissionPercentage: Number(p.commission_percent ?? 0),
  }));
}
