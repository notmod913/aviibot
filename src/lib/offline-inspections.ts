export type OfflineInspectionSubmission = {
  organization: string;
  location: string;
  date: string;
  time: string;
  inspector: string;
  status: string;
  notes: string | null;
  schedule_id: string;
  latitude: number;
  longitude: number;
  location_accuracy_m: number;
  location_captured_at: string;
  client_submission_id: string;
  photo_data_url: string;
};

export type CachedInspectorSchedule = {
  id: string;
  organization: string;
  location: string;
  date: string;
  time: string;
  inspector: string;
  status: string;
  site_latitude?: number | null;
  site_longitude?: number | null;
  site_radius_m?: number | null;
};

const DATABASE_NAME = "satark-inspector";
const DATABASE_VERSION = 1;
const SUBMISSION_STORE = "inspection-submissions";
const SCHEDULE_STORE = "inspection-schedules";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("Offline storage is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SUBMISSION_STORE)) {
        database.createObjectStore(SUBMISSION_STORE, { keyPath: "client_submission_id" });
      }
      if (!database.objectStoreNames.contains(SCHEDULE_STORE)) {
        database.createObjectStore(SCHEDULE_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestInStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = createRequest(transaction.objectStore(storeName));
    let result: T;

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error);
    };
  }));
}

export function savePendingInspection(inspection: OfflineInspectionSubmission): Promise<IDBValidKey> {
  return requestInStore(SUBMISSION_STORE, "readwrite", (store) => store.put(inspection));
}

export function getPendingInspections(): Promise<OfflineInspectionSubmission[]> {
  return requestInStore(SUBMISSION_STORE, "readonly", (store) => store.getAll());
}

export function removePendingInspection(clientSubmissionId: string): Promise<undefined> {
  return requestInStore(SUBMISSION_STORE, "readwrite", (store) => store.delete(clientSubmissionId));
}

export async function cacheSchedules(schedules: CachedInspectorSchedule[]): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(SCHEDULE_STORE, "readwrite");
    const store = transaction.objectStore(SCHEDULE_STORE);
    store.clear();
    schedules.forEach((schedule) => store.put(schedule));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => database.close());
}

export function getCachedSchedules(): Promise<CachedInspectorSchedule[]> {
  return requestInStore(SCHEDULE_STORE, "readonly", (store) => store.getAll());
}