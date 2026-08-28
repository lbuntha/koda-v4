import { request } from "./sync/api";
import { accessToken } from "./sync/session";
import { SharedArtStore } from "./sharedArtStore";

export interface SvgAssetRecord {
  id: string;
  /** Library grouping. */
  category: string;
  markup: string;
  /** Last Mongo update, as epoch milliseconds. */
  modified?: number;
}

/** Art at the top level belongs to no category yet, which is a legitimate state. */
export const UNCATEGORISED = "uncategorised";

/**
 * Offered in the category field so a collection does not end up with
 * `fruit`, `fruits` and `Fruit` meaning the same thing. Not a closed list —
 * anything kebab-case is accepted, and these vanish once real ones exist.
 */
export const SUGGESTED_SVG_CATEGORIES = [
  // The two collections a picker reads — badges on the Badges tab, thumbnail on
  // a skill's Listing tab. Named here so a family creating one spells it the
  // way the picker looks for it.
  "badges",
  "thumbnail",
  "fruits",
  "vegetables",
  "animals",
  "food",
  "nature",
  "objects",
  "people",
  "shapes",
  "transport",
  "manipulatives",
];

/** Same lowercase-kebab-case rule as the API. */
export const SVG_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

async function token(): Promise<string> {
  const value = await accessToken();
  if (!value) throw new Error("Sign in to manage the art library.");
  return value;
}

/** The live Mongo collection. The bundled registry remains the offline fallback. */
export async function listSvgAssets(): Promise<SvgAssetRecord[]> {
  const body = await request<{ assets: SvgAssetRecord[] }>("/art", { token: await token() });
  await SharedArtStore.replace(body.assets);
  return body.assets;
}

/**
 * Create or replace one asset in MongoDB.
 */
export async function saveSvgAsset(
  id: string,
  markup: string,
  category: string,
): Promise<{ created: boolean; moved: boolean }> {
  return request(`/art/${encodeURIComponent(id)}`, {
    method: "PUT",
    token: await token(),
    body: { markup, category },
  });
}

/**
 * Rename or refile without touching the markup.
 */
export async function moveSvgAsset(
  id: string,
  changes: { toId?: string; category?: string },
): Promise<{ id: string; category: string }> {
  return request(`/art/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token: await token(),
    body: changes,
  });
}

/** Tombstone one asset so the bundled seed does not restore it on restart. */
export async function deleteSvgAsset(id: string): Promise<void> {
  await request<void>(`/art/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token: await token(),
  });
}
