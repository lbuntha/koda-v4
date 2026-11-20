import React from "react";
import { SvgMarkup } from "../../assets/svg";
import { ICON_ART, ICON_PREFIX } from "../../rebus/icons/library";
import { useIconMarkup } from "../../rebus/icons/useRebusIcons";

/**
 * The picture of a word, from the same drawings Rebus Rush uses.
 *
 * A picture is what lets a child who cannot read the clue yet still play: they
 * see a cat, they know the word, and the game becomes spelling it. Drawn on a
 * fixed light tile so artwork made for paper reads the same in dark mode.
 */
export const WordPicture: React.FC<{ id: string; label: string; size?: number }> = ({ id, label, size = 64 }) => {
  const markup = useIconMarkup(id);
  if (!markup) return null;
  return (
    <span role="img" aria-label={label} style={{ width: size, height: size }} className="block shrink-0 rounded-2xl border border-line bg-white p-1.5 shadow-sm">
      <SvgMarkup markup={markup} raw size="100%" />
    </span>
  );
};

/** Every drawing a word can use, by name, for the Studio's picker. */
export const PICTURE_NAMES: readonly string[] = Object.keys(ICON_ART).sort();

/** The drawing a word most likely wants: the English word itself, or a Khmer word's English meaning. */
export function suggestPicture(lang: "km" | "en", word: string, meaningEn: string): string {
  const name = (lang === "en" ? word : meaningEn).trim().toLowerCase().split(/[\s/,]+/)[0] ?? "";
  return name && ICON_ART[name] !== undefined ? ICON_PREFIX + name : "";
}
