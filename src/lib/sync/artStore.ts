/**
 * A family's own artwork, kept in IndexedDB.
 *
 * This is the one synced kind that cannot live in `localStorage`: a settings
 * blob is a few hundred bytes and an SVG is thousands, so a few dozen pictures
 * would exhaust the ~5 MB quota that everything else in the app shares. It is
 * exactly the signal named in `outbox.ts` for reaching for IndexedDB.
 *
 * Written with the raw API rather than a wrapper library — one object store,
 * four operations, and no dependency to keep current.
 *
 * The bundled collection in `src/assets/svg` is untouched by any of this. It
 * ships with the code, works offline on a fresh install with no account, and a
 * family asset sharing its id simply wins at render time.
 */

const DB_NAME = "koda_art";
const DB_VERSION = 1;
const STORE = "assets";

export interface ArtAsset {
  /** The filename-style id an `<SvgAsset id="…">` names. */
  id: string;
  markup: string;
  category: string;
  /** Server revision, so a pull can tell new from already-applied. */
  rev: number;
}

let cache: Map<string, ArtAsset> | null = null;
let version = 0;
const listeners = new Set<() => void>();

const notify = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Load everything into memory once.
 *
 * Rendering has to be synchronous — a counting board draws dozens of these per
 * frame — so the store is read into a Map at start-up and served from there.
 * A family's library is tens of assets, not thousands.
 */
export async function loadArt(): Promise<Map<string, ArtAsset>> {
  if (cache) return cache;
  try {
    const rows = await withStore<ArtAsset[]>("readonly", (store) => store.getAll());
    cache = new Map(rows.map((row) => [row.id, row]));
  } catch {
    // No IndexedDB (private mode, an old browser): the bundled collection is
    // still there, so the app draws — it just cannot add to it.
    cache = new Map();
  }
  notify();
  return cache;
}

export async function putArt(asset: ArtAsset): Promise<void> {
  const map = await loadArt();
  map.set(asset.id, asset);
  notify();
  await withStore("readwrite", (store) => store.put(asset)).catch(() => undefined);
}

export async function removeArt(id: string): Promise<void> {
  const map = await loadArt();
  map.delete(id);
  notify();
  await withStore("readwrite", (store) => store.delete(id)).catch(() => undefined);
}

/** Synchronous read for render paths. Empty until `loadArt()` has resolved. */
export const familyArt = (): Map<string, ArtAsset> => cache ?? new Map();

export const ArtStore = {
  load: loadArt,
  put: putArt,
  remove: removeArt,
  all: familyArt,
  get: (id: string): ArtAsset | undefined => familyArt().get(id),
  version: (): number => version,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
