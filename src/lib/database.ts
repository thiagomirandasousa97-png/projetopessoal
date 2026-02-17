import type { AuthRole } from "@/hooks/use-auth";

export type Client = {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  email: string;
  birthDate: string;
  visits: number;
  lastVisit: string;
  notes?: string;
  assignedProfessionalIds?: string[];
};

export type Service = {
  id: string;
  ownerId: string;
  name: string;
  durationMin: number;
  price: number;
  category: string;
};

export type FinancialEntryStatus = "pago" | "pendente";

export type Receivable = {
  id: string;
  ownerId: string;
  client: string;
  service: string;
  value: number;
  date: string;
  payment: string;
  status: FinancialEntryStatus;
};

export type Payable = {
  id: string;
  ownerId: string;
  description: string;
  value: number;
  date: string;
  category: string;
  status: FinancialEntryStatus;
};

type DBSchema = {
  clients: Client;
  services: Service;
  receivables: Receivable;
  payables: Payable;
};

const DB_NAME = "salao-flow-db";
const DB_VERSION = 1;
const DB_UPDATED_EVENT = "salao-db-updated";

function openDB() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("clients")) db.createObjectStore("clients", { keyPath: "id" });
      if (!db.objectStoreNames.contains("services")) db.createObjectStore("services", { keyPath: "id" });
      if (!db.objectStoreNames.contains("receivables")) db.createObjectStore("receivables", { keyPath: "id" });
      if (!db.objectStoreNames.contains("payables")) db.createObjectStore("payables", { keyPath: "id" });
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function runTx<T extends keyof DBSchema, R>(
  store: T,
  mode: IDBTransactionMode,
  operation: (objectStore: IDBObjectStore) => IDBRequest<R>,
) {
  const db = await openDB();

  return new Promise<R>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const objectStore = tx.objectStore(store);
    const request = operation(objectStore);

    let result: R;

    request.onsuccess = () => {
      result = request.result;
    };

    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(result);
  });
}

function notifyDbUpdated() {
  window.dispatchEvent(new Event(DB_UPDATED_EVENT));
}

export function onDbUpdated(callback: () => void) {
  window.addEventListener(DB_UPDATED_EVENT, callback);
  return () => window.removeEventListener(DB_UPDATED_EVENT, callback);
}

function assertUser(userId: string | null | undefined): string {
  if (!userId) throw new Error("Usuário não autenticado");
  return userId;
}

function normalizeClient(client: Client): Client {
  return {
    ...client,
    assignedProfessionalIds:
      client.assignedProfessionalIds && client.assignedProfessionalIds.length > 0
        ? client.assignedProfessionalIds
        : [client.ownerId],
  };
}

export const db = {
  async getAll<T extends keyof DBSchema>(store: T, userId: string): Promise<DBSchema[T][]> {
    const authUser = assertUser(userId);
    const all = await runTx(store, "readonly", (s) => s.getAll() as IDBRequest<DBSchema[T][]>);
    return all.filter((item) => item.ownerId === authUser);
  },
  async getClientsForUser(userId: string, role: AuthRole): Promise<Client[]> {
    const rawClients = await db.getAll("clients", userId);
    const clients = rawClients.map(normalizeClient);

    await Promise.all(
      rawClients
        .filter((client) => !client.assignedProfessionalIds || client.assignedProfessionalIds.length === 0)
        .map((client) => db.put("clients", normalizeClient(client), userId)),
    );

    if (role === "admin") return clients;
    return clients.filter((client) => client.assignedProfessionalIds?.includes(userId));
  },
  async put<T extends keyof DBSchema>(store: T, value: DBSchema[T], userId: string): Promise<void> {
    const authUser = assertUser(userId);
    await runTx(store, "readwrite", (s) => s.put({ ...value, ownerId: authUser }));
    notifyDbUpdated();
  },
  async delete<T extends keyof DBSchema>(store: T, id: string): Promise<void> {
    await runTx(store, "readwrite", (s) => s.delete(id));
    notifyDbUpdated();
  },
  async clearUserData(userId: string): Promise<void> {
    const authUser = assertUser(userId);
    const stores: (keyof DBSchema)[] = ["clients", "services", "receivables", "payables"];

    for (const store of stores) {
      const all = await db.getAll(store, authUser);
      await Promise.all(all.map((item) => db.delete(store, item.id)));
    }

    notifyDbUpdated();
  },
  async count<T extends keyof DBSchema>(store: T, userId: string): Promise<number> {
    const all = await db.getAll(store, userId);
    return all.length;
  },
};

export function toCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function createId() {
  return crypto.randomUUID();
}
