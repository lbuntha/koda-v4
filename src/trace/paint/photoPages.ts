/**
 * A child's own photo, made into a colouring page to paint as they like.
 *
 * The photo goes to the AI (/api/paint/photo-page) and only the page comes
 * back; the photo itself is never kept. The page becomes an ordinary colouring
 * item with one step holding every part, played in "my own colours" — so any
 * colour is right and the child paints freely. The painting is saved to My
 * pictures like any other (and from there to the account, see gallery.ts).
 *
 * The page items are kept on this device, per child, in IndexedDB beside the
 * paintings: they carry two images, far too big for localStorage.
 *
 * A child can also upload a colouring page they already have (a printed page,
 * a tracing they photographed): read like a Studio upload, with no AI, so it
 * needs no grown-up's yes and spends no credit.
 *
 * Allowed only when the family's plan has AI (`ai.koda`). Sending a photo to
 * the AI also needs a grown-up to have switched on `photoPagesEnabled` for this
 * child, and spends one of the family's monthly pictures (counted on the
 * server, see server/app/routers/paint.py).
 */

import { AI_FEATURE, Billing } from "../../lib/billing";
import { ChildSettingsAPI } from "../../lib/childSettings";
import { activeLearnerId } from "../../lib/learning";
import { request } from "../../lib/sync";
import { accessToken } from "../../lib/sync/session";
import type { PaintStep, TraceItem } from "../geometry/types";
import { askForColouringPage, dataUrlFile } from "./aiPage";
import { labelAreas } from "./areas";
import { SPECK } from "./grid";
import { DEFAULT_GAP, DEFAULT_STRENGTH, fittedPixels, insidePoints, loadImage, pictureFrom, readFile } from "./picture";

/** Page ids start with this, so a painting in My pictures knows where its page lives. */
export const PHOTO_PREFIX = "photo-";
export const isPhotoPage = (itemId: string) => itemId.startsWith(PHOTO_PREFIX);

/** Why a child cannot make one: the plan (nothing at all), or the grown-up's yes (no photos to the AI; their own pages are fine). */
export type PhotoPageLock = "plan" | "consent" | null;

export function photoPageLock(): PhotoPageLock {
  if (!Billing.has(AI_FEATURE)) return "plan";
  if (!ChildSettingsAPI.current().photoPagesEnabled) return "consent";
  return null;
}

/** The error codes the child's dialog has words for; anything else reads as ai_failed. */
export const PHOTO_ERRORS = ["no_ai_key", "offline", "plan_required", "no_image", "no_credits", "unavailable"] as const;

export interface PhotoCredits {
  limit: number;
  used: number;
  left: number;
  /** When the next month's pictures arrive (ISO). */
  resetsAt: string;
}

/** This family's pictures left this month, or null when it cannot be told (offline, no plan). */
export async function photoCredits(): Promise<PhotoCredits | null> {
  try {
    return await request<PhotoCredits>("/paint/photo-credits", { token: await accessToken(), timeoutMs: 8_000 });
  } catch {
    return null;
  }
}

export type PhotoDetail = "simple" | "patterns";

/** The AI's page → a colouring item: its lines, and one step holding every part. Canvas; browser only. */
export async function pageItem(page: string, title: string, instruction: string): Promise<TraceItem> {
  const picture = pictureFrom(fittedPixels(await loadImage(page)), DEFAULT_STRENGTH, DEFAULT_GAP);
  const base: TraceItem = {
    id: `${PHOTO_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    rev: 1,
    title,
    kind: "drawing",
    grid: "none",
    strokes: [],
    sensitivity: "relaxed",
    activity: "color",
    paint: { steps: [], picture },
  };
  const areas = labelAreas(base);
  const parts = areas.sizes.flatMap((size, label) => (size >= SPECK ? [label] : []));
  const seeds = [...insidePoints(areas, parts).values()];
  const step: PaintStep = { id: "all", color: "sky", seeds, instruction };
  return { ...base, paint: { steps: seeds.length ? [step] : [], picture } };
}

/** A photo file → a new colouring item, kept for this child. Throws an AiPageError when the AI cannot help. */
export async function makePhotoPage(file: File, detail: PhotoDetail, title: string, instruction: string): Promise<TraceItem> {
  const photo = await readFile(file);
  const page = await readFile(dataUrlFile(await askForColouringPage(photo, detail, "child")));
  const item = await pageItem(page, title, instruction);
  await PhotoPages.save(item);
  return item;
}

/** A colouring page the child already has → a new colouring item, kept for this child. No AI. */
export async function uploadOwnPage(file: File, title: string, instruction: string): Promise<TraceItem> {
  const item = await pageItem(await readFile(file), title, instruction);
  await PhotoPages.save(item);
  return item;
}

/* ------------------------------------------------------------- storage */

const DB_NAME = "koda_photo_pages";
const STORE = "pages";

interface Row {
  /** `${learnerId}|${itemId}`. */
  key: string;
  learnerId: string;
  item: TraceItem;
  madeAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "key" });
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

const keyOf = (learnerId: string, itemId: string) => `${learnerId}|${itemId}`;

export const PhotoPages = {
  async save(item: TraceItem, learnerId = activeLearnerId()): Promise<void> {
    await run("readwrite", (s) => s.put({ key: keyOf(learnerId, item.id), learnerId, item, madeAt: Date.now() } satisfies Row));
  },
  /** The page, if it was made on this device. */
  async get(itemId: string, learnerId = activeLearnerId()): Promise<TraceItem | null> {
    try {
      const row = (await run("readonly", (s) => s.get(keyOf(learnerId, itemId)))) as Row | undefined;
      return row?.item ?? null;
    } catch {
      return null;
    }
  },
  async remove(itemId: string, learnerId = activeLearnerId()): Promise<void> {
    try {
      await run("readwrite", (s) => s.delete(keyOf(learnerId, itemId)));
    } catch {
      /* nothing kept */
    }
  },
};
