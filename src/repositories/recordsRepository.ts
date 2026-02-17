import { supabase } from "@/lib/supabaseClient";

export type RecordItem = {
  id: string;
  title: string;
  description: string | null;
  user_id: string;
  created_at: string;
};

export async function listRecordsByUser(userId: string) {
  const { data, error } = await supabase
    .from("records")
    .select("id, title, description, user_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as RecordItem[];
}

export async function createRecord(input: { title: string; description?: string; userId: string }) {
  const { error } = await supabase.from("records").insert({
    title: input.title.trim(),
    description: input.description?.trim() || null,
    user_id: input.userId,
  });

  if (error) throw error;
}

export async function deleteRecordById(recordId: string) {
  const { error } = await supabase.from("records").delete().eq("id", recordId);
  if (error) throw error;
}
