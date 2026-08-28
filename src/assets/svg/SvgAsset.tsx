import React, { useEffect, useId, useMemo, useSyncExternalStore } from "react";
import { preprocessSvgMarkup, sanitizeSvgMarkup, scopeSvgIds } from "../../utils/svg";
import { ArtStore } from "../../lib/sync/artStore";
import { SharedArtStore } from "../../lib/sharedArtStore";
import { getSvgAsset } from "./registry";
import { getSkillArt } from "./skillArt";
import type { SvgAssetId } from "./ids";

interface SvgMarkupProps {
  /** Raw SVG source. Sanitised here — it never reaches the DOM as written. */
  markup: string;
  /**
   * Box the artwork is drawn into — a number is px, a string is any CSS length,
   * so `"100%"` fills a tile whose size is decided by its own classes. The
   * artwork scales to fit, keeping its aspect ratio.
   */
  size?: number | string;
  className?: string;
  /** Names the image for a screen reader. Omit for decoration, which is then hidden. */
  title?: string;
  /** Drawn instead when nothing survives sanitising. */
  fallback?: React.ReactNode;
  /**
   * Run `preprocessSvgMarkup` first. On for markup straight from an author,
   * off for anything the registry already normalised at load.
   */
  raw?: boolean;
  /**
   * Fill the box, cropping the overflow, instead of fitting inside it.
   *
   * `object-fit: cover` for artwork: a media frame whose shape differs from the
   * art's — a 16:9 card window over a squarer drawing — is filled edge to edge
   * and trimmed evenly on both sides of the long axis, rather than shown small
   * in a letterboxed band. Cropping is centred, so treat the middle of the
   * canvas as the safe area when drawing art that will be shown this way.
   */
  cover?: boolean;
}

/**
 * Rewrites the root element's fit rule to crop rather than letterbox.
 *
 * `preserveAspectRatio` is an attribute, not a style, so cover cannot be a
 * class — the markup itself has to say it. Applied after sanitising, on the
 * opening tag only, replacing whatever the author wrote there.
 */
const withCoverFit = (svg: string): string =>
  svg.replace(
    /<svg\b([^>]*)>/i,
    (_match, attrs: string) =>
      `<svg${attrs.replace(/\s*preserveAspectRatio\s*=\s*"[^"]*"/i, "")} preserveAspectRatio="xMidYMid slice">`,
  );

/**
 * Draws SVG markup.
 *
 * The markup is injected as HTML, so it is sanitised here — immediately before
 * the injection, never earlier and cached — against the allowlist in
 * `utils/svg/svgPolicy.ts`. Ids are scoped per instance, so ten apples on one
 * screen each resolve their own gradient instead of all borrowing the first
 * one's.
 */
export const SvgMarkup: React.FC<SvgMarkupProps> = ({
  markup,
  size = 48,
  className = "",
  title,
  fallback = null,
  raw = false,
  cover = false,
}) => {
  const scope = useId();

  // A counting board draws dozens of these and re-renders on every drag frame;
  // parsing the markup each time would be the expensive part.
  const safeMarkup = useMemo(() => {
    if (!markup) return "";
    const normalised = raw ? preprocessSvgMarkup(markup) : markup;
    const safe = scopeSvgIds(sanitizeSvgMarkup(normalised), scope);
    return cover ? withCoverFit(safe) : safe;
  }, [markup, raw, scope, cover]);

  if (!safeMarkup) return <>{fallback}</>;

  return (
    <span
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`inline-flex items-center justify-center shrink-0 select-none [&>svg]:w-full [&>svg]:h-full ${className}`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: safeMarkup }}
    />
  );
};

interface SvgAssetProps extends Omit<SvgMarkupProps, "markup" | "raw"> {
  /**
   * Filename of the artwork without `.svg`.
   *
   * Typed against the bundled collection, and accepts a plain string as well so
   * a family's own asset — which the build cannot know about — can be named.
   */
  id: SvgAssetId | (string & {});
}

/**
 * Draws one asset, by id.
 *
 * Four sources, in this order:
 *
 *  1. **The family's own library**, synced from the server into IndexedDB.
 *  2. **The shared library**, the deploy-wide collection an operator manages.
 *  3. **A skill's own art** (`src/skills/<id>/assets`), namespaced `skillId-name`.
 *  4. **The bundle** (`src/assets/svg`) — instant, offline on a fresh install,
 *     versioned with the code that uses it.
 *
 * A family asset sharing an id wins, which is how a family replaces a shipped
 * picture without waiting for a release. `raw` is used for family and shared
 * markup because, unlike the bundle, it was not normalised at module load.
 *
 * Skill art sits above the bundle and above the deletion rule below, because it
 * is not the operator's to delete: it belongs to the skill the way an activity
 * does, and removing it is disabling the skill. An operator who overrides one
 * by its full `counting-rocket` id still wins — that is a deliberate override
 * rather than the absence the deletion rule reads.
 */
export const SvgAsset: React.FC<SvgAssetProps> = ({ id, ...rest }) => {
  useSyncExternalStore(ArtStore.subscribe, ArtStore.version, ArtStore.version);
  useSyncExternalStore(SharedArtStore.subscribe, SharedArtStore.version, SharedArtStore.version);

  useEffect(() => {
    void ArtStore.load();
    void SharedArtStore.load();
  }, []);

  const bundled = getSvgAsset(id as SvgAssetId);
  const family = ArtStore.get(id);
  const shared = SharedArtStore.get(id);

  if (family) return <SvgMarkup markup={family.markup} raw {...rest} />;
  if (shared) return <SvgMarkup markup={shared.markup} raw {...rest} />;

  const fromSkill = getSkillArt(id);
  if (fromSkill) return <SvgMarkup markup={fromSkill} {...rest} />;

  // Once a complete Mongo snapshot has arrived, absence is meaningful: an
  // operator deleted this id. Before that, the bundle keeps first paint and
  // first-run offline use instant.
  if (SharedArtStore.isAuthoritative()) return <>{rest.fallback ?? null}</>;

  if (!bundled) {
    /*
     * Only a *missing* asset is worth a warning, and supplying a fallback is
     * how a caller says the id is optional.
     *
     * `koda-ask` is the case: the button draws a lucide icon until somebody
     * files art under that name on the Art page, which is the whole point of
     * the fallback — art can be added later with no code change. Warning about
     * it on every render taught people to ignore this message, which is what
     * makes a genuinely absent asset slip through unnoticed.
     */
    if (import.meta.env.DEV && rest.fallback === undefined) {
      console.warn(
        `[svg] no asset "${id}" and no fallback — not in src/assets/svg, no skill ships it, and not in the family library.`,
      );
    }
    return <>{rest.fallback ?? null}</>;
  }

  return <SvgMarkup markup={bundled} {...rest} />;
};
