import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, ImageOff, Loader2, Settings2, Sparkles, Square } from "lucide-react";
import { layoutBook, pagePicture, withPageChoice, withPagePicture } from "../bookLayout";
import { type Passage } from "../data/passage";
import { isPhoto, photosOf, uploadPhoto } from "../photos";
import { core } from "../data/text";
import { pictureFor } from "../draft";
import { Picture, PICTURE_KEYS } from "../Picture";
import { cropToShape, generateBookImage, improvePicturePrompt, type ImageProvider, type ImageStyle } from "../imageGenerationApi";
import { PicturePanel, readPrefs, rememberPrefs } from "./PicturePanel";
import { pickSlots, slotKind, slotPrompt, type QuickPick, type Slot, type SlotInfo, type SlotState } from "./batchPictures";
import { useSystem } from "../../lib/sync";
import { UIButton, UICard, UIFlashMessage, UIMenu, UIMenuItem, UIMenuLabel, UIMenuSeparator } from "../../components/ui";
import { useT } from "../../lib/i18n";

/**
 * Pages & pictures — the book as a reader will turn it, one card a page, with a
 * picture to choose for the cover and for each page.
 *
 * Pages are laid out by the same `layoutBook` the reader uses, so what is shown
 * here is what a child gets. A page is Automatic until someone chooses (the
 * picture of the first pictured word on it); it can be given any picture from
 * the art library, or none. Choosing here never touches the quiz: a Words
 * question's picture is the word's own, in `pictures`.
 *
 * Clicking a card is the only step: it opens the picture drawer (`PicturePanel`)
 * directly, rather than a persistent panel sitting beside the pages. There is
 * nothing to keep in view once a page is chosen, and a drawer that opens on
 * demand is one less thing on screen while an author is just reading their pages.
 *
 * "Make pictures with AI" is the other way: tick any pages (and the cover), and
 * a painted picture is made for each, one after another, and put on its page as
 * it arrives. One at a time keeps a provider's rate limit from failing the lot,
 * and a page that fails says so and can be tried again on its own.
 */

type Draft = Omit<Passage, "rev">;

const KHMER = "font-['Noto_Sans_Khmer','Khmer_OS','Khmer_MN',sans-serif]";
const SERIF = "font-['Iowan_Old_Style','Palatino_Linotype','Book_Antiqua',Georgia,'Times_New_Roman',serif]";

/* Worded under `studio.pages.how.<how>` and `studio.pages.place.<at>`. */

/** The book's pages as cards: what each says, and the picture it shows. */
function pagesOf(draft: Draft) {
  const km = draft.language === "km";
  return layoutBook(draft).story.map((page, i) => ({
    n: i + 1,
    ids: page.map((s) => s.sentence.id),
    text: page.map((s) => s.sentence.text).join(km ? "" : " "),
    picture: pagePicture(page, draft),
    words: [...new Set(page.flatMap((s) => s.tokens.map((t) => t.word)))],
  }));
}

/** The cover and every page, as a batch sees them. */
const slotsOf = (draft: Draft, pages: ReturnType<typeof pagesOf>): SlotInfo[] => [
  { slot: 0, text: draft.title, how: draft.picture ? "chosen" : "auto", at: null },
  ...pages.map((p) => ({ slot: p.n, text: p.text, how: p.picture.how, at: p.picture.at })),
];

export function PagesStep({ draft, onEdit }: { draft: Draft; onEdit(d: Draft): void }) {
  const { t } = useT();
  const km = draft.language === "km";
  // null = drawer closed; 0 = cover open; n = page n open.
  const [open, setOpen] = useState<number | null>(null);
  const pages = useMemo(() => pagesOf(draft), [draft]);
  const batch = useBatch(draft, onEdit);
  const aiAllowed = useSystem().allows("ai.artGeneration");
  const current = open ? pages[open - 1] : null;
  // The pictures of the words on this page (the story's, for the cover): the
  // ones the book already declares first, then any the library can draw.
  const suggested = [
    ...new Set(
      (current ? current.words : draft.sentences.flatMap((s) => s.words.map(core)))
        .flatMap((w) => [draft.pictures[w.toLowerCase()] ?? draft.pictures[w], pictureFor(w, draft.language, PICTURE_KEYS)])
        .filter((k): k is string => !!k),
    ),
  ];
  const choose = (key: string | null | undefined) => {
    if (!current) {
      if (key) onEdit({ ...draft, picture: key });
      return;
    }
    onEdit(withPagePicture(draft, current.ids, key));
  };
  const chosenKey = open === null ? null : current ? current.picture.key : draft.picture;
  /**
   * What "Make with AI" opens with, so the model is told what to draw rather than
   * handed a bare line of the story and left to guess a subject out of it.
   */
  const promptSeed = slotPrompt(current?.text ?? "", draft.title, !current);
  const pick = (slot: Slot) => (batch.selecting ? batch.toggle(slot) : setOpen(slot));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold text-ink">{t("studio.step.pages")}</h2>
          <p className="text-sm text-muted">{t("studio.pages.intro", { count: pages.length })}</p>
        </div>
        {aiAllowed && !batch.selecting && (
          <UIButton type="button" size="sm" variant="secondary" icon={<Sparkles aria-hidden="true" />} onClick={() => batch.start(slotsOf(draft, pages))}>
            {t("studio.batch.open")}
          </UIButton>
        )}
      </div>

      {batch.selecting && <BatchBar batch={batch} slots={slotsOf(draft, pages)} cambodiaDefault={km} />}

      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" aria-label={t("reader.pages")}>
        <li>
          <PageCard label={t("reader.cover")} selected={batch.selecting ? batch.chosen.has(0) : open === 0} ticking={batch.selecting} state={batch.states[0]} onSelect={() => pick(0)} picture={draft.picture} how="" km={km} text={draft.title} title />
        </li>
        {pages.map((p) => (
          <li key={p.n}>
            <PageCard label={t("studio.pages.page", { n: p.n })} selected={batch.selecting ? batch.chosen.has(p.n) : open === p.n} ticking={batch.selecting} state={batch.states[p.n]} onSelect={() => pick(p.n)} picture={p.picture.key} how={t(`studio.pages.how.${p.picture.how}`)} chosen={p.picture.how === "chosen"} place={p.picture.key && p.picture.at !== "top" ? t(`studio.pages.place.${p.picture.at}`) : ""} km={km} text={p.text} />
          </li>
        ))}
      </ol>

      {open !== null && !batch.selecting && (
        <PicturePanel
          title={current ? t("studio.pages.pictureFor", { n: current.n }) : t("studio.pages.pictureForCover")}
          chosen={chosenKey}
          how={current?.picture.how ?? "chosen"}
          promptSeed={promptSeed}
          brief={{ cambodia: km }}
          suggested={suggested}
          photos={photosOf(draft)}
          allowNone={!!current}
          at={current?.picture.at ?? null}
          onPlace={(at) => current && onEdit(withPageChoice(draft, current.ids, { at }))}
          onChoose={choose}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function PageCard({ label, selected, ticking = false, state, onSelect, picture, how, chosen = false, place = "", text, km, title = false }: {
  label: string; selected: boolean; ticking?: boolean; state?: SlotState; onSelect(): void; picture: string | null; how: string; chosen?: boolean; place?: string; text: string; km: boolean; title?: boolean;
}) {
  const { t } = useT();
  const what = picture ? (isPhoto(picture) ? t("studio.pages.photoLower") : picture) : t("studio.pages.noPictureLower");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${label}: ${what}${how ? ` (${how}${place ? `, ${place.toLowerCase()}` : ""})` : ""}${state ? ` — ${t(`studio.batch.state.${state}`)}` : ""}`}
      className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-surface text-left transition-colors ${selected ? "border-indigo-600 ring-2 ring-indigo-600/30" : "border-line hover:border-indigo-400"}`}
    >
      <span className="relative block aspect-[16/10] w-full bg-play-sky">
        {ticking && (
          <span aria-hidden="true" className={`absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-md border-2 ${selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-white bg-white/80 dark:border-slate-500 dark:bg-slate-900/80"}`}>
            {selected && <Check className="h-4 w-4" />}
          </span>
        )}
        {state && <StateBadge state={state} />}
        {picture ? (
          <Picture name={picture} className="p-2" whole={title} />
        ) : (
          <span className="grid h-full w-full place-items-center bg-surface-muted text-muted">
            <ImageOff className="h-6 w-6" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="grid gap-1 p-3">
        <span className="flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider text-muted">
          <span>{label}{place && <span className="ml-1 normal-case tracking-normal text-muted">· {place}</span>}</span>
          {how && <span className={`rounded-full px-2 py-0.5 normal-case tracking-normal ${chosen ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" : "bg-surface-muted text-ink"}`}>{how}</span>}
        </span>
        <span className={`line-clamp-3 text-sm text-ink ${km ? KHMER : SERIF} ${title ? "font-bold" : ""}`}>{text}</span>
      </span>
    </button>
  );
}

function StateBadge({ state }: { state: SlotState }) {
  const { t } = useT();
  const look = {
    queued: "bg-white/90 text-ink dark:bg-slate-900/90",
    making: "bg-indigo-600 text-white",
    done: "bg-emerald-600 text-white",
    failed: "bg-rose-600 text-white",
  }[state];
  const Icon = state === "making" ? Loader2 : state === "done" ? Check : state === "failed" ? AlertCircle : null;
  return (
    <span className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${look}`}>
      {Icon && <Icon className={`h-3.5 w-3.5 ${state === "making" ? "animate-spin" : ""}`} aria-hidden="true" />}
      {t(`studio.batch.state.${state}`)}
    </span>
  );
}

interface BatchOptions {
  provider: ImageProvider;
  style: ImageStyle;
  improve: boolean;
  cambodia: boolean;
}

/**
 * Pages ticked for a batch, and the run that makes their pictures.
 *
 * Every picture is put on its page against the *latest* draft, not the one the
 * run started with, so the pages made earlier in the same run are kept. Leaving
 * the step stops the run: a picture arriving after that would be written over a
 * draft edited somewhere else.
 */
function useBatch(draft: Draft, onEdit: (d: Draft) => void) {
  const [selecting, setSelecting] = useState(false);
  const [chosen, setChosen] = useState<Set<Slot>>(new Set());
  const [states, setStates] = useState<Record<Slot, SlotState>>({});
  const [errors, setErrors] = useState<Record<Slot, string>>({});
  const [running, setRunning] = useState(false);
  const latest = useRef(draft);
  latest.current = draft;
  const stopped = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      stopped.current = true;
    };
  }, []);

  const mark = (slot: Slot, state: SlotState) => live.current && setStates((s) => ({ ...s, [slot]: state }));

  const place = (slot: Slot, key: string) => {
    const book = latest.current;
    const next = slot === 0 ? { ...book, picture: key } : (() => {
      const page = pagesOf(book)[slot - 1];
      return page ? withPagePicture(book, page.ids, key) : book;
    })();
    latest.current = next;
    onEdit(next);
  };

  const run = async (slots: Slot[], o: BatchOptions) => {
    if (running || !slots.length) return;
    stopped.current = false;
    setRunning(true);
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !slots.includes(Number(k)))));
    setStates((s) => ({ ...s, ...Object.fromEntries(slots.map((slot) => [slot, "queued" as const])) }));
    for (const slot of slots) {
      if (stopped.current) break;
      mark(slot, "making");
      try {
        const book = latest.current;
        const info = slotsOf(book, pagesOf(book)).find((s) => s.slot === slot);
        if (!info) throw new Error("gone");
        const kind = slotKind(info);
        let prompt = slotPrompt(info.text, book.title, slot === 0);
        if (o.improve) prompt = await improvePicturePrompt(prompt, { provider: o.provider, mode: "image", kind, subjectOnly: false, cambodia: o.cambodia });
        else if (o.cambodia) prompt += " Show it as it looks in Cambodia.";
        const picture = await cropToShape(await generateBookImage(prompt, kind, o.provider, o.style), kind);
        const key = await uploadPhoto(picture);
        if (!live.current) return;
        place(slot, key);
        mark(slot, "done");
      } catch (e) {
        if (!live.current) return;
        mark(slot, "failed");
        setErrors((x) => ({ ...x, [slot]: e instanceof Error ? e.message : "" }));
      }
    }
    if (!live.current) return;
    // What a Stop left unmade goes back to plain, so it reads as untouched.
    setStates((s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== "queued")) as Record<Slot, SlotState>);
    setRunning(false);
  };

  return {
    selecting,
    chosen,
    states,
    errors,
    running,
    start: (slots: SlotInfo[]) => {
      setSelecting(true);
      setStates({});
      setErrors({});
      setChosen(new Set(pickSlots(slots, "missing", latest.current.picture)));
    },
    toggle: (slot: Slot) => {
      if (running) return;
      setChosen((c) => {
        const next = new Set(c);
        if (next.has(slot)) next.delete(slot);
        else next.add(slot);
        return next;
      });
    },
    pick: (slots: SlotInfo[], how: QuickPick) => !running && setChosen(new Set(pickSlots(slots, how, latest.current.picture))),
    run,
    stop: () => {
      stopped.current = true;
    },
    close: () => {
      if (running) return;
      setSelecting(false);
      setChosen(new Set());
      setStates({});
      setErrors({});
    },
  };
}

type Batch = ReturnType<typeof useBatch>;

/** The batch's choices and progress, above the pages it acts on. */
function BatchBar({ batch, slots, cambodiaDefault }: { batch: Batch; slots: SlotInfo[]; cambodiaDefault: boolean }) {
  const { t } = useT();
  const [o, setO] = useState<BatchOptions>(() => {
    const p = readPrefs();
    return { provider: p.provider, style: p.style, improve: p.autoImprove, cambodia: cambodiaDefault };
  });
  const set = (patch: Partial<BatchOptions>) => {
    setO((x) => ({ ...x, ...patch }));
    if (patch.provider) rememberPrefs({ provider: patch.provider });
    if (patch.style) rememberPrefs({ style: patch.style });
    if (patch.improve !== undefined) rememberPrefs({ autoImprove: patch.improve });
  };
  // In page order, cover first, whatever order they were ticked in.
  const order = slots.map((s) => s.slot).filter((s) => batch.chosen.has(s));
  const all = Object.entries(batch.states);
  const done = all.filter(([, v]) => v === "done").length;
  const failed = all.filter(([, v]) => v === "failed").map(([k]) => Number(k));
  const settled = done + failed.length;
  const total = all.length;
  const finished = !batch.running && total > 0;
  const nameOf = (slot: Slot) => (slot === 0 ? t("reader.cover") : t("studio.pages.page", { n: slot }));
  const lock = batch.running;

  const styleName = { "3d": "3D", flat: t("studio.picture.flat"), painted: t("studio.picture.painted") }[o.style];
  const providerName = o.provider === "openai" ? "OpenAI" : "Gemini";

  return (
    <UICard className="sticky top-2 z-20 grid gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="koda-admin-card-title">{t("studio.batch.title")}</h3>
          <p className="text-xs text-muted">{t("studio.batch.note")}</p>
        </div>
        <UIButton type="button" variant="ghost" size="sm" disabled={lock} onClick={batch.close}>{finished ? t("studio.batch.done") : t("common.cancel")}</UIButton>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <UIMenu className="w-56" trigger={({ toggle, isOpen }) => (
          <UIButton type="button" size="sm" variant="secondary" disabled={lock} aria-haspopup="menu" aria-expanded={isOpen} aria-label={t("studio.batch.select")} onClick={toggle}>
            {t("studio.batch.selected", { count: order.length })}
            <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
          </UIButton>
        )}>
          {({ close }) => (["all", "missing", "none"] as const).map((how) => (
            <UIMenuItem key={how} onSelect={() => { batch.pick(slots, how); close(); }}>
              {t(`studio.batch.${how === "none" ? "clear" : how}`)}
            </UIMenuItem>
          ))}
        </UIMenu>

        <UIMenu className="w-64" trigger={({ toggle, isOpen }) => (
          <UIButton type="button" size="sm" variant="secondary" disabled={lock} aria-haspopup="menu" aria-expanded={isOpen} aria-label={t("studio.batch.options")} icon={<Settings2 aria-hidden="true" />} onClick={toggle}>
            {providerName} · {styleName}
            <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
          </UIButton>
        )}>
          <UIMenuLabel>{t("studio.picture.madeBy")}</UIMenuLabel>
          {([["gemini", "Gemini"], ["openai", "OpenAI"]] as const).map(([id, name]) => (
            <UIMenuItem key={id} isActive={o.provider === id} onSelect={() => set({ provider: id })}>{name}</UIMenuItem>
          ))}
          <UIMenuSeparator />
          <UIMenuLabel>{t("studio.picture.style")}</UIMenuLabel>
          {(["3d", "flat", "painted"] as const).map((id) => (
            <UIMenuItem key={id} isActive={o.style === id} onSelect={() => set({ style: id })}>{{ "3d": "3D", flat: t("studio.picture.flat"), painted: t("studio.picture.painted") }[id]}</UIMenuItem>
          ))}
          <UIMenuSeparator />
          <UIMenuItem isActive={o.improve} onSelect={() => set({ improve: !o.improve })}>{t("studio.batch.improve")}</UIMenuItem>
          <UIMenuItem isActive={o.cambodia} onSelect={() => set({ cambodia: !o.cambodia })}>{t("studio.picture.cambodia")}</UIMenuItem>
        </UIMenu>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {batch.running ? (
            <>
              <p className="text-sm font-semibold text-ink" aria-live="polite">{t("studio.batch.progress", { n: Math.min(settled + 1, total), total })}</p>
              <UIButton type="button" size="sm" variant="secondary" icon={<Square aria-hidden="true" />} onClick={batch.stop}>{t("studio.batch.stop")}</UIButton>
            </>
          ) : (
            <>
              {finished && <p className="text-sm text-muted" aria-live="polite">{t("studio.batch.summary", { done, failed: failed.length })}</p>}
              {failed.length > 0 && (
                <UIButton type="button" size="sm" variant="secondary" onClick={() => void batch.run(failed, o)}>{t("studio.batch.retry", { count: failed.length })}</UIButton>
              )}
              <UIButton type="button" size="sm" icon={<Sparkles aria-hidden="true" />} disabled={!order.length} onClick={() => void batch.run(order, o)}>
                {t("studio.batch.make", { count: order.length })}
              </UIButton>
            </>
          )}
        </div>
      </div>
      {batch.running && <p className="text-xs text-muted">{t("studio.batch.stay")}</p>}
      {failed.length > 0 && !batch.running && (
        <UIFlashMessage type="error" message={failed.map((slot) => `${nameOf(slot)}: ${batch.errors[slot] || t("studio.picture.makeFailed")}`).join(" · ")} />
      )}
    </UICard>
  );
}
