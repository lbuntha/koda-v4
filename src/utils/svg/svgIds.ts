export function createSvgAssetId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return `custom_svg_${uuid ?? `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`}`;
}

/**
 * Preserve every asset while repairing duplicate or blank legacy ids.
 *
 * Generic over the asset shape — this file knows only that an asset carries an
 * `id`, so it works for whatever record a caller stores its markup in.
 */
export function normalizeSvgAssetIds<T extends { id?: string }>(assets: T[]): T[] {
  const seen = new Set<string>();
  return assets.map((asset) => {
    const id = asset.id?.trim();
    if (id && !seen.has(id)) {
      seen.add(id);
      return asset;
    }
    let next = createSvgAssetId();
    while (seen.has(next)) next = createSvgAssetId();
    seen.add(next);
    return { ...asset, id: next };
  });
}

/**
 * Scope SVG definition ids per rendered instance. This prevents gradients,
 * masks, and clip paths from one copy resolving against another copy's DOM.
 * Duplicate ids inside one legacy SVG are also made unique; references keep
 * pointing to the first definition, matching browser behavior.
 */
export function scopeSvgIds(markup: string, scope: string): string {
  const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, "") || "svg";
  const firstIds = new Map<string, string>();
  const occurrences = new Map<string, number>();

  let scoped = markup.replace(/\bid\s*=\s*(["'])([^"']+)\1/gi, (_match, quote: string, rawId: string) => {
    const count = (occurrences.get(rawId) ?? 0) + 1;
    occurrences.set(rawId, count);
    const base = `${safeScope}-${rawId.replace(/[^a-zA-Z0-9_.-]/g, "-")}`;
    const nextId = count === 1 ? base : `${base}-${count}`;
    if (count === 1) firstIds.set(rawId, nextId);
    return `id=${quote}${nextId}${quote}`;
  });

  for (const [rawId, nextId] of firstIds) {
    const escaped = rawId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    scoped = scoped
      .replace(new RegExp(`url\\(\\s*#${escaped}\\s*\\)`, "g"), `url(#${nextId})`)
      .replace(new RegExp(`(["'])#${escaped}\\1`, "g"), (_match, quote: string) => `${quote}#${nextId}${quote}`)
      .replace(new RegExp(`(["'])${escaped}\\.`, "g"), (_match, quote: string) => `${quote}${nextId}.`);
  }
  return scoped;
}
