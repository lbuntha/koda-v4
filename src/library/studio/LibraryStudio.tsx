import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronUp, CornerLeftUp, Download, Mic, Play, Plus, RefreshCw, Scissors, Sparkles, Square, Trash2, Upload, X } from "lucide-react";
import { BANDS, CHOICES, minimumQuestions, type Band, type ComprehensionQuestion, type Language, type Passage, type Question, type QuestionCounts, type SpellQuestion, type VocabQuestion, type WordCue } from "../data/passage";
import { readingLexiconFor, readingWordsFor } from "../data/readingLexicon";
import { core, gapOf } from "../data/text";
import { RULES, verifyPassage, type Verdict } from "../data/verifyPassage";
import { tilesOf, whyUnspellable } from "../data/tiles";
import { BAND_LEVEL_CAP, LEVEL_NAME, spellingLevel, unitCue } from "../data/khmerCoach";
import { deleteBook, fetchDraft, fetchReports, fetchStudioMeta, publishBook, requestAiCorrection, requestAiDraft, resolveReport, saveDraft, unpublishBook, type BookReport, type BookRow, type BookSummary, type Provider, type StudioMeta } from "../api";
import { baseOf, draftLocally, fromModel, joinSentences, mergeWords, pictureFor, vocabQuestion, withVocabPicture, type StoryInput } from "../draft";
import { BookPreview } from "../LibraryPage";
import { PagesStep } from "./PagesStep";
import { PicturePanel } from "./PicturePanel";
import { UnitNamesPanel } from "./UnitNamesPanel";
import { StudioHome } from "./StudioHome";
import { useRecorder } from "./recorder";
import { Picture, PICTURE_KEYS } from "../Picture";
import { photosOf } from "../photos";
import { BookStore } from "../bookStore";
import { clipSizes, clipUrl, pcmToWav, uploadClip } from "../clips";
import { say, stop } from "../voice";
import { tutorHeaders } from "../../lib/tutorApi";
import { UIInput, UIRadio, UISelect, UITabs, type UITabItem } from "../../components/ui";
import "../khmerFont";

/**
 * Library Studio — where an operator writes, checks and publishes books.
 *
 *   Source → Generate → Review & modify → Pages & pictures → Voice (optional) → Preview → Publish
 *
 * A model drafts; the checks judge; a person decides. The checks here run on
 * every edit so problems are seen as they are made, and the server runs them
 * again on publish, so nothing the browser says can put a book on a child's shelf.
 */

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Draft = Omit<Passage, "rev">;
type Source = Provider | "offline";

const STEPS = ["Source", "Generate", "Review & modify", "Pages & pictures", "Voice (optional)", "Preview", "Publish"] as const;
const PROVIDERS: Array<{ id: Source; name: string; note: string }> = [
  { id: "gemini", name: "Gemini", note: "Google" },
  { id: "chatgpt", name: "ChatGPT", note: "OpenAI" },
  { id: "claude", name: "Claude", note: "Anthropic" },
  { id: "offline", name: "Offline drafter", note: "no key · questions from the story’s own words" },
];
const KHMER = "font-['Noto_Sans_Khmer','Khmer_OS','Khmer_MN',sans-serif]";
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const primary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
const quiet = `${btn} border border-line bg-surface text-ink hover:border-indigo-400`;
const field = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink";
const label = "mb-1 block text-xs font-extrabold uppercase tracking-wider text-muted";

const REPORT_LABEL: Record<string, string> = {
  wrong_in_story: "Something in the story is wrong",
  wrong_question: "A question or answer is wrong",
  not_for_children: "Not right for children",
  other: "Something else",
};

const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) ||
  `book-${Date.now().toString(36)}`;

/** A new book: the first band, and no shelf until the author picks one from the server's list. */
const emptyInput = (): StoryInput => ({ id: "", title: "", language: "en", band: Object.keys(BANDS)[0] as Band, questionCounts: { ...BANDS.A }, category: "", text: "" });

export function LibraryStudio() {
  const [meta, setMeta] = useState<StudioMeta | null>(null);
  const [open, setOpen] = useState<{ row: BookRow | null; reports: BookReport[] } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [openError, setOpenError] = useState("");
  const [names, setNames] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchStudioMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  // A row is a summary; the editor needs the whole book, and its open reports.
  const openBook = async (b: BookSummary) => {
    setOpening(b.id);
    setOpenError("");
    try {
      const [row, reports] = await Promise.all([fetchDraft(b.id), fetchReports(b.id).catch(() => [] as BookReport[])]);
      setOpen({ row, reports });
    } catch (e) {
      setOpenError(`“${b.title}” could not be opened: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setOpening(null);
    }
  };

  if (names) return <UnitNamesPanel onClose={() => setNames(false)} />;

  if (open) {
    return (
      <Editor
        row={open.row}
        categories={meta?.categories ?? []}
        reports={open.reports}
        onResolved={(id) => setOpen((o) => (o ? { ...o, reports: o.reports.filter((r) => r.id !== id) } : o))}
        onClose={() => {
          setOpen(null);
          setRefreshKey((n) => n + 1);
          void BookStore.refresh();
        }}
      />
    );
  }

  return (
    <>
      {openError && <p role="alert" className="mx-auto mt-4 max-w-[100rem] px-4 sm:px-6"><span className="block rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{openError}</span></p>}
      <StudioHome
        meta={meta}
        opening={opening}
        refreshKey={refreshKey}
        onOpen={(b) => void openBook(b)}
        onNew={() => setOpen({ row: null, reports: [] })}
        onSoundNames={() => setNames(true)}
      />
    </>
  );
}

function Editor({ row, categories, reports = [], onResolved, onClose }: { row: BookRow | null; categories: readonly string[]; reports?: BookReport[]; onResolved?(id: string): void; onClose(): void }) {
  const start = row?.draft;
  const [step, setStep] = useState<Step>(start ? 3 : 1);
  const [source, setSource] = useState<Source>((row?.provider as Source) ?? "gemini");
  const [input, setInput] = useState<StoryInput>(() =>
    start
      ? { id: row!.id, title: start.title, language: start.language, band: start.band, questionCounts: start.questionCounts ?? { ...BANDS[start.band] }, category: start.category ?? "", text: start.sentences.map((s) => s.text).join("\n") }
      : emptyInput(),
  );
  const [draft, setDraft] = useState<Draft | null>(start ?? null);
  const [confirmed, setConfirmed] = useState(row?.confirmedSplit ?? false);
  const [status, setStatus] = useState<{ rev: number; published: boolean }>({ rev: row?.rev ?? 0, published: row?.status === "published" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "generate" | "save" | "publish">("");
  const [note, setNote] = useState<{ kind: "ok" | "bad" | "info"; text: string } | null>(null);
  const isNew = !row;
  const id = row?.id ?? (input.id || slug(input.title));
  const km = (draft?.language ?? input.language) === "km";

  const verdict = useMemo<Verdict | null>(() => (draft ? verifyPassage({ ...draft, rev: 1 }, { confirmedSplit: confirmed, lexicon: readingLexiconFor(draft.band, draft.language) }) : null), [draft, confirmed]);
  const edit = (next: Draft) => {
    setDraft(next);
    setDirty(true);
  };

  const generate = async (via: Source = source) => {
    if (!input.text.trim()) return;
    setBusy("generate");
    setNote(null);
    const base = baseOf({ ...input, id });
    try {
      let reply;
      let usedAi = false;
      if (via === "offline") reply = draftLocally(base, PICTURE_KEYS);
      else {
        const r = await requestAiDraft({ provider: via, language: base.language, band: base.band, questionCounts: base.questionCounts ?? BANDS[base.band], sentences: base.sentences.map((s) => s.text), pictures: [...PICTURE_KEYS], easyWords: readingWordsFor(base.band, base.language) });
        reply = r.draft;
        usedAi = true;
      }
      const next = fromModel(base, reply, PICTURE_KEYS);
      setDraft(next);
      setConfirmed(base.language !== "km");
      setDirty(true);
      const need = base.questionCounts ?? BANDS[base.band];
      setNote({
        kind: "ok",
        text: `${usedAi ? PROVIDERS.find((p) => p.id === via)?.name : "The offline drafter"} drafted ${next.questions.filter((q) => q.kind === "comprehension").length} understand, ${next.questions.filter((q) => q.kind === "vocab").length} words and ${next.questions.filter((q) => q.kind === "spell").length} spell (band ${base.band} needs ${need.understand} / ${need.words} / ${need.spell}). Anything the checks could not trust was left out.`,
      });
      setStep(3);
    } catch (e) {
      setNote({ kind: "bad", text: `${e instanceof Error ? e.message : "The drafter failed."} You can use the offline drafter instead.` });
    } finally {
      setBusy("");
    }
  };

  const save = async (): Promise<boolean> => {
    if (!draft) return false;
    setBusy("save");
    try {
      const { id: _i, ...passage } = { ...draft, id };
      const saved = await saveDraft(id, passage, confirmed, source === "offline" ? "offline" : source);
      setStatus({ rev: saved.rev, published: saved.status === "published" });
      setDirty(false);
      setNote({ kind: "ok", text: "Draft saved." });
      return true;
    } catch (e) {
      setNote({ kind: "bad", text: e instanceof Error ? e.message : "Could not save." });
      return false;
    } finally {
      setBusy("");
    }
  };

  const publish = async () => {
    if (!(await save())) return;
    setBusy("publish");
    try {
      const out = await publishBook(id);
      setStatus({ rev: out.rev, published: true });
      setNote({ kind: "ok", text: `Published revision ${out.rev}. Devices pick it up the next time the library opens online, and keep it for offline.` });
      void BookStore.refresh();
    } catch (e) {
      setNote({ kind: "bad", text: `The server refused to publish: ${e instanceof Error ? e.message : "unknown reason"}` });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button type="button" className={quiet} onClick={onClose}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted">{id}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-black ${status.published ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-surface-muted text-ink"}`}>
            {status.published ? `Published · rev ${status.rev}` : "Not published"}
          </span>
          {draft && (
            <button type="button" className={quiet} onClick={() => void save()} disabled={busy !== "" || !dirty}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              {dirty ? "Save draft" : "Saved"}
            </button>
          )}
        </div>
      </div>

      <ol className="mb-5 flex items-center gap-0 overflow-x-auto px-1 pb-2" aria-label="Steps">
        {STEPS.map((name, i) => {
          const n = (i + 1) as Step;
          const locked = n > 2 && !draft;
          return (
            <li key={name} className="flex shrink-0 items-center">
              <button type="button" disabled={locked} aria-current={step === n ? "step" : undefined} onClick={() => setStep(n)}
                className={`group inline-flex min-h-11 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition-colors ${step === n ? "border-[#534AB7] bg-[#F1EFFF] text-[#0E0B55] shadow-sm" : step > n ? "border-emerald-200 bg-white text-[#6D6997]" : "border-line bg-white text-[#8D89AE]"} disabled:cursor-not-allowed disabled:opacity-40`}>
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${step > n ? "bg-emerald-500 text-white" : step === n ? "bg-[#534AB7] text-white" : "bg-[#F1EFFF] text-[#534AB7]"}`}>{step > n ? <Check className="h-4 w-4" aria-hidden="true" /> : n}</span>
                <span className="whitespace-nowrap">{name}</span>
              </button>
              {i < STEPS.length - 1 && <span aria-hidden="true" className={`mx-1 h-0.5 w-5 shrink-0 ${step > n ? "bg-emerald-300" : "bg-[#E5E1F5]"}`} />}
            </li>
          );
        })}
      </ol>

      {reports.length > 0 && (
        <div className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/50">
          <h2 className="mb-2 font-extrabold text-rose-900 dark:text-rose-100">⚑ Reported by readers</h2>
          <ul className="grid gap-2">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                <span><b>{REPORT_LABEL[r.reason] ?? r.reason}</b> · revision {r.rev}{r.note ? ` — “${r.note}”` : ""}</span>
                <button type="button" className={quiet} onClick={async () => { await resolveReport(r.id); onResolved?.(r.id); }}>Resolved</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && (
        <p role="status" className={`mb-4 rounded-2xl px-3 py-2 text-sm font-bold ${note.kind === "bad" ? "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200" : note.kind === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-surface-muted text-ink"}`}>
          {note.text}
          {note.kind === "bad" && source !== "offline" && (
            <button type="button" className="ml-2 underline" onClick={() => { setSource("offline"); void generate("offline"); }}>Use the offline drafter</button>
          )}
        </p>
      )}

      <section className={`bg-surface p-4 ${step === 3 ? "" : "rounded-3xl border border-line"}`}>
        {step === 1 && (
          <SourceStep
            input={input}
            categories={categories}
            isNew={isNew}
            source={source}
            onSource={setSource}
            onInput={(next) => {
              // A different story or language is a different book: the old draft no longer fits it.
              const storyChanged = next.text !== input.text || next.language !== input.language || next.band !== input.band;
              if (draft && storyChanged) {
                setDraft(null);
                setNote({ kind: "info", text: "The story changed, so the questions will be drafted again." });
              }
              // Changing only the requested counts is safe: keep the existing
              // questions and update the validation target without regenerating.
              if (draft && !storyChanged && next.questionCounts && (
                next.questionCounts.understand !== (input.questionCounts?.understand ?? 10) ||
                next.questionCounts.words !== (input.questionCounts?.words ?? 10) ||
                next.questionCounts.spell !== (input.questionCounts?.spell ?? 10)
              )) {
                setDraft({ ...draft, questionCounts: next.questionCounts });
                setDirty(true);
              }
              setInput(next);
            }}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <div className="grid gap-3">
            <p className="text-sm text-muted">
              {source === "offline"
                ? "The offline drafter builds “which word finishes this sentence?” questions from the story’s own words. No key, no network."
                : `${PROVIDERS.find((p) => p.id === source)?.name} is asked for ${input.questionCounts?.understand ?? 10} Understand, ${input.questionCounts?.words ?? 10} Words and ${input.questionCounts?.spell ?? 10} Spell questions. At least 85% in each section is needed to publish. The key stays on the server; the reply is checked before you see it and again on publish.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primary} disabled={busy !== "" || !input.text.trim()} onClick={() => void generate()}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {busy === "generate" ? "Drafting…" : draft ? "Draft again" : "Draft the questions"}
              </button>
              {draft && <button type="button" className={quiet} onClick={() => setStep(3)}>Review the current draft ›</button>}
            </div>
          </div>
        )}
        {step === 3 && draft && verdict && <ReviewStep draft={draft} verdict={verdict} confirmed={confirmed} onConfirmed={(c) => { setConfirmed(c); setDirty(true); }} onEdit={edit} />}
        {step === 4 && draft && <PagesStep draft={draft} onEdit={edit} />}
        {step === 5 && draft && <VoiceStep draft={draft} onEdit={edit} />}
        {step === 6 && draft && <BookPreview book={{ ...draft, id, rev: status.rev || 1 }} onExit={() => setStep(4)} />}
        {step === 7 && draft && verdict && (
          <PublishStep
            verdict={verdict}
            band={draft.band}
            counts={draft.questionCounts}
            km={km}
            confirmed={confirmed}
            status={status}
            busy={busy}
            onPublish={() => void publish()}
            onUnpublish={async () => {
              const out = await unpublishBook(id);
              setStatus({ rev: out.rev, published: false });
              setNote({ kind: "info", text: "Taken off the shelf. Devices drop it the next time they sync." });
              void BookStore.refresh();
            }}
            onDelete={row ? async () => {
              await deleteBook(id);
              onClose();
            } : undefined}
          />
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SourceStep({ input, categories, isNew, source, onSource, onInput, onNext }: {
  input: StoryInput; categories: readonly string[]; isNew: boolean; source: Source; onSource(s: Source): void; onInput(i: StoryInput): void; onNext(): void;
}) {
  const km = input.language === "km";
  const set = <K extends keyof StoryInput>(k: K, v: StoryInput[K]) => onInput({ ...input, [k]: v });
  return (
    <div className="grid gap-4">
      <fieldset>
        <legend className={label}>Who drafts the questions</legend>
        <div className="grid gap-2 sm:grid-cols-4" role="radiogroup">
          {PROVIDERS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={source === p.id} onClick={() => onSource(p.id)}
              className={`rounded-2xl border-2 px-3 py-2 text-left ${source === p.id ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60" : "border-line bg-surface"}`}>
              <b className="block text-ink">{p.name}</b>
              <span className="text-xs text-muted">{p.note}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={label}>Title</span>
          <input className={`${field} ${km ? KHMER : ""}`} value={input.title} onChange={(e) => set("title", e.target.value)} placeholder={km ? "ចំណងជើង" : "e.g. At the Market"} />
        </label>
        <label>
          <span className={label}>Book id {isNew ? "(from the title unless you set one)" : "(fixed)"}</span>
          <input className={`${field} font-mono`} value={isNew ? input.id : input.id} disabled={!isNew} onChange={(e) => set("id", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder={slug(input.title || "new book")} />
        </label>
        <div>
          <span className={label}>Language</span>
          <div className="flex gap-2">
            {(["en", "km"] as Language[]).map((l) => (
              <button key={l} type="button" aria-pressed={input.language === l} onClick={() => set("language", l)} className={`${input.language === l ? primary : quiet} ${l === "km" ? KHMER : ""}`}>{l === "en" ? "English" : "ភាសាខ្មែរ"}</button>
            ))}
          </div>
        </div>
        <div>
          <span className={label}>Age band</span>
          <div className="flex gap-2">
            {(Object.keys(BANDS) as Band[]).map((b) => (
              <button key={b} type="button" aria-pressed={input.band === b} onClick={() => onInput({ ...input, band: b, questionCounts: { ...BANDS[b] } })} className={input.band === b ? primary : quiet}>{`${b} · ${BANDS[b].ages[0]}–${BANDS[b].ages[1]}`}</button>
            ))}
          </div>
        </div>
        <fieldset className="sm:col-span-2 rounded-2xl border border-line bg-surface-muted p-3">
          <legend className={`${label} px-1`}>Question target before generating</legend>
          <p className="mb-2 text-xs text-muted">Set each section’s target from 1–10. At least 85% is required to publish.</p>
          <div className="grid grid-cols-3 gap-2">
            {(["understand", "words", "spell"] as const).map((kind) => (
              <label key={kind}>
                <span className="mb-1 block text-xs font-bold capitalize text-muted">{kind === "understand" ? "Understand" : kind === "words" ? "Words" : "Spell"}</span>
                <input className={field} type="number" min={1} max={10} value={input.questionCounts?.[kind] ?? 10} onChange={(e) => set("questionCounts", { ...(input.questionCounts ?? BANDS[input.band]), [kind]: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          <span className={label}>Shelf</span>
          <select className={field} value={input.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">No shelf yet</option>
            {/* The server's list; a book's own shelf stays choosable even if the list has moved on. */}
            {[...new Set([...categories, ...(input.category ? [input.category] : [])])].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <label>
        <span className={label}>Story — write it or paste it</span>
        <textarea className={`${field} min-h-40 ${km ? `${KHMER} text-lg leading-loose` : ""}`} value={input.text} lang={input.language} onChange={(e) => set("text", e.target.value)}
          placeholder={km ? "One sentence after another. Khmer has no spaces — type one wherever two words must break." : "One sentence after another."} />
      </label>
      <div>
        <button type="button" className={primary} disabled={!input.text.trim() || !input.title.trim()} onClick={onNext}>Continue ›</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ReviewStep({ draft, verdict, confirmed, onConfirmed, onEdit }: {
  draft: Draft; verdict: Verdict; confirmed: boolean; onConfirmed(c: boolean): void; onEdit(d: Draft): void;
}) {
  const km = draft.language === "km";
  const need = draft.questionCounts ?? BANDS[draft.band];
  const [tab, setTab] = useState<"splits" | "understand" | "words" | "spell">("splits");
  const [addMessage, setAddMessage] = useState("");
  const byQ = (id: string) => verdict.checks.filter((c) => c.question === id);
  const setQ = (id: string, patch: Partial<Question>) => onEdit({ ...draft, questions: draft.questions.map((q) => (q.id === id ? ({ ...q, ...patch } as Question) : q)) });
  const del = (id: string) => onEdit({ ...draft, questions: draft.questions.filter((q) => q.id !== id) });
  const nextId = (prefix: string) => {
    let n = 1;
    while (draft.questions.some((q) => q.id === `${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  };
  const storyPics = new Set(Object.values(draft.pictures));
  const picWords = [...new Set(draft.sentences.flatMap((s) => s.words.map(core)).filter((w) => w && pictureFor(w, draft.language, PICTURE_KEYS)))];

  const add = (kind: Question["kind"]) => {
    setAddMessage("");
    if (count(kind) >= need[kind === "comprehension" ? "understand" : kind === "vocab" ? "words" : "spell"]) {
      setAddMessage("This section already has its requested number of questions.");
      return;
    }
    const s = draft.sentences[0];
    if (kind === "comprehension") onEdit({ ...draft, questions: [...draft.questions, { id: nextId("q"), kind, prompt: "", options: ["", "", ""], answer: 0, evidence: s.id }] });
    if (kind === "spell") {
      const w = core(s.words.find((t) => core(t).length >= 3) ?? s.words[0]);
      onEdit({ ...draft, questions: [...draft.questions, { id: nextId("sp"), kind, sentence: s.id, word: km ? w : w.toLowerCase() }] });
    }
    if (kind === "vocab") {
      const w = picWords.find((x) => !draft.questions.some((q) => q.kind === "vocab" && q.word === (km ? x : x.toLowerCase())));
      if (!w) {
        setAddMessage("No unused story word has a matching picture. Add another picture word to the story or lower the Words target.");
        return;
      }
      const word = km ? w : w.toLowerCase();
      const pic = pictureFor(w, draft.language, PICTURE_KEYS)!;
      const q = vocabQuestion(nextId("q"), word, pic, draft.language, PICTURE_KEYS, storyPics);
      if (q) onEdit({ ...draft, pictures: { ...draft.pictures, [word]: pic }, questions: [...draft.questions, q] });
      else setAddMessage("This word does not have enough different pictures for a question.");
    }
  };

  const count = (k: Question["kind"]) => draft.questions.filter((q) => q.kind === k).length;
  const strip: Array<[string, number, number]> = [["Understand", count("comprehension"), need.understand], ["Words", count("vocab"), need.words], ["Spell", count("spell"), need.spell]];
  const tabKind: Record<Exclude<typeof tab, "splits">, Question["kind"]> = { understand: "comprehension", words: "vocab", spell: "spell" };
  const activeQuestions = tab === "splits" ? [] : draft.questions.filter((q) => q.kind === tabKind[tab]);
  const [splitTarget, setSplitTarget] = useState<{ sid: string; index: number } | null>(null);
  const [splitText, setSplitText] = useState("");
  const tabItems: UITabItem<typeof tab>[] = [
    { id: "splits", label: "Content" },
    ...strip.map(([name, have, want], index) => {
      const key = (["understand", "words", "spell"] as const)[index];
      const passing = have >= minimumQuestions(want) && have <= want;
      return { id: key, label: `${passing ? "✓" : "✕"} ${name}`, count: `${have}/${want}` };
    }),
  ];
  const applySplit = (sid: string, index: number) => {
    const pieces = splitText.trim().split(/[\s\u200B]+/u).filter(Boolean);
    if (pieces.length < 2) return;
    onEdit({
      ...draft,
      sentences: draft.sentences.map((sentence) => {
        if (sentence.id !== sid) return sentence;
        const words = [...sentence.words.slice(0, index), ...pieces, ...sentence.words.slice(index + 1)];
        return {
          ...sentence,
          words,
          text: words.join(draft.language === "km" ? "" : " "),
          // The approved split changed, so the old timings no longer map.
          audioCues: undefined,
        };
      }),
    });
    setSplitTarget(null);
    setSplitText("");
    if (km) onConfirmed(false);
  };

  return (
    <div className="grid gap-4">
      <UITabs items={tabItems} value={tab} onChange={setTab} label="Review sections" />

      <p className="text-sm text-muted">To publish, reach at least 85% in each group: Understand {minimumQuestions(need.understand)}, Words {minimumQuestions(need.words)}, and Spell {minimumQuestions(need.spell)}.</p>

      {tab === "splits" && <details open={km} className="rounded-2xl border border-line p-3">
        <summary className="cursor-pointer font-extrabold text-ink">Word splits {km ? "— check every one, then confirm" : "(English splits on spaces)"}</summary>
        <p className="mt-2 text-sm text-muted">Tap a word to join it to the next one. Use the scissors to split a word. Use ⌐ to join a line to the one above.</p>
        {draft.sentences.map((s, si) => (
          <div key={s.id} className="mt-2 flex gap-2">
            <b className="w-8 shrink-0 pt-2 font-mono text-xs text-muted">{s.id}</b>
            {si > 0 && (
              <button type="button" aria-label={`Join ${s.id} to ${draft.sentences[si - 1].id}`} title={`Join ${s.id} to ${draft.sentences[si - 1].id}`}
                onClick={() => {
                  onEdit(joinSentences(draft, s.id));
                  if (km) onConfirmed(false);
                }}
                className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center self-start rounded-lg border border-line text-muted transition-colors hover:border-indigo-400 hover:text-ink">
                <CornerLeftUp className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <div className="flex flex-wrap gap-1.5">
              {s.words.map((w, i) => (
                <div key={i} className="flex items-center gap-1">
                  <button type="button" disabled={i === s.words.length - 1} title={i === s.words.length - 1 ? "Last word" : "Join with the next word"} onClick={() => {
                    onEdit({ ...draft, sentences: draft.sentences.map((x) => (x.id === s.id ? mergeWords(x, i, draft.language) : x)) });
                    if (km) onConfirmed(false);
                  }} className={`rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100 ${km ? `${KHMER} text-lg` : ""}`}>
                    {w}
                  </button>
                  <button type="button" aria-label={`Split ${s.id} word ${i + 1}`} title="Split this word" onClick={() => { setSplitTarget({ sid: s.id, index: i }); setSplitText(w); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300">
                    <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            {splitTarget?.sid === s.id && (
              <div className="mt-2 basis-full rounded-xl border border-indigo-200 bg-indigo-50 p-2 dark:border-indigo-800 dark:bg-indigo-950/50">
                <label className="block text-sm font-semibold text-ink">
                  Split this word with spaces
                  <UIInput autoFocus className={`mt-1 ${km ? KHMER : ""}`} value={splitText} onChange={(e) => setSplitText(e.target.value)} />
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={primary} disabled={splitText.trim().split(/[\s\u200B]+/u).filter(Boolean).length < 2} onClick={() => applySplit(s.id, splitTarget.index)}>Apply split</button>
                  <button type="button" className={quiet} onClick={() => { setSplitTarget(null); setSplitText(""); }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {km && (
          <label className="mt-3 flex items-center gap-2 font-bold text-ink">
            <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={confirmed} onChange={(e) => onConfirmed(e.target.checked)} />
            A Khmer reader has checked the text and every split
          </label>
        )}
      </details>}

      {activeQuestions.map((q) => (
        <QuestionCard key={q.id} q={q} draft={draft} checks={byQ(q.id)} picWords={picWords} onChange={(patch) => setQ(q.id, patch)} onPictures={(pictures, patch) => onEdit({ ...draft, pictures, questions: draft.questions.map((x) => (x.id === q.id ? ({ ...x, ...patch } as Question) : x)) })} onDelete={() => del(q.id)} />
      ))}

      {tab !== "splits" && <div className="flex flex-wrap items-center gap-2">
        <span className={label}>Add</span>
        <button type="button" className={quiet} onClick={() => add(tabKind[tab])}><Plus className="h-4 w-4" aria-hidden="true" />{tab === "understand" ? "Understand" : tab === "words" ? "Words" : "Spell"}</button>
        {addMessage && <p role="status" className="basis-full text-sm font-semibold text-rose-700 dark:text-rose-300">{addMessage}</p>}
      </div>}

      <RuleList verdict={verdict} />
    </div>
  );
}

function CheckLines({ checks }: { checks: Verdict["checks"] }) {
  return (
    <ul className="mt-2 grid gap-0.5 text-xs">
      {checks.map((c, i) => (
        <li key={i} className={c.status === "fail" ? "font-bold text-rose-700 dark:text-rose-400" : c.status === "pass" ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}>
          {c.status === "fail" ? "✕" : c.status === "pass" ? "✓" : "ⓘ"} {c.message}
        </li>
      ))}
    </ul>
  );
}

function QuestionCard({ q, draft, checks, picWords, onChange, onPictures, onDelete }: {
  q: Question; draft: Draft; checks: Verdict["checks"]; picWords: string[];
  onChange(patch: Partial<Question>): void; onPictures(pictures: Record<string, string>, patch: Partial<VocabQuestion>): void; onDelete(): void;
}) {
  const km = draft.language === "km";
  const failing = checks.some((c) => c.status === "fail");
  const tag = q.kind === "comprehension" ? "Understand" : q.kind === "vocab" ? "Words" : "Spell";
  const collapsible = true;
  const [expanded, setExpanded] = useState(true);
  const [correcting, setCorrecting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ question: Question; explanation: string } | null>(null);
  const suggestedComprehension = suggestion?.question.kind === "comprehension" ? suggestion.question : null;
  /** Which of a Words question's three pictures is being changed, if any. */
  const [editing, setEditing] = useState<number | null>(null);
  const correctWithAi = async () => {
    setCorrecting(true);
    try {
      const result = await requestAiCorrection({ language: draft.language, band: draft.band, sentences: draft.sentences.map((s) => s.text), question: q, checks: checks.map((c) => ({ message: c.message, status: c.status })), easyWords: readingWordsFor(draft.band, draft.language) });
      const corrected = correctedQuestion(result.question, q);
      if (!corrected) throw new Error("The AI returned a correction in the wrong format.");
      setSuggestion({ question: corrected, explanation: result.explanation });
    } catch (error) {
      setSuggestion({ question: q, explanation: error instanceof Error ? error.message : "The AI correction failed. Try again." });
    } finally {
      setCorrecting(false);
    }
  };
  return (
    <div className={`rounded-2xl border p-3 ${failing ? "border-rose-300 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/40" : "border-line"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 text-xs font-black uppercase tracking-wider text-muted">
          {collapsible && (
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${tag} ${q.id}`}
              aria-expanded={expanded}
              title={expanded ? "Collapse question" : "Expand question"}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
          <span>{q.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950" onClick={() => void correctWithAi()} disabled={correcting} aria-label={correcting ? "Checking with AI" : "AI correction"} title={correcting ? "Checking with AI" : "AI correction"}>
            <Sparkles className={`h-4 w-4 ${correcting ? "animate-pulse" : ""}`} aria-hidden="true" />
          </button>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={onDelete} aria-label={`Delete ${tag} ${q.id}`} title={`Delete ${tag} ${q.id}`}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {(!collapsible || expanded) && <>
        {q.kind === "comprehension" && <ComprehensionFields q={q} draft={draft} onChange={onChange} km={km} />}
        {q.kind === "vocab" && (
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
          <label>
            <span className={label}>Word from the story</span>
            <UISelect className={km ? KHMER : ""} value={q.word} onChange={(e) => {
              const word = e.target.value;
              const pic = pictureFor(word, draft.language, PICTURE_KEYS) ?? q.options[q.answer];
              const next = vocabQuestion(q.id, word, pic, draft.language, PICTURE_KEYS, new Set(Object.values(draft.pictures)));
              if (next) onPictures({ ...draft.pictures, [word]: pic }, next);
            }}>
              {[...new Set([q.word, ...picWords.map((w) => (km ? w : w.toLowerCase()))])].map((w) => <option key={w}>{w}</option>)}
            </UISelect>
          </label>
          <div>
            <span className={label}>Pictures shown — the green one is right. Tap one to change it.</span>
            <div className="flex gap-2">
              {q.options.map((o, i) => (
                <button key={i} type="button" onClick={() => setEditing(i)}
                  aria-label={i === q.answer ? `Change the right picture, ${o}` : `Change wrong picture ${i + 1}, ${o}`} title={o}
                  className={`h-16 w-20 overflow-hidden rounded-xl border-2 p-1 transition-colors ${i === q.answer ? "border-emerald-600 hover:border-emerald-500" : "border-line hover:border-indigo-400"}`}>
                  <Picture name={o} />
                </button>
              ))}
            </div>
          </div>
        </div>
        )}
        {q.kind === "spell" && <SpellFields q={q} draft={draft} onChange={onChange} km={km} />}

        {q.kind === "vocab" && editing !== null && (
        <PicturePanel
          title={editing === q.answer ? `Picture for “${q.word}”` : `Wrong picture for “${q.word}”`}
          note={editing === q.answer
            ? `This is the picture for “${q.word}” everywhere in this book — a page left on Automatic, and the word when a child taps it.`
            : "A picture that is not the answer. It should be the same kind of thing, so the right one still has to be read for."}
          chosen={q.options[editing]}
          how="chosen"
          // Only the right answer's picture is the word — naming it for a wrong
          // slot would draw the very thing that slot must not be.
          promptSeed={editing === q.answer ? `A single, clearly recognisable picture of “${q.word}” — one plain object, centred, no background scene.` : undefined}
          suggested={[...new Set([pictureFor(q.word, draft.language, PICTURE_KEYS), ...q.options])].filter((k): k is string => !!k)}
          suggestedLabel="This question’s pictures"
          photos={photosOf(draft)}
          allowNone={false}
          at={null}
          onPlace={() => undefined}
          onChoose={(key) => {
            if (!key) return;
            const next = withVocabPicture(q, draft.pictures, draft.language, editing, key);
            onPictures(next.pictures, next.question);
          }}
          onClose={() => setEditing(null)}
        />
        )}
      {suggestion && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100">
          <p><b>AI says:</b> {suggestion.explanation}</p>
          {suggestedComprehension && <>
            <p className="mt-1">Suggested choices: {suggestedComprehension.options.map((option, index) => <b key={index} className="mr-2 inline-block">{index === suggestedComprehension.answer ? "✓ " : ""}{option}</b>)}</p>
            <p className="mt-1">Suggested answer: <b>{suggestedComprehension.options[suggestedComprehension.answer]}</b> · evidence: {suggestedComprehension.evidence}</p>
          </>}
          {suggestion.question.kind === "vocab" && <p className="mt-1">Suggested word: <b>{suggestion.question.word}</b> · picture: {suggestion.question.options[suggestion.question.answer]}</p>}
          {suggestion.question.kind === "spell" && <p className="mt-1">Suggested spelling word: <b>{suggestion.question.word}</b> · sentence: {suggestion.question.sentence}</p>}
          {JSON.stringify(suggestion.question) === JSON.stringify(q) && <p className="mt-2 font-bold text-rose-700 dark:text-rose-300">The AI did not change this question. Try AI correction again.</p>}
          {JSON.stringify(suggestion.question) !== JSON.stringify(q) && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={primary} onClick={() => { onChange(suggestion.question); setSuggestion(null); }}>Apply correction</button>
              <button type="button" className={quiet} onClick={() => setSuggestion(null)}>Keep current</button>
            </div>
          )}
        </div>
      )}
      <CheckLines checks={checks} />
      </>}
    </div>
  );
}

function correctedQuestion(value: unknown, current: Question): Question | null {
  if (!value || typeof value !== "object") return null;
  const next = value as Record<string, unknown>;
  if (next.id !== current.id || next.kind !== current.kind) return null;
  if (current.kind === "comprehension" && Array.isArray(next.options) && next.options.length === CHOICES && typeof next.prompt === "string" && typeof next.evidence === "string" && Number.isInteger(next.answer)) return next as unknown as Question;
  if (current.kind === "vocab" && Array.isArray(next.options) && next.options.length === CHOICES && typeof next.word === "string" && Number.isInteger(next.answer)) return next as unknown as Question;
  if (current.kind === "spell" && typeof next.sentence === "string" && typeof next.word === "string") return next as unknown as Question;
  return null;
}

function ComprehensionFields({ q, draft, onChange, km }: { q: ComprehensionQuestion; draft: Draft; onChange(p: Partial<ComprehensionQuestion>): void; km: boolean }) {
  return (
    <div className="grid gap-2">
      <label>
        <span className={label}>Question</span>
        <UIInput className={km ? KHMER : ""} value={q.prompt} onChange={(e) => onChange({ prompt: e.target.value })} />
      </label>
      <fieldset>
        <legend className={label}>Choices — mark the right one</legend>
        <div className="grid gap-2">
          {q.options.slice(0, CHOICES).map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <UIRadio name={`ans-${q.id}`} checked={q.answer === i} onChange={() => onChange({ answer: i })} aria-label={`Choice ${i + 1} is right`} />
              <UIInput className={km ? KHMER : ""} value={o} aria-label={`Choice ${i + 1}`} onChange={(e) => onChange({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })} />
            </div>
          ))}
        </div>
      </fieldset>
      <label>
        <span className={label}>Evidence — the sentence that proves the answer</span>
        <UISelect className={km ? KHMER : ""} value={q.evidence} onChange={(e) => onChange({ evidence: e.target.value })}>
          {draft.sentences.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.text.slice(0, 70)}</option>)}
        </UISelect>
      </label>
    </div>
  );
}

function SpellFields({ q, draft, onChange, km }: { q: SpellQuestion; draft: Draft; onChange(p: Partial<SpellQuestion>): void; km: boolean }) {
  const s = draft.sentences.find((x) => x.id === q.sentence);
  const words = s ? [...new Set(s.words.map(core).filter(Boolean))] : [];
  const g = s ? gapOf(s, q.word, draft.language) : null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label>
        <span className={label}>Sentence</span>
        <UISelect className={km ? KHMER : ""} value={q.sentence} onChange={(e) => {
          const next = draft.sentences.find((x) => x.id === e.target.value)!;
          const w = core(next.words.find((t) => core(t).length >= 3) ?? next.words[0]);
          onChange({ sentence: next.id, word: km ? w : w.toLowerCase() });
        }}>
          {draft.sentences.map((x) => <option key={x.id} value={x.id}>{x.id} · {x.text.slice(0, 60)}</option>)}
        </UISelect>
      </label>
      <label>
        <span className={label}>Word to spell</span>
        <UISelect className={km ? KHMER : ""} value={words.find((w) => w.toLowerCase() === q.word.toLowerCase()) ?? q.word} onChange={(e) => onChange({ word: km ? e.target.value : e.target.value.toLowerCase() })}>
          {[...new Set([q.word, ...words])].map((w) => <option key={w} value={w}>{w}</option>)}
        </UISelect>
      </label>
      <p className={`rounded-xl bg-surface-muted px-3 py-2 text-ink sm:col-span-2 ${km ? `${KHMER} text-lg` : ""}`}>{g ? g.text : "That word is not in this sentence."}</p>
      {km && !whyUnspellable(q.word, "km") && <SpellLevel word={q.word} band={draft.band} />}
    </div>
  );
}

/** A Khmer spelling word's level and its units by name, so an author sees what a child will be asked. */
function SpellLevel({ word, band }: { word: string; band: Band }) {
  const units = tilesOf(word, "km");
  const level = spellingLevel(units);
  const over = level > BAND_LEVEL_CAP[band];
  return (
    <p className={`rounded-xl px-3 py-2 text-sm sm:col-span-2 ${over ? "bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-100" : "bg-surface-muted text-ink"}`}>
      <b>Spelling level {level}</b> · {LEVEL_NAME[level]}
      {over && ` — above level ${BAND_LEVEL_CAP[band]}, the usual limit for band ${band}`}
      <span className={`mt-1 block ${KHMER} text-base`}>{units.map(unitCue).join(" · ")}</span>
    </p>
  );
}

function RuleList({ verdict }: { verdict: Verdict }) {
  const rules = (Object.keys(RULES) as unknown as Array<keyof typeof RULES>).map((k) => {
    const n = Number(k) as keyof typeof RULES;
    const list = verdict.checks.filter((c) => c.rule === n);
    const bad = list.some((c) => c.status === "fail");
    const skip = list.some((c) => c.status === "skipped");
    return { n, title: RULES[n].title, status: bad ? "fail" : skip ? "skipped" : "pass" };
  });
  const zero = verdict.checks.filter((c) => c.rule === 0 && c.status === "fail");
  return (
    <div className="rounded-2xl border border-line p-3">
      <h3 className="mb-2 font-extrabold text-ink">The eight checks</h3>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {rules.map((r) => (
          <li key={r.n} className={r.status === "fail" ? "font-bold text-rose-700 dark:text-rose-400" : r.status === "pass" ? "text-ink" : "text-muted"}>
            {r.status === "fail" ? "✕" : r.status === "pass" ? "✓" : "ⓘ"} {r.n} · {r.title}{r.status === "skipped" ? " — not run yet" : ""}
          </li>
        ))}
      </ul>
      {zero.length > 0 && <p className="mt-2 text-sm font-bold text-rose-700 dark:text-rose-400">The book itself is malformed: {zero.map((c) => `${c.question}: ${c.message}`).join(" · ")}</p>}
    </div>
  );
}


/* -------------------------------------------------------------------------- */
/* Voice — optional                                                            */
/* -------------------------------------------------------------------------- */

type VoiceCharacterId = "lila" | "milo" | "zara" | "ari";

const VOICE_CHARACTER_KEY = "koda_library_voice_character_v1";
const VOICE_CHARACTERS: ReadonlyArray<{ id: VoiceCharacterId; name: string; tone: string; initial: string }> = [
  { id: "lila", name: "Lila", tone: "Youthful & gentle", initial: "L" },
  { id: "milo", name: "Milo", tone: "Playful & upbeat", initial: "M" },
  { id: "zara", name: "Zara", tone: "Bright & curious", initial: "Z" },
  { id: "ari", name: "Ari", tone: "Warm & friendly", initial: "A" },
];

function rememberedVoiceCharacter(): VoiceCharacterId {
  try {
    const saved = localStorage.getItem(VOICE_CHARACTER_KEY);
    return VOICE_CHARACTERS.some((character) => character.id === saved) ? saved as VoiceCharacterId : "lila";
  } catch {
    return "lila";
  }
}

/** Ask the library's voice route to read a line. Throws the server's own reason when it will not. */
async function geminiVoice(text: string, words: string[], language: Language, character: VoiceCharacterId): Promise<{ blob: Blob; cues: WordCue[] }> {
  const res = await fetch("/api/library/voice", { method: "POST", headers: await tutorHeaders(), body: JSON.stringify({ text, words, language, character }) });
  const body = (await res.json().catch(() => null)) as { audio?: string; cues?: WordCue[]; error?: { message?: string } } | null;
  if (!res.ok || !body?.audio) throw new Error(body?.error?.message ?? "Gemini voice could not be reached. Record your own voice instead.");
  return { blob: pcmToWav(body.audio), cues: body.cues ?? [] };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


function VoiceStep({ draft, onEdit }: { draft: Draft; onEdit(d: Draft): void }) {
  const km = draft.language === "km";
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const recorder = useRecorder();
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [voiceCharacter, setVoiceCharacter] = useState<VoiceCharacterId>(rememberedVoiceCharacter);
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  const recorded = draft.sentences.filter((s) => s.audio).length;
  const clipIds = [...new Set(draft.sentences.flatMap((s) => s.audio ? [s.audio] : []))];
  const clipKey = clipIds.join(",");
  const totalBytes = clipIds.reduce((total, id) => total + (sizes[id] ?? 0), 0);
  const sizesReady = clipIds.every((id) => sizes[id] !== undefined);
  const selectedVoiceCharacter = VOICE_CHARACTERS.find((character) => character.id === voiceCharacter) ?? VOICE_CHARACTERS[0];

  const chooseVoiceCharacter = (character: VoiceCharacterId) => {
    setVoiceCharacter(character);
    try {
      localStorage.setItem(VOICE_CHARACTER_KEY, character);
    } catch {
      /* Remembering an authoring preference is optional. */
    }
  };

  useEffect(() => {
    let live = true;
    void clipSizes(clipIds).then((got) => {
      if (live) setSizes((current) => ({ ...current, ...got }));
    });
    return () => { live = false; };
  }, [clipKey]);

  const attach = async (sid: string, blob: Blob, cues?: WordCue[]) => {
    const clip = await uploadClip(blob);
    setSizes((current) => ({ ...current, [clip.id]: clip.bytes }));
    onEdit({
      ...draft,
      sentences: draft.sentences.map((s) =>
        s.id === sid ? { ...s, audio: clip.id, audioCues: cues?.length === s.words.length ? cues : undefined } : s,
      ),
    });
    return clip.id;
  };
  const run = async (key: string, job: () => Promise<unknown>) => {
    setBusy(key);
    setErr("");
    try {
      await job();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  };
  const allByAi = () =>
    run("all", async () => {
      let next = draft;
      for (const s of draft.sentences) {
        if (s.audio) continue;
        const generated = await geminiVoice(s.text, s.words, draft.language, voiceCharacter);
        const clip = await uploadClip(generated.blob);
        setSizes((current) => ({ ...current, [clip.id]: clip.bytes }));
        next = {
          ...next,
          sentences: next.sentences.map((x) =>
            x.id === s.id
              ? { ...x, audio: clip.id, audioCues: generated.cues.length === x.words.length ? generated.cues : undefined }
              : x,
          ),
        };
        onEdit(next);
      }
    });

  const downloadRecording = (sentence: Draft["sentences"][number]) =>
    run(`download:${sentence.id}`, async () => {
      if (!sentence.audio) return;
      const url = await clipUrl(sentence.audio);
      if (!url) throw new Error("This recording is not available to download.");
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug(draft.title || draft.id)}-${sentence.id}.m4a`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    });

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">
        Choose a recorded or Gemini voice for each sentence. Saved audio works online or offline. Read appears only when every sentence has audio.
      </p>
      <fieldset className="rounded-2xl border border-line bg-surface p-3">
        <legend className="koda-admin-card-title px-1">Choose a Gemini reader</legend>
        <p className="koda-admin-label mb-3 px-1">This character is used for each Gemini clip you generate.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {VOICE_CHARACTERS.map((character) => {
            const selected = character.id === voiceCharacter;
            return (
              <label
                key={character.id}
                className={`flex min-h-16 cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 transition-colors ${selected ? "border-[#534AB7] bg-[#F1EFFF] text-[#0E0B55]" : "border-line bg-surface text-ink hover:border-[#7C6DD8]"} ${busy !== null ? "cursor-not-allowed opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="gemini-reader"
                  value={character.id}
                  checked={selected}
                  disabled={busy !== null}
                  onChange={() => chooseVoiceCharacter(character.id)}
                  className="sr-only"
                />
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${selected ? "bg-[#534AB7] text-white" : "bg-surface-muted text-muted"}`} aria-hidden="true">
                  {character.initial}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{character.name}</span>
                  <span className="koda-admin-chip block text-muted">{character.tone}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-black text-ink">{recorded} of {draft.sentences.length} recorded</span>
        {recorded > 0 && sizesReady && <span className="text-sm font-bold text-muted">{formatBytes(totalBytes)} stored</span>}
        <button type="button" className={quiet} disabled={busy !== null || recorded === draft.sentences.length} onClick={() => void allByAi()}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {busy === "all" ? "Generating…" : `${selectedVoiceCharacter.name} voice for the rest`}
        </button>
      </div>
      {err && <p role="alert" className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{err}</p>}
      <ol className="grid gap-2">
        {draft.sentences.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line px-3 py-2">
            <b className="w-8 font-mono text-xs text-muted">{s.id}</b>
            <span className={`min-w-40 flex-1 text-ink ${km ? `${KHMER} text-lg` : ""}`}>{s.text}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-black ${s.audio ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-surface-muted text-muted"}`}>{s.audio ? `recorded${sizes[s.audio] !== undefined ? ` · ${formatBytes(sizes[s.audio])}` : ""}` : "not recorded"}</span>
            {s.audio && (
              <button type="button" className={quiet} aria-label={`Play ${s.id}`} onClick={() => { stop(); void say(s.text, draft.language, s.audio); }}>
                <Play className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {s.audio && (
              <button type="button" className={quiet} disabled={busy !== null} aria-label={`Download the recording of ${s.id}`} title="Download M4A" onClick={() => void downloadRecording(s)}>
                <Download className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {canRecord && (recorder.recording === s.id ? (
              <button type="button" className={`${btn} bg-rose-600 text-white`} onClick={recorder.stop}>
                <Square className="h-4 w-4" aria-hidden="true" />Stop
              </button>
            ) : (
              <button type="button" className={quiet} disabled={busy !== null || recorder.recording !== null} aria-label={`Record ${s.id}`}
                onClick={() => void run(s.id, () => recorder.start(s.id, (blob) => void run(s.id, () => attach(s.id, blob))))}>
                <Mic className="h-4 w-4" aria-hidden="true" />{s.audio ? "Re-record" : "Record"}
              </button>
            ))}
            <button type="button" className={quiet} disabled={busy !== null} aria-label={`Gemini voice for ${s.id}`} onClick={() => void run(s.id, async () => {
              const generated = await geminiVoice(s.text, s.words, draft.language, voiceCharacter);
              await attach(s.id, generated.blob, generated.cues);
            })}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />{busy === s.id ? "…" : selectedVoiceCharacter.name}
            </button>
            {s.audio && (
              <button type="button" className={quiet} aria-label={`Remove the recording of ${s.id}`} onClick={() => onEdit({ ...draft, sentences: draft.sentences.map((x) => (x.id === s.id ? { ...x, audio: undefined, audioCues: undefined } : x)) })}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ol>
      {!canRecord && <p className="text-xs text-muted">This browser cannot record from a microphone.</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PublishStep({ verdict, band, counts, km, confirmed, status, busy, onPublish, onUnpublish, onDelete }: {
  verdict: Verdict; band: Band; counts?: QuestionCounts; km: boolean; confirmed: boolean; status: { rev: number; published: boolean }; busy: string;
  onPublish(): void; onUnpublish(): void; onDelete?: () => void;
}) {
  /*
   * Which count is wrong, and by how much. "The question counts do not match
   * the band" left an author to go and work out for themselves which of three
   * numbers was off, on a different step.
   */
  const need = counts ?? BANDS[band];
  const off = ([
    ["Understand", verdict.counts.comprehension, need.understand],
    ["Words", verdict.counts.vocab, need.words],
    ["Spell", verdict.counts.spell, need.spell],
  ] as const)
    .filter(([, has, wants]) => has < minimumQuestions(wants) || has > wants)
    .map(([name, has, wants]) => `${name} ${has}/${wants} — ${has > wants ? `delete ${has - wants}` : `add ${minimumQuestions(wants) - has}`}`);

  const reasons = [
    verdict.failures > 0 ? `${verdict.failures} check${verdict.failures === 1 ? "" : "s"} failing — see Review` : "",
    off.length ? `band ${band} needs at least 85% in each section: ${off.join(", ")}` : "",
    km && !confirmed ? "the Khmer word splits are not confirmed" : "",
  ].filter(Boolean);
  const ready = reasons.length === 0;
  const [sure, setSure] = useState(false);
  return (
    <div className="grid max-w-4xl gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">Publish revision {status.rev + 1}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">This saves the story, questions, and recordings as a new revision. Children already reading finish the revision they started. Missing recordings use the device voice.</p>
      </div>
      {!ready && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">Not ready: {reasons.join(" · ")}.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={`${btn} bg-emerald-600 text-white hover:bg-emerald-700`} disabled={!ready || busy !== ""} onClick={onPublish}>
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          {busy === "publish" ? "Publishing…" : "Publish revision"}
        </button>
        {status.published && (
          <button type="button" className={quiet} onClick={onUnpublish}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Remove from shelf
          </button>
        )}
        {onDelete && (sure ? (
          <button type="button" className={`${btn} bg-rose-600 text-white`} onClick={onDelete}>Yes, delete this book</button>
        ) : (
          <button type="button" className={quiet} onClick={() => setSure(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        ))}
      </div>
    </div>
  );
}

export default LibraryStudio;
