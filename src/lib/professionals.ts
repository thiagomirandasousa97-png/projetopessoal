import { createId } from "@/lib/database";

export type Professional = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
};

const STORAGE_KEY = "local-professionals";

export function getLocalProfessionals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [] as Professional[];
    return JSON.parse(raw) as Professional[];
  } catch {
    return [] as Professional[];
  }
}

export function saveLocalProfessionals(items: Professional[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function upsertLocalProfessional(item: Professional) {
  const all = getLocalProfessionals();
  const exists = all.find((p) => p.id === item.id);
  const next = exists ? all.map((p) => (p.id === item.id ? item : p)) : [item, ...all];
  saveLocalProfessionals(next);
}

export function deleteLocalProfessional(id: string) {
  saveLocalProfessionals(getLocalProfessionals().filter((p) => p.id !== id));
}

export function createProfessional(input: Omit<Professional, "id">): Professional {
  return { id: createId(), ...input };
}
