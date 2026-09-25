import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ImageOff, ImagePlus, Loader2, PanelBottom, PanelLeft, PanelRight, PanelTop, Pencil, Search, ShieldCheck, Sparkles, X } from "lucide-react";
import { SvgMarkup, useArtLibrary } from "../../assets/svg";
import type { PagePicture } from "../bookLayout";
import { PICTURE_PLACES, type PicturePlace } from "../data/passage";
import { generateSvg } from "../../lib/artGenerationApi";
import { SUGGESTED_SVG_CATEGORIES, SVG_ID_PATTERN, UNCATEGORISED, listSvgAssets, saveSvgAsset } from "../../lib/svgAssetsApi";
import { useSystem } from "../../lib/sync";
import { inspectSvgMarkup, preprocessSvgMarkup } from "../../utils/svg";
import { playSound } from "../../utils/audio";
import { isPhoto, PHOTO_ACCEPT, uploadPhoto } from "../photos";
import { Picture, PICTURE_KEYS } from "../Picture";

/**
 * Where a page's picture comes from — the art library, a drawing made to order,
 * or a photo — in a single drawer that arrives from the right edge.
 *
 * Clicking a page card is the only way in: there is no picture panel sitting
 * beside the pages any more, so what used to live there (Automatic/No picture,
 * where it sits, the pictures of this page's own words, the photos already in
 * this book) all lives here too, above the library itself.
 *
 * The library opens on a click and not before. It is a Mongo collection that
 * grows without bound, and a studio that pulled all of it down to show a grid
 * nobody had asked for spent a phone's first seconds of a lesson on pictures
 * for a page the author had not chosen yet. Attaching is the moment the author
 * says they want to look, so that is the moment the library is fetched.
 *
 * Whatever is made here is saved to the art library under a name, because that
 * is what a book stores: a key, not a picture. Saving one changes it for every
 * book already using that name — said plainly below the field rather than
 * discovered afterwards.
 */

const KEBAB = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .split("-")
    .filter((word) => word && !["a", "an", "the", "of", "with"].includes(word))
    .slice(0, 3)
    .join("-");

const chip = "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-bold transition-colors";
const STORY = "story";
const BUILT_IN = "built-in";
const EVERYTHING = "all";
const PLACE_NAME: Record<PicturePlace, string> = { top: "Top", bottom: "Bottom", left: "Left", right: "Right" };
const PLACE_ICON = { top: PanelTop, bottom: PanelBottom, left: PanelLeft, right: PanelRight } as const;

/** `uncategorised` is the art library's holding pen, not a collection name. */
const collectionName = (id: string) =>
  id === UNCATEGORISED ? "Uncategorised" : id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

type Way = "library" | "draw" | "upload";

/** A picture being made, before it is filed. The same three things the Art page's editor asks for. */
interface Draft {
  prompt: string;
  markup: string;
  name: string;
  category: string;
}

export function PicturePanel({ title, note, chosen, how, promptSeed, suggested, suggestedLabel, photos, allowNone, at, onPlace, onChoose, onClose }: {
  title: string;
  /**
   * A consequence of choosing here that the author should know before they do.
   *
   * A Words question's right picture is the word's picture for the whole book,
   * so changing it changes an Automatic page and a tapped word too. Said here
   * rather than discovered afterwards.
   */
  note?: string;
  chosen: string | null;
  how: PagePicture["how"];
  /**
   * What "Draw one" opens with — a finished instruction, not raw text to
   * interpret. The caller knows what this drawer is for (a page's own line, a
   * cover, a word to recognise) and says so plainly; the model should never
   * have to guess a subject out of a bare story sentence.
   */
  promptSeed?: string;
  /** Pictures worth offering first — this page's own words, or this question's three. */
  suggested: string[];
  /** What those first pictures are, since a question's are not a page's words. */
  suggestedLabel?: string;
  /** Photos already uploaded somewhere in this book, offered again for reuse. */
  photos: string[];
  /** Whether Automatic/No picture make sense here — false for the cover. */
  allowNone: boolean;
  /** Where the page's picture sits; null for the cover, which has no choice. */
  at: PicturePlace | null;
  onPlace(at: PicturePlace): void;
  onChoose(key: string | null | undefined): void;
  onClose(): void;
}) {
  const [way, setWay] = useState<Way>("library");
  const library = useArtLibrary();
  /* The drawing in progress lives here rather than in the tab that shows it: a
     glance back at the library is not a reason to throw away a picture the
     author has just waited for, and a redraw needs to arrive with a name
     already filled in. `promptSeed` only ever sets the *first* draft — once
     drawn, the field is the author's to edit, not something re-seeded out from
     under them. */
  const [draft, setDraft] = useState<Draft>({ prompt: promptSeed ?? "", markup: "", name: "", category: STORY });

  // The pull the mounting is for. A failure leaves whatever this device already
  // has — the bundled art and the last snapshot — which is a shorter list, not
  // a broken panel.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void listSvgAssets()
      .catch(() => undefined)
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Picking a picture is a finished decision — it closes the drawer. */
  const use = (key: string | null | undefined) => {
    onChoose(key);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in rail:items-stretch" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-2xl shadow-slate-900/25 animate-[koda-sheet-in_240ms_cubic-bezier(0.32,0.72,0,1)] dark:shadow-black/60 rail:h-full rail:max-w-lg rail:rounded-none rail:pb-0 rail:animate-slide-in-right"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-3.5 rail:px-6 rail:py-4">
          <div className="min-w-0">
            <h3 className="truncate font-extrabold text-ink">{title}</h3>
            <p className="text-xs text-muted">{note ?? "Pick one from the library, draw a new one, or upload a photo."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-muted hover:text-ink">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* What used to sit in the persistent panel beside the pages: whether
            this page even wants a picture, and where a chosen one sits. Fixed,
            not scrolled away, because both apply no matter which tab below is
            open. */}
        {(allowNone || (at && chosen)) && (
          <div className="grid shrink-0 gap-3 border-b border-line px-5 py-3 rail:px-6">
            {allowNone && (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => use(undefined)} aria-pressed={how === "auto"} className={`${chip} ${how === "auto" ? "border-indigo-600 text-ink" : "border-line text-muted"}`}>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  Automatic
                </button>
                <button type="button" onClick={() => use(null)} aria-pressed={how === "none"} className={`${chip} ${how === "none" ? "border-indigo-600 text-ink" : "border-line text-muted"}`}>
                  <ImageOff className="h-4 w-4" aria-hidden="true" />
                  No picture
                </button>
              </div>
            )}
            {at && chosen && (
              <div>
                <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">Picture position</p>
                <div role="radiogroup" aria-label="Picture position" className="grid grid-cols-4 gap-2">
                  {PICTURE_PLACES.map((p) => {
                    const Icon = PLACE_ICON[p];
                    return (
                      <button key={p} type="button" role="radio" aria-checked={at === p} onClick={() => onPlace(p)}
                        className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold ${at === p ? "border-indigo-600 bg-surface text-ink" : "border-line text-muted hover:border-indigo-400"}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        {PLACE_NAME[p]}
                      </button>
                    );
                  })}
                </div>
                {(at === "left" || at === "right") && <p className="mt-2 text-xs text-muted">On a phone, left goes above the words and right below them, so the text stays large.</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex shrink-0 gap-2 border-b border-line px-5 py-3 rail:px-6" role="group" aria-label="Where the picture comes from">
          {([["library", "Library"], ["draw", "Draw one"], ["upload", "Upload"]] as Array<[Way, string]>).map(([id, name]) => (
            <button key={id} type="button" onClick={() => setWay(id)} aria-pressed={way === id}
              className={`${chip} ${way === id ? "border-indigo-600 bg-indigo-600 text-white" : "border-line text-muted"}`}>
              {name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 rail:px-6">
          {way === "library" && (
            <LibraryWay
              library={library}
              loading={loading}
              chosen={chosen}
              suggested={suggested}
              suggestedLabel={suggestedLabel}
              photos={photos}
              onUse={use}
              onRedraw={(key) => {
                setDraft({ prompt: "", markup: "", name: key, category: library.find((a) => a.id === key)?.category ?? STORY });
                setWay("draw");
              }}
            />
          )}
          {way === "draw" && <DrawWay library={library} draft={draft} setDraft={setDraft} onUsed={use} />}
          {way === "upload" && <UploadWay onUsed={use} />}
        </div>
      </div>
    </div>
  );
}

/** A row of tiles reused for "this page's words" and "photos in this book" — no redraw handle, just a pick. */
function QuickTiles({ heading, keys, chosen, onUse }: { heading: string; keys: string[]; chosen: string | null; onUse(key: string): void }) {
  if (!keys.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">{heading}</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {keys.map((key) => (
          <li key={key}>
            <button type="button" onClick={() => onUse(key)} aria-pressed={chosen === key} aria-label={isPhoto(key) ? "Photo" : key} title={isPhoto(key) ? "Photo" : key}
              className={`flex w-full flex-col overflow-hidden rounded-xl border text-left ${chosen === key ? "border-indigo-600 ring-2 ring-indigo-600/30" : "border-line hover:border-indigo-400"}`}>
              <span className="block aspect-square w-full bg-play-sky"><Picture name={key} className="p-2" /></span>
              <span className="truncate px-2 py-1 text-xs text-muted">{isPhoto(key) ? "Photo" : key}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The art library, browsed by collection. Loads the top 20, then "Load more" on request. */
function LibraryWay({ library, loading, chosen, suggested, suggestedLabel, photos, onUse, onRedraw }: {
  library: ReturnType<typeof useArtLibrary>;
  loading: boolean;
  chosen: string | null;
  suggested: string[];
  suggestedLabel?: string;
  photos: string[];
  onUse(key: string): void;
  onRedraw(key: string): void;
}) {
  const [collection, setCollection] = useState(EVERYTHING);
  const [query, setQuery] = useState("");
  const [displayed, setDisplayed] = useState(20);
  const BATCH_SIZE = 20;

  /** The two collections the studio names itself, then every one the library holds. */
  const collections = useMemo(() => {
    const filed = [...new Set(library.map((a) => a.category))]
      .filter((c) => c !== STORY)
      .sort((a, b) => (a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b)));
    return [
      { id: EVERYTHING, name: "All pictures" },
      { id: STORY, name: "Story art" },
      { id: BUILT_IN, name: "Built-in" },
      ...filed.map((c) => ({ id: c, name: collectionName(c) })),
    ];
  }, [library]);

  const keys =
    collection === BUILT_IN ? [...PICTURE_KEYS]
    : collection === EVERYTHING ? [...new Set([...library.map((a) => a.id), ...PICTURE_KEYS])].sort()
    : library.filter((a) => a.category === collection).map((a) => a.id);
  const q = query.trim().toLowerCase();
  const allShown = keys.filter((k) => !q || k.includes(q));
  /* Only the first `displayed` tiles render. Changing collection or search
     starts back at the top rather than showing a stale tail. */
  const shownTiles = allShown.slice(0, displayed);

  useEffect(() => {
    setDisplayed(20);
  }, [collection, query]);

  return (
    <div className="grid gap-4">
      <QuickTiles heading={suggestedLabel ?? "From this page’s words"} keys={suggested} chosen={chosen} onUse={onUse} />
      <QuickTiles heading="Photos in this book" keys={photos} chosen={chosen} onUse={onUse} />

      <div className="grid gap-3">
        <label className="relative block">
          <span className="sr-only">Search pictures</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pictures"
            className="min-h-11 w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-ink" />
        </label>

        {/* One row that scrolls sideways. A library with twenty collections in it
            would otherwise open on four rows of chips and no pictures. */}
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Collection">
          {collections.map((c) => (
            <button key={c.id} type="button" onClick={() => setCollection(c.id)} aria-pressed={collection === c.id}
              className={`${chip} shrink-0 whitespace-nowrap ${collection === c.id ? "border-indigo-600 bg-surface text-ink" : "border-line text-muted"}`}>
              {c.name}
            </button>
          ))}
        </div>

        {allShown.length ? (
          <>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {shownTiles.map((key) => (
                <li key={key} className="group relative">
                  <button type="button" onClick={() => onUse(key)} aria-pressed={chosen === key} aria-label={key} title={key}
                    className={`flex w-full flex-col overflow-hidden rounded-xl border text-left ${chosen === key ? "border-indigo-600 ring-2 ring-indigo-600/30" : "border-line hover:border-indigo-400"}`}>
                    <span className="block aspect-square w-full bg-play-sky"><Picture name={key} className="p-2" /></span>
                    <span className="truncate px-2 py-1 text-xs text-muted">{key}</span>
                  </button>
                  {/* Out of the way until the tile is hovered, focused or in use, so
                      a wall of pictures stays a wall of pictures. */}
                  <button type="button" onClick={() => onRedraw(key)} aria-label={`Draw ${key} again`} title={`Draw ${key} again`}
                    className={`absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-full border border-line bg-surface/90 text-muted transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 ${chosen === key ? "opacity-100" : "opacity-0"}`}>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {allShown.length > displayed && (
              <button type="button" onClick={() => setDisplayed((d) => d + BATCH_SIZE)}
                className={`${chip} w-full justify-center border-line text-ink hover:border-indigo-400`}>
                Load more ({displayed} of {allShown.length})
              </button>
            )}
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
            {loading ? "Fetching the art library…" : q ? `No picture called “${query}” here.` : "Nothing in this collection yet. Draw one, or add pictures on the Art page."}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A picture made to order, saved to the library under a name a person chose.
 *
 * The same pipeline the Art page's editor runs, because it writes to the same
 * Mongo collection: inspect what the sanitiser will do to the markup, refuse a
 * document that will not render, store `preprocessSvgMarkup`'s normalised form
 * so every client draws the same thing, and file it under a category. A picture
 * drawn here is on the Art page the moment it is saved, indistinguishable from
 * one drawn there.
 */
function DrawWay({ library, draft, setDraft, onUsed }: {
  library: ReturnType<typeof useArtLibrary>;
  draft: Draft;
  setDraft(d: Draft): void;
  onUsed(key: string): void;
}) {
  const allowed = useSystem().allows("ai.artGeneration");
  const { prompt, markup, name, category } = draft;
  const setPrompt = (value: string) => setDraft({ ...draft, prompt: value });
  const setName = (value: string) => setDraft({ ...draft, name: value });
  const setCategory = (value: string) => setDraft({ ...draft, category: value });
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const draw = async () => {
    if (!prompt.trim() || drawing) return;
    setDrawing(true);
    setError("");
    try {
      const drawn = await generateSvg(prompt, { shape: "square" });
      setDraft({ ...draft, markup: drawn, name: name || KEBAB(prompt) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The picture could not be drawn.");
    } finally {
      setDrawing(false);
    }
  };

  const taken = library.find((a) => a.id === name);
  const nameError = name && !SVG_ID_PATTERN.test(name) ? "Lowercase letters, numbers and single hyphens only." : "";
  const categoryError = category && !SVG_ID_PATTERN.test(category) ? "Lowercase letters, numbers and single hyphens only." : "";
  // What the sanitiser will make of it, worked out before it is filed rather
  // than discovered as a blank frame in somebody's book.
  const verdict = useMemo(() => inspectSvgMarkup(markup), [markup]);
  const canSave = Boolean(markup && name) && !nameError && !categoryError && verdict.state === "ok" && !saving;

  /** Blank files it in the holding pen, the same answer the Art page gives. */
  const filedCategory = category.trim() || UNCATEGORISED;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      await saveSvgAsset(name, preprocessSvgMarkup(markup.trim()), filedCategory);
      await listSvgAssets().catch(() => undefined);
      playSound("pop");
      onUsed(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The picture could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = [
    ...new Set([
      ...library.map((a) => a.category).filter((c) => c !== UNCATEGORISED),
      ...SUGGESTED_SVG_CATEGORIES,
    ]),
  ];

  if (!allowed) {
    return (
      <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
        Drawing is switched off for this deployment. Pick a picture from the library, upload a photo, or add artwork on the Art page.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">Describe the picture</span>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
          placeholder="A wooden market stall with baskets of fruit"
          className="w-full rounded-xl border border-line bg-surface p-3 text-ink" />
      </label>
      <button type="button" onClick={() => void draw()} disabled={!prompt.trim() || drawing}
        className={`${chip} justify-center border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`}>
        {drawing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        {drawing ? "Drawing…" : markup ? "Draw it again" : "Draw it"}
      </button>

      {markup && (
        <>
          <div className="grid gap-2">
            <p className="text-xs font-extrabold uppercase tracking-wider text-muted">What came back</p>
            <div className="mx-auto w-40 overflow-hidden rounded-xl border border-line bg-play-sky p-3">
              <SvgMarkup markup={markup} raw size="100%" />
            </div>
          </div>
          {/* The sanitiser drops silently, so this is the one place it must not:
              the same report the Art page's editor shows over the same check. */}
          {verdict.state === "invalid" ? (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{verdict.message}</span>
            </p>
          ) : verdict.state === "ok" && (verdict.droppedElements > 0 || verdict.droppedAttributes > 0) ? (
            <p className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-900 dark:bg-orange-950 dark:text-orange-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                The sanitiser drops {verdict.droppedElements} element{verdict.droppedElements === 1 ? "" : "s"} and{" "}
                {verdict.droppedAttributes} attribute{verdict.droppedAttributes === 1 ? "" : "s"}. Check the preview above is still the picture you wanted.
              </span>
            </p>
          ) : verdict.state === "ok" ? (
            <p className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              Renders whole — nothing is dropped by the sanitiser.
            </p>
          ) : null}

          <label className="grid gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted">Save it as</span>
            <input value={name} onChange={(e) => setName(e.target.value.trim())} placeholder="market-stall"
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink" />
            {nameError ? (
              <span role="alert" className="text-xs font-bold text-rose-700 dark:text-rose-300">{nameError}</span>
            ) : taken ? (
              <span className="text-xs text-muted">This replaces the picture already called “{name}”, in every book using it.</span>
            ) : (
              <span className="text-xs text-muted">Saved to the art library, so other books can use it too.</span>
            )}
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted">Filed under</span>
            <input value={category} onChange={(e) => setCategory(e.target.value.trim())} list="picture-panel-categories" placeholder={STORY}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink" />
            <datalist id="picture-panel-categories">
              {categoryOptions.map((c) => <option key={c} value={c} />)}
            </datalist>
            {categoryError ? (
              <span role="alert" className="text-xs font-bold text-rose-700 dark:text-rose-300">{categoryError}</span>
            ) : (
              <span className="text-xs text-muted">The collection it joins on the Art page. Book pictures belong in “story”.</span>
            )}
          </label>

          <button type="button" onClick={() => void save()} disabled={!canSave}
            className={`${chip} justify-center border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60`}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {saving ? "Saving…" : "Use this picture"}
          </button>
        </>
      )}

      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    </div>
  );
}

/** A photo from the author's own device. */
function UploadWay({ onUsed }: { onUsed(key: string): void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      onUsed(await uploadPhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The photo could not be uploaded.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-3">
      <label className={`${chip} cursor-pointer justify-center border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700 ${uploading ? "pointer-events-none opacity-60" : ""}`}>
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
        {uploading ? "Uploading…" : "Choose a photo"}
        <input type="file" accept={PHOTO_ACCEPT} className="sr-only" disabled={uploading}
          onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <p className="text-xs text-muted">JPEG, PNG or WebP. Shrunk to 1600px before it is sent, and kept with this book.</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{error}</p>}
    </div>
  );
}
