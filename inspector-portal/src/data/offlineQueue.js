const DATABASE_NAME = 'satark-inspector';
const DATABASE_VERSION = 1;
const SUBMISSION_STORE = 'inspection-submissions';
const SCHEDULE_STORE = 'inspection-schedules';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Offline storage is not available in this browser.'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SUBMISSION_STORE)) {
        database.createObjectStore(SUBMISSION_STORE, { keyPath: 'client_submission_id' });
      }
      if (!database.objectStoreNames.contains(SCHEDULE_STORE)) {
        database.createObjectStore(SCHEDULE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    let result;

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
  });
}

export function savePendingInspection(inspection) {
  return withStore(SUBMISSION_STORE, 'readwrite', (store) => store.put(inspection));
}

export function getPendingInspections() {
  return withStore(SUBMISSION_STORE, 'readonly', (store) => store.getAll());
}

export function removePendingInspection(clientSubmissionId) {
  return withStore(SUBMISSION_STORE, 'readwrite', (store) => store.delete(clientSubmissionId));
}

export function cacheSchedules(schedules) {
  return withStore(SCHEDULE_STORE, 'readwrite', (store) => {
    store.clear();
    let lastRequest = store.getAll();
    schedules.forEach((schedule) => {
      lastRequest = store.put(schedule);
    });
    return lastRequest;
  });
}

export function getCachedSchedules() {
  return withStore(SCHEDULE_STORE, 'readonly', (store) => store.getAll());
}