import { useCallback, useEffect, useState } from "react";
import { addUserRecord, getUserRecords, removeUserRecord } from "@/services/recordsService";
import type { RecordItem } from "@/repositories/recordsRepository";

export function useRecords(userId?: string) {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      return;
    }

    setIsLoading(true);
    try {
      const data = await getUserRecords(userId);
      setRecords(data);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (title: string, description?: string) => {
      if (!userId) throw new Error("User is not authenticated.");
      await addUserRecord({ title, description, userId });
      await load();
    },
    [load, userId],
  );

  const remove = useCallback(
    async (recordId: string) => {
      await removeUserRecord(recordId);
      await load();
    },
    [load],
  );

  return { records, isLoading, load, create, remove };
}
