import { AnalysisResult } from './analysisEngine';

const DB_NAME = 'CanAnalysisDB';
const DB_VERSION = 1;
const STORE_NAME = 'datasets';

export interface StoredDataset {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  rawText: string;
  result: AnalysisResult;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDataset(id: string, name: string, size: number, rawText: string, result: AnalysisResult): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const storedData: StoredDataset = {
      id,
      name,
      size,
      uploadedAt: new Date().toISOString(),
      rawText,
      result,
    };

    store.put(storedData);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to save dataset in IndexedDB', err);
  }
}

export async function getDataset(id: string): Promise<StoredDataset | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error('Failed to load dataset from IndexedDB', err);
    return null;
  }
}

export async function listStoredDatasets(): Promise<Array<{ id: string; name: string; size: number; uploadedAt: string }>> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const items: StoredDataset[] = request.result || [];
        resolve(
          items.map((item) => ({
            id: item.id,
            name: item.name,
            size: item.size,
            uploadedAt: item.uploadedAt,
          }))
        );
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    return [];
  }
}
