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

export const hasLocalPicture = (key: string) => key in LOCAL;

/** The house drawing for a key, so the art editor can open it to be redrawn. */
export const localPicture = (key: string): string => LOCAL[key] ?? "";

/**
 * Every picture key a story may use: the drawings here, and the pictures already
 * in the art library. A drafter is told this list and a word whose picture is not
 * on it is dropped rather than drawn as a book.
 */
export const PICTURE_KEYS: readonly string[] = [...Object.keys(LOCAL).filter((k) => k !== "book"), "apple", "grape", "mango", "orange"].sort();

export function Picture({ name, label, className = "" }: { name: string; label?: string; className?: string }) {
  if (isPhoto(name)) return <Photo name={name} label={label} className={className} />;
  const fallback = <SvgMarkup markup={LOCAL[name] ?? LOCAL.book} raw size="100%" />;
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`block h-full w-full ${className}`}>
      <SvgAsset id={name} size="100%" fallback={fallback} />
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
function Photo({ name, label, className }: { name: string; label?: string; className: string }) {
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
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={`relative block h-full w-full overflow-hidden ${!shown && !failed ? "bg-surface-muted" : ""} ${withoutPadding(className)}`}>
      {url && !failed ? (
        <img
          src={url}
          alt=""
          draggable={false}
          onLoad={() => setShown(true)}
          onError={() => setFailed(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-out motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
        />
      ) : failed ? (
        <span className="block h-full w-full p-4"><SvgMarkup markup={LOCAL.book} raw size="100%" /></span>
      ) : null}
    </span>
  );
}
