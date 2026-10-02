import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ImageOff, ImagePlus, PanelBottom, PanelLeft, PanelRight, PanelTop, Pencil, Search, Settings2, Sparkles, Wand2, X } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";
import { SvgMarkup, useArtLibrary } from "../../assets/svg";
import type { PagePicture } from "../bookLayout";
import { PICTURE_PLACES, type PicturePlace } from "../data/passage";
import { generateSvg } from "../../lib/artGenerationApi";
import { SVG_ID_PATTERN, UNCATEGORISED, listSvgAssets, saveSvgAsset } from "../../lib/svgAssetsApi";
import { useSystem } from "../../lib/sync";
import { inspectSvgMarkup, preprocessSvgMarkup } from "../../utils/svg";
import { playSound } from "../../utils/audio";
import { isPhoto, PHOTO_ACCEPT, uploadPhoto } from "../photos";
import { describeShape, type PictureKind } from "../pictureShape";
import { cropToShape, generateBookImage, improvePicturePrompt, type ImageProvider, type ImageStyle } from "../imageGenerationApi";
import { Picture, PICTURE_KEYS } from "../Picture";
import { aiDefault } from "../../lib/aiDefaults";
import { UIButton, UIFlashMessage, UIInput, UILinkButton, UIMenu, UIMenuItem, UIMenuLabel, UIMenuSeparator, UITabs, UITextarea } from "../../components/ui";
import { translate, useT } from "../../lib/i18n";

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

const STORY = "story";
const BUILT_IN = "built-in";
const EVERYTHING = "all";
/* Place names are worded under `studio.pages.place.<at>`. */
const PLACE_ICON = { top: PanelTop, bottom: PanelBottom, left: PanelLeft, right: PanelRight } as const;

/** `uncategorised` is the art library's holding pen, not a collection name. */
const collectionName = (id: string) =>
  id === UNCATEGORISED ? translate("studio.picture.uncategorised") : id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

type Way = "library" | "ai" | "upload";
type Provider = ImageProvider;

/** A picture being made, before it is used — held above the tabs so a look at the library does not lose it. */
interface Draft {
  prompt: string;
  mode: "svg" | "image";
  kind: PictureKind;
  /** A drawing's markup, and the name and collection it will be filed under. */
  markup: string;
  name: string;
  category: string;
  /** A painted picture, already cropped, and a URL to preview it by. */
  photo: Blob | null;
  preview: string;
  /** What "Improve description" is told, set from the context and the author's to change. */
  subjectOnly: boolean;
  cambodia: boolean;
  /** The description before the last improvement, so it can be put back. */
  before: string | null;
}

/** The author's standing choices, remembered on this device. */
export interface Prefs {
  provider: Provider;
  style: ImageStyle;
  autoImprove: boolean;
}

const fieldLabel = "text-xs font-extrabold uppercase tracking-wider text-muted";
const PREFS_KEY = "koda_picture_prefs_v1";
/** Only what this author changed is kept, so an untouched provider follows the admin's default. */
const savedPrefs = (): Partial<Prefs> => {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
  } catch {
    return {};
  }
};
export const readPrefs = (): Prefs => {
  const saved = savedPrefs();
  const provider = saved.provider ?? (aiDefault("ai.pictureProvider") === "openai" ? "openai" : "gemini");
  return {
    provider: provider === "openai" ? "openai" : "gemini",
    style: saved.style === "flat" || saved.style === "painted" ? saved.style : "3d",
    autoImprove: saved.autoImprove === true,
  };
};

/** Keep what this author changed, so the drawer and a batch open on the same choices. */
export const rememberPrefs = (patch: Partial<Prefs>) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...savedPrefs(), ...patch }));
  } catch {
    /* remembered for this visit only */
  }
};

export function PicturePanel({ title, note, chosen, how, promptSeed, brief, suggested, suggestedLabel, photos, allowNone, at, startOn = "library", onPlace, onChoose, onClose }: {
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
   * What "Make with AI" opens with — a finished instruction, not raw text to
   * interpret. The caller knows what this drawer is for (a page's own line, a
   * cover, a word to recognise) and says so plainly; the model should never
   * have to guess a subject out of a bare story sentence.
   */
  promptSeed?: string;
  /**
   * Where "Improve description" starts: a word to recognise wants its subject
   * alone, and a Khmer book's pictures belong in Cambodia. The author can turn
   * either off.
   */
  brief?: { subjectOnly?: boolean; cambodia?: boolean };
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
  /** The tab it opens on — "ai" where making a picture is the usual reason to be here. */
  startOn?: Way;
  onPlace(at: PicturePlace): void;
  onChoose(key: string | null | undefined): void;
  onClose(): void;
}) {
  const { t } = useT();
  const [way, setWay] = useState<Way>(startOn);
  const library = useArtLibrary();
  /* The drawing in progress lives here rather than in the tab that shows it: a
     glance back at the library is not a reason to throw away a picture the
     author has just waited for, and a redraw needs to arrive with a name
     already filled in. `promptSeed` only ever sets the *first* draft — once
     drawn, the field is the author's to edit, not something re-seeded out from
     under them. */
  const [draft, setDraft] = useState<Draft>({
    prompt: promptSeed ?? "", mode: "svg", kind: "banner", markup: "", name: "", category: STORY, photo: null, preview: "",
    subjectOnly: brief?.subjectOnly ?? false, cambodia: brief?.cambodia ?? false, before: null,
  });
  const previewRef = useRef("");
  previewRef.current = draft.preview;
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); }, []);
  const [prefs, setPrefsState] = useState<Prefs>(readPrefs);
  const setPrefs = (patch: Partial<Prefs>) => {
    setPrefsState({ ...prefs, ...patch });
    rememberPrefs(patch);
  };

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
            <p className="text-xs text-muted">{note ?? t("studio.picture.note")}</p>
          </div>
          <UIButton type="button" variant="ghost" size="icon" onClick={onClose} aria-label={t("common.close")} icon={<X aria-hidden="true" />} className="shrink-0" />
        </div>

        {/* What used to sit in the persistent panel beside the pages: whether
            this page even wants a picture, and where a chosen one sits. Fixed,
            not scrolled away, because both apply no matter which tab below is
            open. */}
        {(allowNone || (at && chosen)) && (
          <div className="grid shrink-0 gap-2 border-b border-line px-5 py-3 rail:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {allowNone && (
                <>
                  <UIButton type="button" size="sm" variant={how === "auto" ? "primary" : "secondary"} aria-pressed={how === "auto"} onClick={() => use(undefined)} icon={<Sparkles aria-hidden="true" />}>
                    {t("studio.pages.how.auto")}
                  </UIButton>
                  <UIButton type="button" size="sm" variant={how === "none" ? "primary" : "secondary"} aria-pressed={how === "none"} onClick={() => use(null)} icon={<ImageOff aria-hidden="true" />}>
                    {t("studio.pages.how.none")}
                  </UIButton>
                </>
              )}
              {at && chosen && (
                <div role="radiogroup" aria-label={t("studio.picture.position")} title={t("studio.picture.position")} className="ml-auto flex gap-1 rounded-xl border border-line p-1">
                  {PICTURE_PLACES.map((p) => {
                    const Icon = PLACE_ICON[p];
                    return (
                      <button key={p} type="button" role="radio" aria-checked={at === p} aria-label={t(`studio.pages.place.${p}`)} title={t(`studio.pages.place.${p}`)} onClick={() => onPlace(p)}
                        className={`grid h-8 w-9 place-items-center rounded-lg ${at === p ? "bg-indigo-600 text-white" : "text-muted hover:bg-surface-muted hover:text-ink"}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {at && chosen && (at === "left" || at === "right") && <p className="text-xs text-muted">{t("studio.picture.phoneNote")}</p>}
          </div>
        )}

        <div className="shrink-0 border-b border-line px-5 py-3 rail:px-6">
          <UITabs label={t("studio.picture.source")} value={way} onChange={setWay}
            items={[{ id: "library", label: t("nav.library") }, { id: "ai", label: t("studio.picture.makeAi") }, { id: "upload", label: t("studio.picture.upload") }]} />
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
                setDraft((d) => ({ ...d, prompt: "", mode: "svg", markup: "", name: key, category: library.find((a) => a.id === key)?.category ?? STORY }));
                setWay("ai");
              }}
            />
          )}
          {way === "ai" && <AiWay library={library} draft={draft} setDraft={setDraft} prefs={prefs} setPrefs={setPrefs} onUsed={use} />}
          {way === "upload" && <UploadWay onUsed={use} />}
        </div>
      </div>
    </div>
  );
}

/** A row of tiles reused for "this page's words" and "photos in this book" — no redraw handle, just a pick. */
function QuickTiles({ heading, keys, chosen, onUse }: { heading: string; keys: string[]; chosen: string | null; onUse(key: string): void }) {
  const { t } = useT();
  if (!keys.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">{heading}</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {keys.map((key) => (
          <li key={key}>
            <button type="button" onClick={() => onUse(key)} aria-pressed={chosen === key} aria-label={isPhoto(key) ? t("studio.pages.photo") : key} title={isPhoto(key) ? t("studio.pages.photo") : key}
              className={`flex w-full flex-col overflow-hidden rounded-xl border text-left ${chosen === key ? "border-indigo-600 ring-2 ring-indigo-600/30" : "border-line hover:border-indigo-400"}`}>
              <span className="block aspect-square w-full bg-play-sky"><Picture name={key} className="p-2" /></span>
              <span className="truncate px-2 py-1 text-xs text-muted">{isPhoto(key) ? t("studio.pages.photo") : key}</span>
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
  const { t } = useT();
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
      { id: EVERYTHING, name: t("studio.picture.all") },
      { id: STORY, name: t("studio.picture.story") },
      { id: BUILT_IN, name: t("studio.picture.builtIn") },
      ...filed.map((c) => ({ id: c, name: collectionName(c) })),
    ];
  }, [library, t]);

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
      <QuickTiles heading={suggestedLabel ?? t("studio.picture.fromWords")} keys={suggested} chosen={chosen} onUse={onUse} />
      <QuickTiles heading={t("studio.picture.photosInBook")} keys={photos} chosen={chosen} onUse={onUse} />

      <div className="grid gap-3">
        <label className="relative block">
          <span className="sr-only">{t("studio.picture.search")}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <UIInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("studio.picture.search")} className="pl-9" />
        </label>

        {/* One row that scrolls sideways. A library with twenty collections in it
            would otherwise open on four rows of chips and no pictures. */}
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={t("studio.picture.collection")}>
          {collections.map((c) => (
            <UIButton key={c.id} type="button" size="sm" variant={collection === c.id ? "primary" : "secondary"} aria-pressed={collection === c.id}
              onClick={() => setCollection(c.id)} className="shrink-0 whitespace-nowrap">
              {c.name}
            </UIButton>
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
                  <UIButton type="button" variant="secondary" size="icon" onClick={() => onRedraw(key)} aria-label={t("studio.picture.makeAgainKey", { key })} title={t("studio.picture.makeAgainKey", { key })} icon={<Pencil aria-hidden="true" />}
                    className={`absolute right-1 top-1 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 ${chosen === key ? "opacity-100" : "opacity-0"}`} />
                </li>
              ))}
            </ul>
            {allShown.length > displayed && (
              <UIButton type="button" variant="secondary" size="sm" fullWidth onClick={() => setDisplayed((d) => d + BATCH_SIZE)}>
                {t("studio.picture.loadMore", { shown: displayed, total: allShown.length })}
              </UIButton>
            )}
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
            {loading ? t("studio.picture.fetching") : q ? t("studio.picture.noneCalled", { query }) : t("studio.picture.emptyCollection")}
          </p>
        )}
      </div>
    </div>
  );
}

/** A photo from the author's own device. */
function UploadWay({ onUsed }: { onUsed(key: string): void }) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      onUsed(await uploadPhoto(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("studio.picture.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-3">
      <UIButton type="button" fullWidth isLoading={uploading} icon={<ImagePlus aria-hidden="true" />} onClick={() => fileRef.current?.click()}>
        {uploading ? t("studio.picture.uploading") : t("studio.picture.choosePhoto")}
      </UIButton>
      <input ref={fileRef} type="file" accept={PHOTO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" disabled={uploading}
        onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} />
      <p className="text-xs text-muted">
        {t("studio.picture.uploadNote", { wide: describeShape("banner"), tall: describeShape("portrait") })}
      </p>
      {error && <div role="alert"><UIFlashMessage type="error" message={error} /></div>}
    </div>
  );
}

/**
 * A picture made to order, by the model the author picks, in one of two forms.
 *
 * A *drawing* is a flat SVG in the house style, filed in the shared art library
 * under a name — the same pipeline the Art page's editor runs (inspect what the
 * sanitiser will drop, refuse markup that will not render, store the normalised
 * form) — because an icon is meant to be found and reused across books.
 *
 * A *picture* is a painted one-off for this book alone. It takes the photo path
 * (`uploadPhoto`, a content-addressed `photo-<hash>` key) and is cropped to the
 * page's shape before it is shown, so the preview is what the book will use.
 */
function AiWay({ library, draft, setDraft, prefs, setPrefs, onUsed }: {
  library: ReturnType<typeof useArtLibrary>;
  draft: Draft;
  setDraft(update: (d: Draft) => Draft): void;
  prefs: Prefs;
  setPrefs(patch: Partial<Prefs>): void;
  onUsed(key: string): void;
}) {
  const { t } = useT();
  const allowed = useSystem().allows("ai.artGeneration");
  const [busy, setBusy] = useState<"improving" | "making" | "saving" | null>(null);
  const [error, setError] = useState("");
  const { mode, kind, markup, name, photo, preview, subjectOnly, cambodia, before } = draft;
  const { provider, style, autoImprove } = prefs;
  const made = mode === "svg" ? Boolean(markup) : Boolean(photo);

  /** The description rewritten as a full brief, shown in the box so it can be read and edited. */
  const improve = async (text: string) => {
    const better = await improvePicturePrompt(text, { provider, mode, kind, subjectOnly, cambodia });
    setDraft((d) => ({ ...d, prompt: better, before: text }));
    return better;
  };

  const improveNow = async () => {
    if (!draft.prompt.trim() || busy) return;
    setBusy("improving");
    setError("");
    try {
      await improve(draft.prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("studio.picture.improveFailed"));
    } finally {
      setBusy(null);
    }
  };

  const make = async () => {
    if (!draft.prompt.trim() || busy) return;
    setError("");
    try {
      let prompt = draft.prompt;
      if (autoImprove) {
        setBusy("improving");
        prompt = await improve(prompt);
      }
      setBusy("making");
      if (mode === "svg") {
        const drawn = await generateSvg(prompt, { shape: kind, provider: provider === "openai" ? "chatgpt" : "gemini" });
        setDraft((d) => ({ ...d, markup: drawn, name: d.name || KEBAB(prompt) }));
      } else {
        const fitted = await cropToShape(await generateBookImage(prompt, kind, provider, style), kind);
        setDraft((d) => {
          if (d.preview) URL.revokeObjectURL(d.preview);
          return { ...d, photo: fitted, preview: URL.createObjectURL(fitted) };
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("studio.picture.makeFailed"));
    } finally {
      setBusy(null);
    }
  };

  const taken = library.some((a) => a.id === name);
  const nameError = name && !SVG_ID_PATTERN.test(name) ? t("studio.picture.nameRule") : "";
  // What the sanitiser will make of it, worked out before it is filed rather
  // than discovered as a blank frame in somebody's book.
  const verdict = useMemo(() => inspectSvgMarkup(markup), [markup]);
  const canUse = busy === null && (mode === "svg" ? Boolean(markup && name) && !nameError && verdict.state === "ok" : Boolean(photo));

  const use = async () => {
    if (!canUse) return;
    setBusy("saving");
    setError("");
    try {
      if (mode === "svg") {
        await saveSvgAsset(name, preprocessSvgMarkup(markup.trim()), draft.category.trim() || UNCATEGORISED);
        await listSvgAssets().catch(() => undefined);
        playSound("pop");
        onUsed(name);
      } else if (photo) {
        onUsed(await uploadPhoto(photo));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("studio.picture.saveFailed"));
    } finally {
      setBusy(null);
    }
  };

  if (!allowed) {
    return (
      <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
        {t("studio.picture.aiOff")}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="picture-prompt" className={fieldLabel}>{t("studio.picture.describe")}</label>
          <div className="flex items-center gap-1">
            {before !== null && (
              <UILinkButton type="button" onClick={() => setDraft((d) => ({ ...d, prompt: d.before ?? d.prompt, before: null }))}>{t("studio.picture.undo")}</UILinkButton>
            )}
            <UIButton type="button" variant="ghost" size="sm" icon={<Wand2 aria-hidden="true" />} isLoading={busy === "improving"}
              disabled={!draft.prompt.trim() || busy !== null} onClick={() => void improveNow()}>
              {t("studio.picture.improve")}
            </UIButton>
          </div>
        </div>
        <UITextarea id="picture-prompt" aria-label={t("studio.picture.describe")} value={draft.prompt} rows={3}
          onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value, before: null }))}
          placeholder={t("studio.picture.describeHint")} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t("studio.picture.kind")} className="flex gap-1.5">
          {([["svg", t("studio.picture.drawing")], ["image", t("studio.picture.picture")]] as const).map(([id, name]) => (
            <UIButton key={id} type="button" size="sm" variant={mode === id ? "primary" : "secondary"} aria-pressed={mode === id} onClick={() => setDraft((d) => ({ ...d, mode: id }))}>
              {name}
            </UIButton>
          ))}
        </div>
        <UIMenu align="end" className="w-64" trigger={({ toggle, isOpen }) => (
          <UIButton type="button" size="sm" variant="secondary" className="ml-auto" aria-haspopup="menu" aria-expanded={isOpen} aria-label={t("studio.batch.options")} icon={<Settings2 aria-hidden="true" />} onClick={toggle}>
            {[provider === "openai" ? "OpenAI" : "Gemini", kind === "portrait" ? t("studio.picture.tall") : t("studio.picture.wide"), ...(mode === "image" ? [styleName(style)] : [])].join(" · ")}
            <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
          </UIButton>
        )}>
          <UIMenuLabel>{t("studio.picture.madeBy")}</UIMenuLabel>
          {([["gemini", "Gemini"], ["openai", "OpenAI"]] as const).map(([id, name]) => (
            <UIMenuItem key={id} isActive={provider === id} onSelect={() => setPrefs({ provider: id })}>{name}</UIMenuItem>
          ))}
          <UIMenuSeparator />
          <UIMenuLabel>{t("studio.picture.shape")}</UIMenuLabel>
          {(["banner", "portrait"] as const).map((id) => (
            <UIMenuItem key={id} isActive={kind === id} onSelect={() => setDraft((d) => ({ ...d, kind: id }))}>{id === "banner" ? t("studio.picture.wide") : t("studio.picture.tall")}</UIMenuItem>
          ))}
          {mode === "image" && (
            <>
              <UIMenuSeparator />
              <UIMenuLabel>{t("studio.picture.style")}</UIMenuLabel>
              {(["3d", "flat", "painted"] as const).map((id) => (
                <UIMenuItem key={id} isActive={style === id} onSelect={() => setPrefs({ style: id })}>{styleName(id)}</UIMenuItem>
              ))}
            </>
          )}
          <UIMenuSeparator />
          <MenuCheck label={t("studio.picture.subjectOnly")} checked={subjectOnly} onChange={() => setDraft((d) => ({ ...d, subjectOnly: !d.subjectOnly }))} />
          <MenuCheck label={t("studio.picture.cambodia")} checked={cambodia} onChange={() => setDraft((d) => ({ ...d, cambodia: !d.cambodia }))} />
          <MenuCheck label={t("studio.picture.autoImprove")} checked={autoImprove} onChange={() => setPrefs({ autoImprove: !autoImprove })} />
        </UIMenu>
      </div>
      <p className="-mt-1 text-xs text-muted">
        {mode === "svg" ? t("studio.picture.svgNote") : t("studio.picture.imageNote")} {describeShape(kind)}
      </p>

      <UIButton type="button" fullWidth variant={made ? "secondary" : "primary"} icon={<Sparkles aria-hidden="true" />} isLoading={busy === "improving" || busy === "making"}
        disabled={!draft.prompt.trim() || busy !== null} onClick={() => void make()}>
        {busy === "improving" ? t("studio.picture.improving") : busy === "making" ? t("studio.picture.making") : made ? t("studio.picture.makeAgain") : t("studio.picture.make")}
      </UIButton>

      {made && (
        <div className="grid gap-3 rounded-2xl border border-line p-3">
          <div className={`mx-auto w-full overflow-hidden rounded-xl bg-play-sky ${kind === "banner" ? "max-w-sm" : "max-w-[10rem]"}`}>
            {mode === "svg" ? <div className="p-3"><SvgMarkup markup={markup} raw size="100%" /></div> : <img src={preview} alt="" className="block h-auto w-full" />}
          </div>

          {mode === "svg" && (
            <>
              {/* The sanitiser drops silently, so this is the one place it must not. */}
              {verdict.state === "invalid" ? (
                <div role="alert"><UIFlashMessage type="error" message={verdict.message} /></div>
              ) : verdict.state === "ok" && (verdict.droppedElements > 0 || verdict.droppedAttributes > 0) ? (
                <UIFlashMessage type="info" message={t("studio.picture.dropped")} />
              ) : null}
              <label className="grid gap-1.5">
                <span className={fieldLabel}>{t("studio.picture.saveAs")}</span>
                <UIInput value={name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value.trim() }))} placeholder="market-stall" />
                {nameError ? (
                  <span role="alert" className="text-xs font-bold text-rose-700 dark:text-rose-300">{nameError}</span>
                ) : taken ? (
                  <span className="text-xs text-muted">{t("studio.picture.replaces", { name })}</span>
                ) : null}
              </label>
            </>
          )}

          <UIButton type="button" fullWidth variant="success" isLoading={busy === "saving"} disabled={!canUse} onClick={() => void use()}>
            {busy === "saving" ? t("studio.picture.saving") : t("studio.picture.use")}
          </UIButton>
        </div>
      )}

      {error && <div role="alert"><UIFlashMessage type="error" message={error} /></div>}
    </div>
  );
}

const styleName = (id: ImageStyle) => (id === "3d" ? "3D" : id === "flat" ? translate("studio.picture.flat") : translate("studio.picture.painted"));

/** An on/off choice inside the options menu; it stays open so several can be set. */
function MenuCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange(): void }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={checked} onClick={onChange} className={themeSystem.menu.item(false, "default")}>
      <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-400"}`} aria-hidden="true">
        {checked && <Check className="h-3 w-3" />}
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}
