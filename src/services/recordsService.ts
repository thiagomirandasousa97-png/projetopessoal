import {
  createRecord,
  deleteRecordById,
  listRecordsByUser,
  type RecordItem,
} from "@/repositories/recordsRepository";

export async function getUserRecords(userId: string): Promise<RecordItem[]> {
  return listRecordsByUser(userId);
}

export async function addUserRecord(input: { title: string; description?: string; userId: string }) {
  return createRecord(input);
}

export async function removeUserRecord(recordId: string) {
  return deleteRecordById(recordId);
}
