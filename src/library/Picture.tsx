import { useEffect, useState } from "react";
import { isPhoto, knownPhotoUrl, photoUrl } from "./photos";
import { SvgAsset, SvgMarkup } from "../assets/svg";

/**
 * A story picture, by key.
 *
 * The art library comes first — `mango`, `orange`, `apple` and `grape` are
 * already there, and anything an operator uploads under a key wins over what is
 * bundled here. Behind it, a few house-style drawings for the starter stories;
 * behind those, a book. A story never shows an empty box.
 *
 * The house drawings are markup rather than JSX so the Library Studio can hand
 * one to the art editor as the starting point for a replacement: an author who
 * does not like this `market` opens it, redraws it, and saves it to the art
 * library under the same key, where it then wins everywhere.
 */

const LOCAL: Record<string, string> = {
  market: `<svg viewBox="0 0 200 128">
  <ellipse cx="100" cy="118" rx="72" ry="8" fill="#6B46C1" opacity=".1" />
  <rect x="34" y="62" width="132" height="50" rx="6" fill="#B794F4" />
  <path d="M26 62 40 30h120l14 32z" fill="#805AD5" />
  <path d="M40 30 34 62M70 30 64 62M100 30v32M130 30l6 32M160 30l6 32" stroke="#fff" stroke-width="4" opacity=".55" />
  <circle cx="70" cy="86" r="11" fill="#FF5E9B" />
  <circle cx="100" cy="86" r="11" fill="#FF5E9B" />
  <circle cx="130" cy="86" r="11" fill="#FFB3D1" />
</svg>`,
  banana: `<svg viewBox="0 0 200 128">
  <ellipse cx="100" cy="116" rx="50" ry="8" fill="#6B46C1" opacity=".1" />
  <path d="M44 42q6 56 62 58 46 2 52-32-22 18-52 12T60 38z" fill="#B794F4" />
  <path d="M44 42q6 56 62 58 46 2 52-32" fill="none" stroke="#6B46C1" stroke-width="5" stroke-linecap="round" />
  <path d="M44 42l-8-12 16 4z" fill="#7A523A" />
</svg>`,
  cat: `<svg viewBox="0 0 200 128">
  <ellipse cx="100" cy="112" rx="58" ry="10" fill="#6B46C1" opacity=".1" />
  <path d="M70 52 62 24l26 14z" fill="#805AD5" />
  <path d="M130 52 138 24l-26 14z" fill="#805AD5" />
  <ellipse cx="100" cy="72" rx="38" ry="34" fill="#B794F4" />
  <circle cx="87" cy="66" r="5" fill="#2D1B4E" />
  <circle cx="113" cy="66" r="5" fill="#2D1B4E" />
  <path d="M94 80h12l-6 7z" fill="#FF5E9B" />
</svg>`,
  nest: `<svg viewBox="0 0 200 128">
  <ellipse cx="82" cy="78" rx="17" ry="20" fill="#fff" stroke="#CBD5E1" stroke-width="3" />
  <ellipse cx="118" cy="78" rx="17" ry="20" fill="#fff" stroke="#CBD5E1" stroke-width="3" />
  <ellipse cx="100" cy="66" rx="17" ry="20" fill="#fff" stroke="#CBD5E1" stroke-width="3" />
  <path d="M36 86a64 34 0 0 0 128 0z" fill="#9A6B4F" />
</svg>`,
  rain: `<svg viewBox="0 0 200 128">
  <circle cx="76" cy="52" r="24" fill="#B794F4" />
  <circle cx="108" cy="42" r="28" fill="#B794F4" />
  <circle cx="138" cy="54" r="20" fill="#B794F4" />
  <rect x="58" y="54" width="92" height="22" rx="11" fill="#B794F4" />
  <path d="M70 88l-6 16M100 88l-6 16M130 88l-6 16M85 108l-6 14M115 108l-6 14" stroke="#7CC4F5" stroke-width="6" stroke-linecap="round" />
</svg>`,
  tower: `<svg viewBox="0 0 200 128">
  <rect x="46" y="88" width="34" height="28" rx="5" fill="#805AD5" />
  <rect x="83" y="88" width="34" height="28" rx="5" fill="#FF5E9B" />
  <rect x="120" y="88" width="34" height="28" rx="5" fill="#2E9D73" />
  <rect x="64" y="58" width="34" height="28" rx="5" fill="#B794F4" />
  <rect x="102" y="58" width="34" height="28" rx="5" fill="#805AD5" />
  <rect x="83" y="28" width="34" height="28" rx="5" fill="#FF5E9B" />
</svg>`,
  puddle: `<svg viewBox="0 0 200 128">
  <ellipse cx="100" cy="88" rx="72" ry="24" fill="#7CC4F5" />
  <ellipse cx="100" cy="84" rx="52" ry="14" fill="#B8E0FA" />
  <path d="M100 14q12 18 0 28-12-10 0-28z" fill="#7CC4F5" />
</svg>`,
  book: `<svg viewBox="0 0 200 128">
  <path d="M100 30q-30-14-64-6v70q34-8 64 6z" fill="#B794F4" />
  <path d="M100 30q30-14 64-6v70q-34-8-64 6z" fill="#805AD5" />
  <path d="M100 30v70" stroke="#fff" stroke-width="3" opacity=".6" />
</svg>`,
};

/**
 * Every picture key a story may use: the drawings here, and the pictures already
 * in the art library. A drafter is told this list and a word whose picture is not
 * on it is dropped rather than drawn as a book.
 */
export const PICTURE_KEYS: readonly string[] = [...Object.keys(LOCAL).filter((k) => k !== "book"), "apple", "grape", "mango", "orange"].sort();

/**
 * `fill` makes the picture position itself with `absolute inset-0` against its
 * own parent, instead of the usual `h-full w-full` (a normal-flow box that fills
 * a parent already sized by CSS). Only the cover needs this: its frame carries
 * padding on the picture itself, and `absolute inset-0` is what lets a box fill
 * a positioned parent while its own padding still insets the content.
 *
 * The two must never both be present. `h-full`/`w-full` need the parent's
 * *percentage* height to resolve, which the CSS spec only guarantees when the
 * parent's height is a literal, specified length — a flex-grown or grid-stretched
 * height (exactly what a book page's height is, several layers deep) does not
 * count, however solid the number looks once rendered. `inset-0` sizes from the
 * parent's actual layout box directly and has no such condition, so `fill` is
 * the one that keeps working through a page's real layout — confirmed by
 * reproducing the cover blanking out with the exact ancestor chain a book page
 * has (a `grid` with no declared columns/rows, over nested flex columns) and
 * fixing it only by removing the losing side of the conflict, not by changing
 * anything about the numbers.
 *
 * `onRatio` reports the picture's own width ÷ height once it is known — the
 * photo's natural size, or a drawing's viewBox — so a caller can shape a frame
 * around the picture rather than crop the picture to fit a frame it was never
 * made for.
 *
 * `whole` shows a photo in full, uncropped, with the frame's tint filling
 * whatever the photo's own shape leaves over. A photo is otherwise cropped to fill
 * its frame, which is right for a picture on a page and wrong for a cover, where
 * the whole picture is the point. A drawing is always shown whole unless `cover`
 * says otherwise, so this only changes photos.
 *
 * `cover` fills the frame edge to edge and trims what overflows, as a photo does,
 * instead of fitting the whole drawing inside it. Used for a picture across the
 * top of a page, where fitting left a drawing that is nearly square small in a
 * wide, short frame with empty bands either side. The frame's height is not
 * changed; the drawing is scaled to its width and centred, so the middle of a
 * drawing is what stays in view.
 */
export function Picture({ name, label, className = "", cover = false, whole = false, fill = false, onRatio }: { name: string; label?: string; className?: string; cover?: boolean | number; whole?: boolean; fill?: boolean; onRatio?(ratio: number): void }) {
  if (isPhoto(name)) return <Photo name={name} label={label} className={className} whole={whole} fill={fill} onRatio={onRatio} />;
  const fallback = <SvgMarkup markup={LOCAL[name] ?? LOCAL.book} raw size="100%" cover={cover} onRatio={onRatio} />;
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`block ${fill ? "absolute inset-0" : "h-full w-full"} ${className}`}>
      <SvgAsset id={name} size="100%" fallback={fallback} cover={cover} onRatio={onRatio} />
    </span>
  );
}

/** Padding suits a drawing floating in its frame; a photo fills the frame edge to edge. */
const withoutPadding = (c: string) => c.replace(/(^|\s)(?:[a-z]+:)*p[xytrbl]?-\S+/g, " ");

/**
 * An uploaded photo, cropped to fill its frame. The plain book picture stands in
 * until it loads, or if it cannot.
 *
 * A photo arrives over the network, so it cannot be on the page at first paint.
 * Rather than a hole that snaps shut, the frame holds a quiet tint and the photo
 * fades in over it once the browser has actually decoded it — `onLoad`, not the
 * moment the URL is known, or the fade would run against a blank frame. A photo
 * already in hand skips the fade, so a page turned back to does not flicker.
 */
function Photo({ name, label, className, whole = false, fill = false, onRatio }: { name: string; label?: string; className: string; whole?: boolean; fill?: boolean; onRatio?(ratio: number): void }) {
  const [url, setUrl] = useState<string | null>(() => knownPhotoUrl(name));
  const [shown, setShown] = useState(() => knownPhotoUrl(name) !== null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    setShown(knownPhotoUrl(name) !== null);
    void photoUrl(name).then((u) => {
      if (!live) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [name]);
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`block overflow-hidden ${fill ? "absolute inset-0" : "relative h-full w-full"} ${!shown && !failed ? "koda-shimmer bg-surface-muted" : ""} ${withoutPadding(className)}`}>
      {url && !failed ? (
        <img
          src={url}
          alt=""
          draggable={false}
          onLoad={(e) => {
            setShown(true);
            const { naturalWidth, naturalHeight } = e.currentTarget;
            if (naturalWidth > 0 && naturalHeight > 0) onRatio?.(naturalWidth / naturalHeight);
          }}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full ${whole ? "object-contain" : "object-cover"} transition-opacity duration-300 ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
        />
      ) : failed ? (
        <span className="block h-full w-full p-4"><SvgMarkup markup={LOCAL.book} raw size="100%" /></span>
      ) : null}
    </span>
  );
}
