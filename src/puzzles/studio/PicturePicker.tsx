import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ImageOff, ImagePlus } from "lucide-react";
import { SvgAsset, SvgMarkup, svgAssets } from "../../assets/svg";
import { useT } from "../../lib/i18n";
import { SharedArtStore } from "../../lib/sharedArtStore";
import { themeSystem } from "../../lib/themeSystem";
import { PHOTO_ACCEPT, uploadPhoto } from "../../library/photos";
import { ICON_PREFIX } from "../../rebus/icons/library";
import { MATH_ART } from "../../rebus/icons/more/maths";
import { useRebusIcons } from "../../rebus/icons/useRebusIcons";
import { UIButton, UISearchInput } from "../../components/ui";
import { WordPicture } from "../ui/WordPicture";

/**
 * Choose a word's picture: one of Koda's drawings, a drawing from the Art
 * library, or a photo from the author's computer.
 *
 * Drawings come in groups (animals, food, at home…) so an author looks where
 * a word belongs instead of scrolling hundreds; a search box finds one by name
 * across all of them. The Art library shows its own collections. A photo is
 * made smaller on the computer before it is sent, and children see it from
 * the library's photos, kept on their device for offline play.
 */

export const PICTURE_UPLOAD_ROUTE = "daily-puzzles/studio/images";
/** A word's picture is shown at most about 100px wide; 480 covers a phone at high pixel density. */
const PHOTO_SIDE = 480;

/**
 * Koda's drawings by group, named one by one: the drawing files are split by
 * size, not by meaning (fruit sits beside animals there). A drawing not listed
 * here falls under Things; number and maths drawings are left out, since they
 * are not things a word names.
 */
export const GROUP_NAMES: Record<string, string> = {
  animals:
    "cat dog bull frog fish bird bee horse lion hog monkey sheep fly dragon bug whale turkey worm bear wolf fox deer mouse pig cow goat duck goose hen chick owl crow eagle swan penguin snake turtle crab shark octopus ant spider rabbit elephant giraffe zebra tiger camel parrot seal hawk cricket guinea-pig tick",
  food:
    "honey egg cheese butter milk apple berry melon corn bread cake pie peanut pepper salt ham burger tea pumpkin straw bacon chili jam nut dough orange banana lemon grape cherry peach pear plum tomato potato onion bean pea rice soup sugar candy cookie toast pizza coffee carrot",
  nature:
    "sun moon star cloud rain snow wind fire water ice earth tree pine plant flower leaf sea sand stone thunder storm space quake land hail shell weed wood hay volcano mountain river lake island hill cave desert forest sky planet",
  body: "eye tooth foot hand head nose ear mouth arm leg knee finger thumb heart bone toe hair tongue",
  home: "house home key clock door window wall chair table bed lamp spoon fork knife plate glass bottle bucket brush comb soap towel mirror ladder hammer saw axe screw chain lock cup pan pot basket pin rug bowl box can ring shelf",
  clothes: "hat coat sock boot dress belt tie shoe cap crown glove goggles helmet",
  school: "school book pencil ruler scissors glue crayon eraser calculator desk backpack chalk globe map magnet lens battery bulb telescope microscope gear robot paper note board clip bag",
  travel: "bus ship plane car truck train boat rocket bike road bridge sailboat wheel",
  sports: "ball basketball base bat racket net goal medal trophy whistle skate ski skateboard hoop target arrow stopwatch dumbbell flag kite rope cone runner surfboard",
  colours: "blue green black white",
};
const GROUPS = [...Object.keys(GROUP_NAMES), "things"];
const NAMED = new Map<string, string>(Object.entries(GROUP_NAMES).flatMap(([g, names]) => names.split(" ").map((n) => [n, g] as const)));
const MATHS = new Set(Object.keys(MATH_ART));
/** A drawing's group, or null for one that is not offered (a maths drawing). */
export const groupOf = (name: string): string | null => NAMED.get(name) ?? (MATHS.has(name) ? null : "things");

/** Art library collections that are not pictures of things. */
const NOT_FOR_WORDS = new Set(["rebus", "avatars", "badges", "brand", "thumbnail", "uncategorised"]);

type Source = "drawings" | "art" | "computer";

export const PicturePicker: React.FC<{ value: string; onChange(id: string): void }> = ({ value, onChange }) => {
  const { t } = useT();
  const [source, setSource] = useState<Source>("drawings");
  const chip = (on: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
      on ? "bg-indigo-600 text-white" : "border-2 border-line bg-surface text-body"
    }`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          <WordPicture id={value} label={t("puzzleStudio.picture")} size={80} />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-2xl border-2 border-dashed border-line text-center text-xs font-bold text-muted">
            {t("puzzleStudio.noPicture")}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm font-bold text-ink">{t("puzzleStudio.picture")}</span>
          <p className="text-xs text-muted">{t("puzzleStudio.pictureHelp")}</p>
          {value && (
            <UIButton type="button" size="sm" variant="ghost" icon={<ImageOff />} onClick={() => onChange("")}>
              {t("puzzleStudio.removePicture")}
            </UIButton>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t("puzzleStudio.pictureFrom")}>
        {(["drawings", "art", "computer"] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={source === s} className={chip(source === s)} onClick={() => setSource(s)}>
            {t(`puzzleStudio.source.${s}`)}
          </button>
        ))}
      </div>

      {source === "drawings" && <Drawings value={value} onPick={onChange} chip={chip} />}
      {source === "art" && <ArtLibrary value={value} onPick={onChange} chip={chip} />}
      {source === "computer" && <FromComputer onPick={onChange} />}
    </div>
  );
};

interface BrowseProps {
  value: string;
  onPick(id: string): void;
  chip(on: boolean): string;
}

const gridClass =
  "grid max-h-64 grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-1.5 overflow-y-auto rounded-2xl border border-line bg-surface-muted p-2";
const cellClass = (on: boolean) =>
  `flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border-2 bg-white p-1 transition hover:border-indigo-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 pointer-coarse:min-h-12 ${
    on ? "border-indigo-600 ring-2 ring-indigo-300" : "border-line"
  }`;

const Drawings: React.FC<BrowseProps> = ({ value, onPick, chip }) => {
  const { t } = useT();
  const icons = useRebusIcons();
  const [group, setGroup] = useState("animals");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => icons.filter((i) => (q ? i.name.includes(q) && groupOf(i.name) !== null : groupOf(i.name) === group)),
    [icons, group, q],
  );
  return (
    <div className="space-y-2">
      <UISearchInput size="sm" label={t("puzzleStudio.searchPictures")} placeholder={t("puzzleStudio.searchPictures")} value={query} onChange={(e) => setQuery(e.target.value)} />
      {!q && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("puzzleStudio.pictureGroup")}>
          {GROUPS.map((g) => (
            <button key={g} type="button" aria-pressed={group === g} className={chip(group === g)} onClick={() => setGroup(g)}>
              {t(`puzzleStudio.group.${g}`)}
            </button>
          ))}
        </div>
      )}
      <div className={gridClass}>
        {shown.map(({ id, name, markup }) => (
          <button key={id} type="button" onClick={() => onPick(id)} aria-label={name} aria-pressed={value === id} title={name} className={cellClass(value === id)}>
            <SvgMarkup markup={markup} raw size="100%" />
          </button>
        ))}
        {shown.length === 0 && <p className="col-span-full p-2 text-sm text-muted">{t("puzzleStudio.noPictures")}</p>}
      </div>
    </div>
  );
};

/** The shared Art library and the bundled art, by collection. Not a family's own art: other families could not see it. */
const ArtLibrary: React.FC<BrowseProps> = ({ value, onPick, chip }) => {
  const { t } = useT();
  const version = useSyncExternalStore(SharedArtStore.subscribe, SharedArtStore.version, SharedArtStore.version);
  useEffect(() => {
    void SharedArtStore.load();
  }, []);
  const entries = useMemo(() => {
    void version;
    const byId = new Map<string, string>();
    if (!SharedArtStore.isAuthoritative()) for (const a of svgAssets) byId.set(a.id, a.category);
    for (const a of SharedArtStore.all()) byId.set(a.id, a.category);
    return [...byId].filter(([id, c]) => !NOT_FOR_WORDS.has(c) && !id.startsWith(ICON_PREFIX)).sort((a, b) => a[0].localeCompare(b[0]));
  }, [version]);
  const collections = useMemo(() => [...new Set(entries.map(([, c]) => c))].sort(), [entries]);
  const [collection, setCollection] = useState("");
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const current = collection && collections.includes(collection) ? collection : (collections[0] ?? "");
  const shown = entries.filter(([id, c]) => (q ? id.includes(q) : c === current)).slice(0, 240);
  return (
    <div className="space-y-2">
      <UISearchInput size="sm" label={t("puzzleStudio.searchPictures")} placeholder={t("puzzleStudio.searchPictures")} value={query} onChange={(e) => setQuery(e.target.value)} />
      {!q && collections.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("puzzleStudio.pictureGroup")}>
          {collections.map((c) => (
            <button key={c} type="button" aria-pressed={current === c} className={`${chip(current === c)} capitalize`} onClick={() => setCollection(c)}>
              {c.replace(/[-_]+/g, " ")}
            </button>
          ))}
        </div>
      )}
      <div className={gridClass}>
        {shown.map(([id]) => (
          <button key={id} type="button" onClick={() => onPick(id)} aria-label={id} aria-pressed={value === id} title={id} className={cellClass(value === id)}>
            <SvgAsset id={id} size="100%" />
          </button>
        ))}
        {shown.length === 0 && <p className="col-span-full p-2 text-sm text-muted">{t("puzzleStudio.noPictures")}</p>}
      </div>
    </div>
  );
};

const FromComputer: React.FC<{ onPick(id: string): void }> = ({ onPick }) => {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      onPick(await uploadPhoto(file, PICTURE_UPLOAD_ROUTE, PHOTO_SIDE));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("puzzleStudio.photoFailed"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="space-y-2 rounded-2xl border-2 border-dashed border-line p-4 text-center">
      <input ref={input} type="file" accept={PHOTO_ACCEPT} className="sr-only" aria-label={t("puzzleStudio.choosePhoto")} onChange={(e) => void add(e.target.files?.[0])} />
      <UIButton type="button" variant="secondary" icon={<ImagePlus />} isLoading={busy} disabled={busy} onClick={() => input.current?.click()}>
        {t("puzzleStudio.choosePhoto")}
      </UIButton>
      <p className="text-xs text-muted">{t("puzzleStudio.photoHelp")}</p>
      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
    </div>
  );
};
