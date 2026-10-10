/**
 * A child's finished paintings: "My pictures".
 *
 * Kept on the device first, in IndexedDB — a painting is a PNG of tens of
 * kilobytes, far too big for the localStorage quota the rest of the app
 * shares — so saving is instant and works with no signal. Each is then sent to
 * the server (`PUT /trace/paintings/{learner}/{item}`) when the device can, so
 * the child's other tablets and the parent report see it. One painting per
 * child per picture: a newer one replaces the older.
 *
 * Every network call has a deadline and every failure leaves the painting
 * queued on the device; nothing a child does waits on the network.
 */

import { activeLearnerId } from "../../lib/learning";
import { API_BASE, request } from "../../lib/sync";
import { accessToken } from "../../lib/sync/session";

const DB_NAME = "koda_paintings";
const DB_VERSION = 1;
const STORE = "paintings";
const UPLOAD_MS = 20_000;
const DOWNLOAD_MS = 15_000;

export interface Painting {
  /** `${learnerId}|${itemId}`. */
  key: string;
  learnerId: string;
  itemId: string;
  title: string;
  collectionId?: string;
  accuracy: number;
  stars: number;
  ownColours: boolean;
  paintedAt: number;
  png: Blob;
  /** On the server already. */
  uploaded: boolean;
}

export type PaintingMeta = Omit<Painting, "png">;

const keyOf = (learnerId: string, itemId: string) => `${learnerId}|${itemId}`;

let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version += 1;
  listeners.forEach((fn) => fn());
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" }).createIndex("learner", "learnerId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.readAsDataURL(blob);
  });

let uploading = false;

export const Gallery = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  version: () => version,

  /** This child's paintings, newest first. Empty when the device keeps none (or cannot). */
  async list(learnerId = activeLearnerId()): Promise<Painting[]> {
    try {
      const rows = await run<Painting[]>("readonly", (s) => s.index("learner").getAll(learnerId));
      return rows.sort((a, b) => b.paintedAt - a.paintedAt);
    } catch {
      return [];
    }
  },

  async get(itemId: string, learnerId = activeLearnerId()): Promise<Painting | undefined> {
    try {
      return await run<Painting | undefined>("readonly", (s) => s.get(keyOf(learnerId, itemId)));
    } catch {
      return undefined;
    }
  },

  /** Keep a finished painting (replacing this picture's older one), then send it when the device can. */
  async save(p: Omit<Painting, "key" | "uploaded" | "learnerId"> & { learnerId?: string }): Promise<boolean> {
    const learnerId = p.learnerId ?? activeLearnerId();
    const row: Painting = { ...p, learnerId, key: keyOf(learnerId, p.itemId), uploaded: false };
    try {
      const old = await Gallery.get(p.itemId, learnerId);
      if (old && old.paintedAt > row.paintedAt) return true;
      await run("readwrite", (s) => s.put(row));
    } catch {
      return false;
    }
    notify();
    void Gallery.upload();
    return true;
  },

  async remove(itemId: string, learnerId = activeLearnerId()): Promise<void> {
    try {
      await run("readwrite", (s) => s.delete(keyOf(learnerId, itemId)));
    } catch {
      /* nothing kept */
    }
    notify();
    try {
      const token = await accessToken();
      await request(`/trace/paintings/${encodeURIComponent(learnerId)}/${encodeURIComponent(itemId)}`, { method: "DELETE", token, timeoutMs: UPLOAD_MS });
    } catch {
      /* the server copy goes the next time this is tried; a refused delete is not the child's problem */
    }
  },

  /** Send every painting this device has not sent yet. Quiet on failure: they stay queued. */
  async upload(): Promise<void> {
    if (uploading || (typeof navigator !== "undefined" && navigator.onLine === false)) return;
    uploading = true;
    try {
      const all = await run<Painting[]>("readonly", (s) => s.getAll());
      const token = await accessToken();
      if (!token) return;
      for (const p of all.filter((x) => !x.uploaded)) {
        try {
          await request(`/trace/paintings/${encodeURIComponent(p.learnerId)}/${encodeURIComponent(p.itemId)}`, {
            method: "PUT",
            token,
            timeoutMs: UPLOAD_MS,
            body: { image: await blobToBase64(p.png), title: p.title, collectionId: p.collectionId ?? null, accuracy: p.accuracy, stars: p.stars, ownColours: p.ownColours, paintedAt: p.paintedAt },
          });
          const now = await Gallery.get(p.itemId, p.learnerId);
          // Only mark it sent if it is still the painting that was sent.
          if (now && now.paintedAt === p.paintedAt) await run("readwrite", (s) => s.put({ ...now, uploaded: true }));
        } catch {
          // No family (an admin's own account), offline, refused: keep it here and try another time.
        }
      }
    } catch {
      /* no IndexedDB */
    } finally {
      uploading = false;
    }
  },

  /**
   * Bring down this child's paintings made on another tablet. Newer local ones
   * win; anything that fails is simply left for next time.
   */
  async pull(learnerId = activeLearnerId()): Promise<void> {
    try {
      const token = await accessToken();
      if (!token) return;
      const { paintings } = await request<{ paintings: PaintingMeta[] }>(`/trace/paintings/${encodeURIComponent(learnerId)}`, { token, timeoutMs: DOWNLOAD_MS });
      let changed = false;
      for (const m of paintings) {
        const local = await Gallery.get(m.itemId, learnerId);
        if (local && local.paintedAt >= m.paintedAt) continue;
        const png = await fetchPng(learnerId, m.itemId, token);
        if (!png) continue;
        await run("readwrite", (s) => s.put({ ...m, learnerId, ownColours: Boolean(m.ownColours), key: keyOf(learnerId, m.itemId), png, uploaded: true } satisfies Painting));
        changed = true;
      }
      if (changed) notify();
    } catch {
      /* offline, no family, no IndexedDB: the device's own paintings are still there */
    }
  },
};

/** One painting's PNG from the server, with the child's sign-in. Null when it cannot be had now. */
export async function fetchPng(learnerId: string, itemId: string, token?: string | null): Promise<Blob | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_MS);
  try {
    const t = token ?? (await accessToken());
    const res = await fetch(`${API_BASE}/trace/paintings/${encodeURIComponent(learnerId)}/${encodeURIComponent(itemId)}/image`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Give the child the picture as a file: a phone or tablet's share sheet (save
 * to photos, send to family), elsewhere a download. False when it could not be
 * done; closing the share sheet counts as done.
 */
export async function sharePicture(blob: Blob, title: string): Promise<boolean> {
  const name = `${title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "painting"}.png`;
  const file = new File([blob], name, { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return true;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return true;
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return true;
  } catch {
    return false;
  }
}

// Back online: send what waited.
if (typeof window !== "undefined") window.addEventListener("online", () => void Gallery.upload());
