import React, { useEffect, useState } from "react";
import { SvgAsset, SvgMarkup } from "../../assets/svg";
import { isPhoto, knownPhotoUrl, photoUrl } from "../../library/photos";
import { ICON_ART, ICON_PREFIX } from "../../rebus/icons/library";
import { useIconMarkup } from "../../rebus/icons/useRebusIcons";

/**
 * The picture of a word.
 *
 * A picture is what lets a child who cannot read the clue yet still play: they
 * see a cat, they know the word, and the game becomes spelling it. It is one of
 * three things, told apart by its id:
 *
 * - `rebus-cat` — a drawing Koda ships (the Art library may redraw it);
 * - `photo-<hash>` — a photo an author uploaded from their computer, kept with
 *   the library's photos and cached on the device once seen;
 * - anything else — a drawing in the shared Art library.
 *
 * Always on a fixed light tile, so artwork made for paper reads the same in dark mode.
 */

/** Where children read an uploaded photo: the library's route, open to every signed-in player. */
export const PICTURE_PHOTO_ROUTE = "library/images";

const tile = "block shrink-0 overflow-hidden rounded-2xl border border-line bg-white shadow-sm";

export const WordPicture: React.FC<{ id: string; label: string; size?: number }> = ({ id, label, size = 64 }) => {
  const style = { width: size, height: size };
  /* `isPhoto` narrows to string, which would leave nothing for the other kinds; ask through a wider type. */
  const key: string | null = id;
  if (isPhoto(key)) return <PhotoPicture id={id} label={label} style={style} />;
  if (id.startsWith(ICON_PREFIX)) return <DrawingPicture id={id} label={label} style={style} />;
  return (
    <span role="img" aria-label={label} style={style} className={`${tile} p-1.5`}>
      <SvgAsset id={id} size="100%" />
    </span>
  );
};

const DrawingPicture: React.FC<{ id: string; label: string; style: React.CSSProperties }> = ({ id, label, style }) => {
  const markup = useIconMarkup(id);
  if (!markup) return null;
  return (
    <span role="img" aria-label={label} style={style} className={`${tile} p-1.5`}>
      <SvgMarkup markup={markup} raw size="100%" />
    </span>
  );
};

const PhotoPicture: React.FC<{ id: string; label: string; style: React.CSSProperties }> = ({ id, label, style }) => {
  const url = usePhoto(id);
  if (!url) return <span aria-hidden style={style} className={`${tile} animate-pulse bg-surface-muted`} />;
  return (
    <span style={style} className={tile}>
      <img src={url} alt={label} className="h-full w-full object-cover" />
    </span>
  );
};

/** A photo's address, from the device's cache when it has one. Null while loading, or offline before it was ever seen. */
export function usePhoto(key: string): string | null {
  const [url, setUrl] = useState<string | null>(() => knownPhotoUrl(key));
  useEffect(() => {
    let live = true;
    void photoUrl(key, PICTURE_PHOTO_ROUTE).then((u) => {
      if (live) setUrl(u);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return url;
}

/** The drawing a word most likely wants: the English word itself, or a Khmer word's English meaning. */
export function suggestPicture(lang: "km" | "en", word: string, meaningEn: string): string {
  const name = (lang === "en" ? word : meaningEn).trim().toLowerCase().split(/[\s/,]+/)[0] ?? "";
  return name && ICON_ART[name] !== undefined ? ICON_PREFIX + name : "";
}
