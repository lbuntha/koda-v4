import React from "react";
import { SvgAsset, useHasArt } from "../../assets/svg";
import { resolveLessonIcon, lessonIcons } from "./lessonIcons";

/**
 * Category artwork. Colour is decoration only — every tile sits beside the
 * skill's name and category in words, so nothing depends on telling two
 * gradients apart.
 *
 * `art` is the thumbnail's gradient; `solid` is the flat fill a unit header
 * uses, where a gradient across a wide bar reads as a smudge rather than a
 * colour.
 */
export const SKILL_CATEGORY_ART: Record<
  string,
  { art: string; solid: string; label: string }
> = {
  "number-sense": { art: "from-indigo-500 to-violet-500", solid: "bg-violet-600", label: "Number Sense" },
  operations: { art: "from-emerald-500 to-teal-500", solid: "bg-emerald-600", label: "Operations" },
  "place-value": { art: "from-amber-500 to-orange-500", solid: "bg-amber-600", label: "Place Value" },
  patterns: { art: "from-sky-500 to-cyan-500", solid: "bg-sky-600", label: "Patterns" },
  fractions: { art: "from-rose-500 to-pink-500", solid: "bg-rose-600", label: "Fractions" },
  measurement: { art: "from-lime-500 to-emerald-500", solid: "bg-lime-600", label: "Measurement" },
  geometry: { art: "from-fuchsia-500 to-purple-500", solid: "bg-fuchsia-600", label: "Geometry" },
};

export const skillArtFor = (category?: string) =>
  SKILL_CATEGORY_ART[category ?? ""] ?? {
    art: "from-slate-500 to-slate-600",
    solid: "bg-slate-600",
    label: "Skill",
  };

const isImage = (v: string) =>
  v.startsWith("http") || v.startsWith("/") || v.startsWith("data:");

/**
 * A value that is meant to be drawn as itself — an emoji, not a name.
 *
 * The text branch exists for emoji, so it takes only what cannot be a name:
 * no ASCII letters or digits, and short. Without that floor, an id the art
 * libraries had not answered for yet — one still loading, or simply mistyped —
 * came out as its own letters in a coloured square, which reads as a rendering
 * bug rather than as "no such artwork".
 */
const isEmoji = (v: string) => !/[a-zA-Z0-9]/.test(v) && [...v].length <= 4;

/**
 * Whether this thumbnail draws real artwork, or falls back to a glyph.
 *
 * A poster's media band is sized on the answer: a drawn illustration earns
 * 16:9, and an icon on a gradient does not get better at 220px tall — on a
 * phone that is a third of the screen carrying one symbol. Exported as a hook
 * because artwork can arrive from the family or shared collections after the
 * first render, and the card has to re-size when it does.
 */
export const useHasSkillArtwork = (thumbnail?: string): boolean => {
  const value = thumbnail?.trim() ?? "";
  const isArt = useHasArt(value);
  return Boolean(value) && (isImage(value) || isArt);
};

export interface UISkillThumbnailProps {
  /** The manifest's `thumbnail`, or a per-install override. */
  thumbnail?: string;
  /** Fallback when `thumbnail` is empty — usually the first lesson's icon. */
  fallbackIconName?: string;
  category?: string;
  size?: "sm" | "md" | "lg";
  /** Lets the tile fill a parent-controlled media frame instead of a size bucket. */
  fill?: boolean;
  /**
   * Crops artwork to fill that frame rather than fitting inside it.
   *
   * For a frame whose shape is not the art's — art drawn to some other ratio
   * than the 16:9 a listing expects, which would otherwise sit small in a
   * letterboxed band. Only meaningful with `fill`.
   */
  cover?: boolean;
  className?: string;
}

/**
 * The no-artwork tile filling a media frame the parent sized.
 *
 * A skill with an emoji or an icon still needs to hold the same slot in a shelf
 * of posters, so it fills the panel and scales its glyph up to match, rather
 * than sitting as a small square adrift in a tall frame.
 */
const FILL_BOX = "w-full h-full text-5xl [&_svg]:w-12 [&_svg]:h-12";

const SIZES = {
  sm: "w-10 h-10 rounded-xl text-xl [&_svg]:w-5 [&_svg]:h-5",
  md: "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl text-3xl [&_svg]:w-7 [&_svg]:h-7",
  lg: "w-20 h-20 rounded-3xl text-4xl [&_svg]:w-10 [&_svg]:h-10",
};

/**
 * Artwork gets no tile behind it, and a box at the 16:9 a store listing is
 * drawn to.
 *
 * A drawn asset already carries its own shape, shadow and colour — a gradient
 * square behind it is a second frame around a framed thing. The box is sized by
 * width and takes its height from the ratio, so conforming art fills it exactly
 * and art drawn to some other shape is centred rather than stretched.
 */
const ART_SIZES = {
  sm: "w-24 aspect-[16/9]",
  md: "w-40 sm:w-48 aspect-[16/9]",
  lg: "w-56 sm:w-64 aspect-[16/9]",
};

/**
 * A skill's tile, from one editable string.
 *
 * Four forms in one field so the editor can stay a single text box: a URL or
 * data URI renders as an image, an id from any art library draws that artwork,
 * a known icon key renders that icon, and an emoji renders as itself — no
 * separate field and no upload.
 *
 * Art is checked before icon names, so where both sets hold the same word (a
 * `star.svg` and the `star` icon) the drawn artwork wins. Art means all three
 * libraries, not just the bundle: a family or the shared collection can hold a
 * picture this build has never seen, and a tile that only knew the bundle
 * printed such an id as its own letters.
 */
export const UISkillThumbnail: React.FC<UISkillThumbnailProps> = ({
  thumbnail,
  fallbackIconName,
  category,
  size = "md",
  fill = false,
  cover = false,
  className = "",
}) => {
  const value = thumbnail?.trim();
  // Hooks run for every render, so this is asked before any branch returns.
  const isArt = useHasArt(value ?? "");

  const art = skillArtFor(category).art;
  // A frame the parent sized owns the whole panel; otherwise the size bucket does.
  const box = `${fill ? FILL_BOX : SIZES[size]} bg-gradient-to-br ${art} flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${className}`;

  if (value && isImage(value)) {
    return (
      <div className={box}>
        {/* Decorative: the skill's name is always rendered beside it. */}
        <img src={value} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  if (value && isArt) {
    return (
      <div
        className={`${fill ? "w-full h-full" : ART_SIZES[size]} flex items-center justify-center shrink-0 ${className}`}
      >
        {/* Decorative, like the image branch: the skill's name sits beside it. */}
        <SvgAsset id={value} size="100%" cover={cover && fill} />
      </div>
    );
  }

  if (value && isEmoji(value)) {
    return (
      <div className={box}>
        <span aria-hidden="true" className="leading-none">
          {value}
        </span>
      </div>
    );
  }

  // An unresolvable value — art still loading, or a name nothing answers for —
  // falls back to what the skill shipped rather than to a question mark.
  const Icon = resolveLessonIcon(value && value in lessonIcons ? value : fallbackIconName);
  return (
    <div className={box}>
      <Icon className="text-white" />
    </div>
  );
};
