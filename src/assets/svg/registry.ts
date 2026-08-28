import { preprocessSvgMarkup } from "../../utils/svg";
import { SVG_ASSET_IDS, type SvgAssetId } from "./ids";

/** Art at the top level belongs to no category yet, which is a legitimate state. */
export const UNCATEGORISED = "uncategorised";

/**
 * The collection a skill's store tile is drawn from.
 *
 * Skill thumbnails and lesson artwork are different jobs — a tile that reads at
 * 64px beside a name, versus a mango a learner counts — so the thumbnail picker
 * offers this collection alone rather than the whole library. Filing art here
 * on the Art page is what puts it in front of a skill.
 *
 * Singular, matching the name the shared library already uses. Spelling it
 * `thumbnails` here would leave the picker looking at an empty collection while
 * the art sat one letter away.
 */
export const THUMBNAIL_ART_CATEGORY = "thumbnail";

export interface SvgAssetEntry {
  id: string;
  category: string;
  markup: string;
}

/**
 * The SVG collection: every `.svg` under this folder, keyed by its filename,
 * filed under the folder it sits in — `fruits/mango.svg` is `mango`, category
 * `fruits`.
 *
 * Vite inlines the markup at build time, so there is no fetch and no loading
 * state — a component that draws artwork has it on first render. Adding art is
 * dropping a file in; nothing here lists the files by hand.
 *
 * `preprocessSvgMarkup` runs once per asset at module load: it strips the
 * authored width/height so the artwork scales to whatever box it is given,
 * keeps the viewBox, and repairs JSX-style attributes an AI tends to emit
 * (`strokeWidth` → `stroke-width`). Sanitising happens later, at render, in
 * `SvgAsset` — see `utils/svg/index.ts` for why the order matters.
 */
const files = import.meta.glob("./**/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const byId = new Map<string, SvgAssetEntry>();
for (const [filePath, markup] of Object.entries(files)) {
  const relative = filePath.replace(/^\.\//, "");
  const segments = relative.split("/");
  const id = segments.pop()!.replace(/\.svg$/i, "");
  byId.set(id, {
    id,
    category: segments.length > 0 ? segments.join("/") : UNCATEGORISED,
    markup: preprocessSvgMarkup(markup),
  });
}

/** Every id in the collection, sorted. Matches `SVG_ASSET_IDS` once ids.ts is current. */
export const svgAssetIds = [...byId.keys()].sort() as SvgAssetId[];

/** Every asset, sorted by id — the list view's starting point. */
export const svgAssets: SvgAssetEntry[] = [...byId.values()].sort((a, b) =>
  a.id.localeCompare(b.id),
);

/** Categories actually in use, sorted, with uncategorised last where it belongs. */
export const svgCategories: string[] = [...new Set(svgAssets.map((asset) => asset.category))].sort(
  (a, b) =>
    a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b),
);

export function getSvgAsset(id: SvgAssetId): string | undefined {
  return byId.get(id)?.markup;
}

export function getSvgCategory(id: SvgAssetId): string | undefined {
  return byId.get(id)?.category;
}

export function hasSvgAsset(id: string): id is SvgAssetId {
  return byId.has(id);
}

// A stale ids.ts is the one way this collection lies: the union says an asset
// exists that the glob never found, or misses one it did. Cheap to notice here.
if (import.meta.env.DEV) {
  const generated = new Set<string>(SVG_ASSET_IDS);
  const missing = svgAssetIds.filter((id) => !generated.has(id));
  const stale = [...generated].filter((id) => !byId.has(id));
  if (missing.length || stale.length) {
    console.warn(
      `[svg] ids.ts is out of date — run \`npm run svg:ids\`.` +
        (missing.length ? ` Not yet typed: ${missing.join(", ")}.` : "") +
        (stale.length ? ` No longer on disk: ${stale.join(", ")}.` : ""),
    );
  }
}
