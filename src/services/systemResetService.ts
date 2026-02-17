import { supabase } from "@/lib/supabaseClient";

async function clearIndexedDbDatabases() {
  if (!("indexedDB" in window) || !("databases" in indexedDB)) return;
  const databases = await indexedDB.databases();

  await Promise.all(
    databases
      .map((db) => db.name)
      .filter((name): name is string => Boolean(name))
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
  );
}

async function clearBrowserCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
}

export async function resetSystemState(userId: string) {
  await supabase.from("records").delete().eq("user_id", userId);
  await supabase.auth.signOut();

  localStorage.clear();
  sessionStorage.clear();
  await clearIndexedDbDatabases();
  await clearBrowserCaches();
}
