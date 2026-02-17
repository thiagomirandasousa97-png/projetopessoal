import { createId } from "@/lib/database";

export type Professional = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
};

export function getLocalProfessionals() {
  return [] as Professional[];
}

export function saveLocalProfessionals(_items: Professional[]) {}

export function upsertLocalProfessional(_item: Professional) {}

export function deleteLocalProfessional(_id: string) {}

export function createProfessional(input: Omit<Professional, "id">): Professional {
  return { id: createId(), ...input };
}
