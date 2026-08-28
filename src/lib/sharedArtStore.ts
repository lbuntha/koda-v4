import type { SvgAssetRecord } from "./svgAssetsApi";

const DB_NAME = "koda_shared_art";
const DB_VERSION = 1;
const STORE = "assets";
const SNAPSHOT_KEY = "koda_shared_art_snapshot_v1";

let cache: Map<string, SvgAssetRecord> | null = null;
let authoritative = false;
let version = 0;
const listeners = new Set<() => void>();

const notify = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSharedArt(): Promise<void> {
  if (cache) return;
  cache = new Map();
  const loadingCache = cache;
  try {
    const db = await open();
    const rows = await new Promise<SvgAssetRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
    // A network refresh may have completed while IndexedDB was reading. Never
    // let the older disk snapshot replace that newer complete response.
    if (cache === loadingCache) {
      cache = new Map(rows.map((row) => [row.id, row]));
      authoritative = localStorage.getItem(SNAPSHOT_KEY) === "1";
    }
  } catch {
    // A fresh/offline browser keeps using the bundled registry.
  }
  notify();
}

/** Replace the cached snapshot only after a complete API list succeeds. */
export async function replaceSharedArt(assets: SvgAssetRecord[]): Promise<void> {
  cache = new Map(assets.map((asset) => [asset.id, asset]));
  authoritative = true;
  notify();
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      store.clear();
      for (const asset of assets) store.put(asset);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
    localStorage.setItem(SNAPSHOT_KEY, "1");
  } catch {
    // The in-memory snapshot still serves this tab; bundled art remains the
    // fallback on a later fresh load if IndexedDB is unavailable.
  }
}

export const SharedArtStore = {
  load: loadSharedArt,
  replace: replaceSharedArt,
  get: (id: string): SvgAssetRecord | undefined => cache?.get(id),
  /** Synchronous read for render paths. Empty until `load()` has resolved. */
  all: (): SvgAssetRecord[] => (cache ? [...cache.values()] : []),
  isAuthoritative: (): boolean => authoritative,
  version: (): number => version,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
