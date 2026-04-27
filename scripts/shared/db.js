import { AI_STORE, DB_NAME, DB_VERSION } from "./constants.js";

let dbPromise;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AI_STORE)) {
        const store = db.createObjectStore(AI_STORE, { keyPath: "key" });
        store.createIndex("by-updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getDb() {
  if (!dbPromise) {
    dbPromise = openDatabase();
  }
  return dbPromise;
}

export async function getAllAiTagRecords() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AI_STORE, "readonly");
    const request = tx.objectStore(AI_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function putAiTagRecord(record) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AI_STORE, "readwrite");
    tx.objectStore(AI_STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAiTagRecords() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AI_STORE, "readwrite");
    tx.objectStore(AI_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
