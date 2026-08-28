import { preprocessSvgMarkup } from "../../utils/svg";

/**
 * Artwork a skill ships with itself.
 *
 * The collection in this folder is the *app's* art: shared furniture, managed by
 * an operator on the Art page, overridable per family. A skill's own drawings are
 * a different kind of thing — they are part of the skill the way its activities
 * and its lessons are, and a skill that is disabled or removed should take them
 * with it. Filing counting's rockets beside the app's shapes made the skill
 * folder an incomplete description of the skill.
 *
 * So a skill declares its art through its own `index.ts`, and nothing outside
 * the skill folder globs into it — `docs/PLUGINS.md` §5 makes `index.ts` the
 * only file the rest of the app may import from a skill, and art is not an
 * exception to that.
 *
 * This module is deliberately a leaf: it imports nothing but the preprocessor.
 * `SvgAsset` reads it and skills write to it, so anything richer here would
 * close the loop `SvgAsset -> registry -> skill -> activity -> SvgAsset` into a
 * genuine import cycle the moment an activity draws its own artwork.
 */

const byId = new Map<string, string>();

/**
 * Ids are namespaced `skillId-assetName` — `counting-rocket`.
 *
 * Bare filenames would put every skill into one global namespace — the rule the
 * bundled collection lives by, where "the same filename in two categories is an
 * error". That rule is right for a collection one team curates and wrong for
 * skills written independently: two of them shipping a `star.svg` is a normal
 * thing to happen, not a mistake to refuse.
 *
 * A hyphen rather than the `skillId/lessonId` slash used elsewhere, because
 * these ids have to survive a round trip through the Art page: both the id
 * generator and the save endpoint hold names to `^[a-z0-9]+(-[a-z0-9]+)*$`, so
 * a slash would make a skill's art the one kind an operator could never edit.
 * Consistency with the other refs is worth less than that.
 */
export const skillArtId = (skillId: string, name: string): string => `${skillId}-${name}`;

/**
 * Register one skill's artwork, returning the ids it now answers to.
 *
 * `files` is the result of `import.meta.glob("./assets/*.svg", { query: "?raw",
 * import: "default", eager: true })` — Vite inlines the markup at build time, so
 * a skill's art is present on first render with no fetch and no loading state.
 *
 * Markup is preprocessed once here, exactly as the bundled registry does it, so
 * a skill's art scales to its box and survives JSX-style attributes the same
 * way. Sanitising still happens at render, in `SvgAsset`.
 */
export const registerSkillArt = (
  skillId: string,
  files: Record<string, string>,
): string[] => {
  const ids: string[] = [];
  for (const [filePath, markup] of Object.entries(files)) {
    const name = filePath.split("/").pop()!.replace(/\.svg$/i, "");
    const id = skillArtId(skillId, name);
    byId.set(id, preprocessSvgMarkup(markup));
    ids.push(id);
  }
  return ids.sort();
};

/** Markup for one skill asset, or undefined if no skill ships that id. */
export const getSkillArt = (id: string): string | undefined => byId.get(id);

/** Every registered skill asset id, sorted. Useful for a picker or a test. */
export const skillArtIds = (): string[] => [...byId.keys()].sort();
