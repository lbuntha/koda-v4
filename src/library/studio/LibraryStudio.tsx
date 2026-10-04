import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, BookOpen, Check, ChevronDown, ChevronRight, ChevronUp, CornerLeftUp, Download, Mic, Play, Pencil, Plus, RefreshCw, Sparkles, Square, Trash2, Upload } from "lucide-react";
import { BANDS, CHOICES, MATCH_MAX_QUESTIONS, meetsTarget, minimumQuestions, TARGET_MAX, type Band, type Language, type Question, type QuestionCounts, type WordCue } from "../data/passage";
import { readingLexiconFor, readingWordsFor } from "../data/readingLexicon";
import { core } from "../data/text";
import { RULES, verifyPassage, type Verdict } from "../data/verifyPassage";
import { deleteBook, fetchDraft, fetchReports, fetchStudioMeta, publishBook, requestAiCorrection, requestAiDraft, requestAiMatch, requestAiStory, resolveReport, saveDraft, unpublishBook, type BookReport, type BookRow, type BookSummary, type Provider, type StudioMeta } from "../api";
import { baseOf, draftLocally, fromModel, withStoryPictures, joinSentences, mergeWords, pictureFor, sentenceIdFor, withVocabWord, type StoryInput, type VocabEdit } from "../draft";
import { BookPreview } from "../LibraryPage";
import { PagesStep } from "./PagesStep";
import { UnitNamesPanel } from "./UnitNamesPanel";
import { StudioHome } from "./StudioHome";
import { useRecorder } from "./recorder";
import { WordVoicePanel } from "./WordVoicePanel";
import { KHMER, label, type Draft } from "./questions/shared";
import { UnderstandFields } from "./questions/UnderstandFields";
import { MatchFields, blankMatch, matchPrompt } from "./questions/MatchFields";
import { NewWordFields, WordsFields } from "./questions/WordsFields";
import { SpellFields } from "./questions/SpellFields";
import { WordNotesFields } from "./questions/WordNotesFields";
import { SectionEmpty, SectionHeader } from "./questions/SectionHeader";
import { OPENAI_VOICES, fetchVoxVoices, openaiVoice, orderedFor, voxVoice, type VoxVoice } from "../voxApi";
import { PICTURE_KEYS } from "../Picture";
import { BookStore } from "../bookStore";
import { clipSizes, clipUrl, pcmToWav, uploadClip } from "../clips";
import { isPhoto, photoSizes, photoDimensions } from "../photos";
import { layoutBook, pagePicture } from "../bookLayout";
import { say, stop } from "../voice";
import { tutorHeaders } from "../../lib/tutorApi";
import { aiDefault } from "../../lib/aiDefaults";
import { ScoringAPI } from "../../lib/scoring";
import { UIBadge, UIButton, UICard, UIFlashMessage, UIInput, UISelect, UIStepper, UITabs, UITextarea, type UITabItem } from "../../components/ui";
import { themeSystem } from "../../lib/themeSystem";
import "../khmerFont";
import { translate, useT } from "../../lib/i18n";

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
type Source = Provider | "offline";

/* Worded under `studio.step.<id>`. */
const STEPS = ["source", "review", "pages", "voice", "preview", "summary", "publish"] as const;
/** The admin's default drafter, in this screen's names for the three companies. */
const libraryDefault = (): Source => ({ gemini: "gemini", openai: "chatgpt", claude: "claude" } as const)[aiDefault("ai.libraryProvider")];
const PROVIDERS: Array<{ id: Source; name: string; note: string }> = [
  { id: "gemini", name: "Gemini", note: "Google" },
  { id: "chatgpt", name: "ChatGPT", note: "OpenAI" },
  { id: "claude", name: "Claude", note: "Anthropic" },
  { id: "offline", name: "Offline drafter", note: "no key · questions from the story’s own words" },
];
/* The three companies keep their names; the offline drafter is ours, so it is worded. */
const providerName = (p: { id: Source; name: string }) => (p.id === "offline" ? translate("studio.offline.name") : p.name);
const providerNote = (p: { id: Source; note: string }) => (p.id === "offline" ? translate("studio.offline.note") : p.note);
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const primary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
const quiet = `${btn} border border-line bg-surface text-ink hover:border-indigo-400`;

/* Report reasons read the same words the reader chose from: `library.report.reason.*`. */
const reportLabel = (reason: string) => {
  const text = translate(`library.report.reason.${reason}`);
  return text.startsWith("library.") ? reason : text;
};

const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) ||
  `book-${Date.now().toString(36)}`;

/** A new book: the first band, and no shelf until the author picks one from the server's list. */
const emptyInput = (): StoryInput => ({ id: "", title: "", language: "en", band: Object.keys(BANDS)[0] as Band, questionCounts: { ...BANDS.A }, category: "", text: "" });

export function LibraryStudio() {
  const { t } = useT();
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
      setOpenError(t("studio.error.open", { title: b.title, reason: e instanceof Error ? e.message : t("studio.error.unknown") }));
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
  const { t } = useT();
  const start = row?.draft;
  const [step, setStep] = useState<Step>(start ? 2 : 1);
  const [previewed, setPreviewed] = useState(false);
  const [reviewTarget, setReviewTarget] = useState("");
  const [undoStory, setUndoStory] = useState<{ input: StoryInput; draft: Draft | null; confirmed: boolean } | null>(null);
  const [source, setSource] = useState<Source>(() => (row?.provider as Source) ?? libraryDefault());
  const [input, setInput] = useState<StoryInput>(() =>
    start
      ? { id: row!.id, title: start.title, language: start.language, band: start.band, questionCounts: start.questionCounts ?? { ...BANDS[start.band] }, category: start.category ?? "", text: start.sentences.map((s) => s.text).join("\n") }
      : emptyInput(),
  );
  const [draft, setDraft] = useState<Draft | null>(start ?? null);
  const [confirmed, setConfirmed] = useState(row?.confirmedSplit ?? false);
  const [status, setStatus] = useState<{ rev: number; published: boolean }>({ rev: row?.rev ?? 0, published: row?.status === "published" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "publish">("");
  const [note, setNote] = useState<{ kind: "ok" | "bad" | "info"; text: string } | null>(null);
  const isNew = !row;
  const id = row?.id ?? (input.id || draft?.id || slug(input.title));
  const km = (draft?.language ?? input.language) === "km";
  const recoveryKey = `koda-studio-recovery-${row?.id ?? "new"}`;
  const [recovered, setRecovered] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(recoveryKey) ?? "null");
      if (saved?.input && saved?.dirty) {
        setInput(saved.input);
        setDraft(saved.draft ?? null);
        setConfirmed(Boolean(saved.confirmed));
        setDirty(true);
        setNote({ kind: "info", text: t("studio.summary.recovered") });
      }
    } catch { /* Recovery is best effort. */ }
    setRecovered(true);
  }, [recoveryKey]);
  useEffect(() => {
    if (!recovered) return;
    try {
      if (dirty) localStorage.setItem(recoveryKey, JSON.stringify({ input, draft, confirmed, dirty }));
      else localStorage.removeItem(recoveryKey);
    } catch { /* Server draft saving remains available. */ }
  }, [input, draft, confirmed, dirty, recovered, recoveryKey]);

  const verdict = useMemo<Verdict | null>(() => (draft ? verifyPassage({ ...draft, rev: 1 }, { confirmedSplit: confirmed, lexicon: readingLexiconFor(draft.band, draft.language) }) : null), [draft, confirmed]);
  const edit = (next: Draft) => {
    setDraft(next);
    setInput((current) => ({ ...current, title: next.title, category: next.category ?? "", language: next.language, band: next.band, text: next.sentences.map((sentence) => sentence.text).join("\n"), questionCounts: next.questionCounts }));
    setDirty(true);
    setPreviewed(false);
  };

  const save = async (): Promise<boolean> => {
    if (!input.text.trim() || !input.title.trim()) return false;
    setBusy("save");
    try {
      const { id: _i, ...passage } = { ...(draft ?? baseOf({ ...input, id })), id };
      const saved = await saveDraft(id, passage, confirmed, source === "offline" ? "offline" : source);
      setInput((current) => ({ ...current, id }));
      setStatus({ rev: saved.rev, published: saved.status === "published" });
      setDirty(false);
      setNote({ kind: "ok", text: t("studio.saved") });
      return true;
    } catch (e) {
      setNote({ kind: "bad", text: e instanceof Error ? e.message : t("studio.error.save") });
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
      setNote({ kind: "ok", text: t("studio.published", { rev: out.rev }) });
      void BookStore.refresh();
    } catch (e) {
      setNote({ kind: "bad", text: t("studio.error.publish", { reason: e instanceof Error ? e.message : t("studio.error.unknown") }) });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-4 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <UIButton type="button" variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />} onClick={onClose}>
          {t("reader.back")}
        </UIButton>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-mono text-xs text-muted">{id}</span>
          <UIBadge variant={status.published ? "success" : "neutral"}>
            {status.published ? t("studio.publishedRev", { rev: status.rev }) : t("studio.notPublished")}
          </UIBadge>
          {(draft || input.text.trim()) && (
            <UIButton type="button" variant="outline" size="sm" icon={<Upload className="h-4 w-4" aria-hidden="true" />} onClick={() => void save()} disabled={busy !== "" || !dirty} isLoading={busy === "save"}>
              {dirty ? t("studio.saveDraft") : t("studio.savedShort")}
            </UIButton>
          )}
        </div>
      </div>

      <UIStepper
        className="mb-5"
        label={t("studio.steps")}
        current={step - 1}
        onSelect={(i) => setStep((i + 1) as Step)}
        steps={STEPS.map((name, i) => {
          const n = (i + 1) as Step;
          const complete = n === 1 ? Boolean(input.title.trim() && input.text.trim())
            : n === 2 || n === 6 ? Boolean(verdict?.publishable)
            : n === 3 ? Boolean(draft?.picture && layoutBook(draft).story.every((page) => pagePicture(page, draft).key))
            : n === 4 ? Boolean(draft?.sentences.length && draft.sentences.every((sentence) => sentence.audio))
            : n === 5 ? previewed : status.published && !dirty;
          return { id: name, label: t(`studio.step.${name}`), complete, disabled: n > 1 && !draft };
        })}
      />

      {reports.length > 0 && (
        <div className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/50">
          <h2 className="mb-2 font-extrabold text-rose-900 dark:text-rose-100">⚑ {t("studio.reportedBy")}</h2>
          <ul className="grid gap-2">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                <span><b>{reportLabel(r.reason)}</b> · {t("studio.revision", { rev: r.rev })}{r.note ? ` — “${r.note}”` : ""}</span>
                <UIButton type="button" variant="secondary" size="sm" icon={<Check aria-hidden="true" />} onClick={async () => { await resolveReport(r.id); onResolved?.(r.id); }}>{t("studio.resolved")}</UIButton>
              </li>
            ))}
          </ul>
        </div>
      )}
      {note && (
        <div role="status" className="mb-4 grid gap-2">
          <UIFlashMessage type={note.kind === "bad" ? "error" : note.kind === "ok" ? "success" : "info"} message={note.text} />
        </div>
      )}

      <StepFrame plain={step === 2}>
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
              if (storyChanged && input.text.trim()) setUndoStory({ input, draft, confirmed });
              if (draft && storyChanged) {
                setDraft({ ...withStoryPictures(baseOf({ ...next, id }), PICTURE_KEYS), learningTakeaway: draft.learningTakeaway, xp: draft.xp });
                setConfirmed(false);
                setNote({ kind: "info", text: t("studio.storyChanged") });
              }
              if (draft && !storyChanged) setDraft({ ...draft, title: next.title, category: next.category, questionCounts: next.questionCounts });
              setDirty(true);
              setPreviewed(false);
              // Changing only the requested counts is safe: keep the existing
              // questions and update the validation target without regenerating.
              if (draft && !storyChanged && next.questionCounts && (
                next.questionCounts.understand !== (input.questionCounts?.understand ?? 10) ||
                next.questionCounts.words !== (input.questionCounts?.words ?? 10) ||
                next.questionCounts.spell !== (input.questionCounts?.spell ?? 10) ||
                next.questionCounts.match !== input.questionCounts?.match
              )) {
                setDraft({ ...draft, title: next.title, category: next.category, questionCounts: next.questionCounts });
                setDirty(true);
              }
              setInput(next);
            }}
            onNext={() => {
              // A new book starts with its story and nothing asked: every Review section is filled on its own, by hand or with AI.
              if (!draft) {
                setDraft(withStoryPictures(baseOf({ ...input, id }), PICTURE_KEYS));
                setConfirmed(input.language !== "km");
                setDirty(true);
              }
              setStep(2);
            }}
          />
        )}
        {step === 2 && draft && verdict && <ReviewStep source={source} target={reviewTarget} draft={draft} verdict={verdict} confirmed={confirmed} onConfirmed={(c) => { setConfirmed(c); setDirty(true); }} onEdit={edit} />}
        {step === 3 && draft && <PagesStep draft={draft} onEdit={edit} />}
        {step === 4 && draft && <VoiceStep draft={draft} onEdit={edit} />}
        {undoStory && <UIButton type="button" variant="secondary" onClick={() => { setInput(undoStory.input); setDraft(undoStory.draft); setConfirmed(undoStory.confirmed); setUndoStory(null); setDirty(true); }}>{t("studio.storyAi.undo")}</UIButton>}
        {step === 5 && draft && <BookPreview book={{ ...draft, id, rev: status.rev || 1 }} onExit={() => { setPreviewed(true); setStep(6); }} />}
        {step === 6 && draft && verdict && <SummaryStep source={source} draft={draft} verdict={verdict} confirmed={confirmed} onEdit={edit} onNavigate={setStep} onQuestion={(id) => { setReviewTarget(id); setStep(2); }} />}
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
              setNote({ kind: "info", text: t("studio.unpublished") });
              void BookStore.refresh();
            }}
            onDelete={row ? async () => {
              await deleteBook(id);
              onClose();
            } : undefined}
          />
        )}
      </StepFrame>
    </div>
  );
}

/** The card a step sits in; Review lays out its own cards, so it sits on the page. */
function StepFrame({ plain, children }: { plain: boolean; children: ReactNode }) {
  return plain ? <section>{children}</section> : <UICard className="p-4 sm:p-5">{children}</UICard>;
}

/* -------------------------------------------------------------------------- */

/** The shelf menu's last choice, which opens a box to name a new shelf. */
const NEW_SHELF = "__new_shelf__";

function SourceStep({ input, categories, isNew, source, onSource, onInput, onNext }: {
  input: StoryInput; categories: readonly string[]; isNew: boolean; source: Source; onSource(s: Source): void; onInput(i: StoryInput): void; onNext(): void;
}) {
  const { t } = useT();
  const km = input.language === "km";
  const [showAiStory, setShowAiStory] = useState(false);
  const [addingShelf, setAddingShelf] = useState(false);
  const [storyIdea, setStoryIdea] = useState("");
  const [writingStory, setWritingStory] = useState(false);
  const [storyError, setStoryError] = useState("");
  const [proposal, setProposal] = useState<{ title: string; story: string } | null>(null);
  const set = <K extends keyof StoryInput>(k: K, v: StoryInput[K]) => onInput({ ...input, [k]: v });
  const writeStory = async () => {
    if ((!input.text.trim() && !storyIdea.trim()) || source === "offline") return;
    setWritingStory(true);
    setStoryError("");
    try {
      const result = await requestAiStory({ provider: source, language: input.language, band: input.band, idea: storyIdea.trim(), category: input.category || undefined, story: input.text.trim() || undefined });
      setProposal(result);
    } catch (error) {
      setStoryError(error instanceof Error ? error.message : t("studio.error.storyWriterFailed"));
    } finally {
      setWritingStory(false);
    }
  };
  return (
    <div className="grid gap-4">
      <fieldset>
        <legend className={label}>{t("studio.whoDrafts")}</legend>
        <div className="grid gap-2 sm:grid-cols-4" role="radiogroup">
          {PROVIDERS.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={source === p.id} onClick={() => onSource(p.id)}
              className={themeSystem.card("interactive", `px-3 py-2 text-left ${source === p.id ? "!border-indigo-600 !bg-indigo-50 dark:!bg-indigo-950/60" : ""}`)}>
              <b className="block text-ink">{providerName(p)}</b>
              <span className="text-xs text-muted">{providerNote(p)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={label}>{t("studio.field.title")}</span>
          <UIInput className={km ? KHMER : ""} value={input.title} onChange={(e) => set("title", e.target.value)} placeholder={km ? "ចំណងជើង" : "e.g. At the Market"} />
        </label>
        <label>
          <span className={label}>{t(isNew ? "studio.field.idNew" : "studio.field.idFixed")}</span>
          <UIInput className="font-mono" value={input.id} disabled={!isNew} onChange={(e) => set("id", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder={slug(input.title || "new book")} />
        </label>
        <div>
          <span className={label}>{t("studio.field.bookLanguage")}</span>
          <div className="flex gap-2">
            {(["en", "km"] as Language[]).map((l) => (
              <UIButton key={l} type="button" size="sm" variant={input.language === l ? "primary" : "secondary"} aria-pressed={input.language === l} onClick={() => set("language", l)} className={l === "km" ? KHMER : ""}>{l === "en" ? "English" : "ភាសាខ្មែរ"}</UIButton>
            ))}
          </div>
        </div>
        <div>
          <span className={label}>{t("studio.field.ageBand")}</span>
          <div className="flex gap-2">
            {(Object.keys(BANDS) as Band[]).map((b) => (
              <UIButton key={b} type="button" size="sm" variant={input.band === b ? "primary" : "secondary"} aria-pressed={input.band === b} onClick={() => onInput({ ...input, band: b, questionCounts: { ...BANDS[b] } })}>{`${b} · ${BANDS[b].ages[0]}–${BANDS[b].ages[1]}`}</UIButton>
            ))}
          </div>
        </div>
        <fieldset className="sm:col-span-2 rounded-2xl border border-line bg-surface-muted p-3">
          <legend className={`${label} px-1`}>{t("studio.field.target")}</legend>
          <p className="mb-2 text-xs text-muted">{t("studio.field.targetNote")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(["understand", "words", "spell", "match"] as const).map((kind) => {
              // Matching sets are capped lower than the other sections, and default to none.
              const max = kind === "match" ? MATCH_MAX_QUESTIONS : TARGET_MAX;
              return (
                <label key={kind}>
                  <span className="mb-1 block text-xs font-bold capitalize text-muted">{t(`library.part.${kind}`)}</span>
                  <UIInput type="number" min={0} max={max} value={input.questionCounts?.[kind] ?? (kind === "match" ? 0 : TARGET_MAX)} onChange={(e) => set("questionCounts", { ...(input.questionCounts ?? BANDS[input.band]), [kind]: Math.max(0, Math.min(max, Math.round(Number(e.target.value)) || 0)) })} />
                </label>
              );
            })}
          </div>
        </fieldset>
        <label>
          <span className={label}>{t("studio.col.shelf")}</span>
          <UISelect
            value={addingShelf ? NEW_SHELF : input.category}
            onChange={(e) => {
              const picked = e.target.value;
              setAddingShelf(picked === NEW_SHELF);
              set("category", picked === NEW_SHELF ? "" : picked);
            }}
          >
            <option value="">{t("studio.field.noShelf")}</option>
            {/* The server's list; a book's own shelf stays choosable even if the list has moved on. */}
            {[...new Set([...categories, ...(input.category && !addingShelf ? [input.category] : [])])].map((c) => <option key={c} value={c}>{c}</option>)}
            <option value={NEW_SHELF}>{t("studio.field.newShelf")}</option>
          </UISelect>
          {/* A shelf of the author's own: it exists once this book is saved on it, and is offered for every book after. */}
          {addingShelf && (
            <UIInput
              className="mt-2"
              autoFocus
              maxLength={40}
              placeholder={t("studio.field.newShelfName")}
              aria-label={t("studio.field.newShelfName")}
              value={input.category}
              onChange={(e) => set("category", e.target.value)}
            />
          )}
        </label>
      </div>
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="library-story" className={`${label} !mb-0`}>{t("studio.field.story")}</label>
          <UIButton type="button" size="sm" variant="secondary" icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} aria-expanded={showAiStory} onClick={() => { setShowAiStory((open) => !open); setStoryError(""); }}>
            {t("studio.storyAi.open")}
          </UIButton>
        </div>
        {proposal && (
          <UICard className="mb-3 grid gap-3 p-3">
            <h3 className="koda-admin-card-title">{t("studio.storyAi.proposal")}</h3>
            <UITextarea value={proposal.story} className="min-h-40" onChange={(event) => setProposal({ ...proposal, story: event.target.value })} />
            <p className="text-sm text-muted">{t("studio.storyAi.applyNote")}</p>
            <div className="flex gap-2">
              <UIButton type="button" disabled={!proposal.story.trim()} onClick={() => { onInput({ ...input, title: input.title.trim() || proposal.title, text: proposal.story }); setProposal(null); setShowAiStory(false); }}>{t("studio.storyAi.apply")}</UIButton>
              <UIButton type="button" variant="secondary" onClick={() => setProposal(null)}>{t("studio.storyAi.discard")}</UIButton>
            </div>
          </UICard>
        )}
        {showAiStory && (
          <div className="mb-3 grid gap-3 rounded-2xl border border-[#D9D3F2] bg-[#F8F6FF] p-3">
            <div>
              <p className="koda-admin-label text-[#0E0B55]">{t(input.text.trim() ? "studio.storyAi.enhanceTitle" : "studio.storyAi.title")}</p>
              {(source === "offline" || !input.text.trim()) && (
                <p className="text-sm text-[#6D6997]">
                  {source === "offline" ? t("studio.storyAi.chooseAi") : t("studio.storyAi.note", { who: PROVIDERS.find((p) => p.id === source)?.name ?? source })}
                </p>
              )}
            </div>
            <label>
              <span className={label}>{t(input.text.trim() ? "studio.storyAi.instructions" : "studio.storyAi.idea")}</span>
              <UITextarea className={`min-h-24 ${km ? KHMER : ""}`} value={storyIdea} onChange={(e) => setStoryIdea(e.target.value)} placeholder={input.text.trim() ? t("studio.storyAi.revisePlaceholder") : km ? t("studio.storyAi.placeholderKm") : t("studio.storyAi.placeholder")} />
            </label>
            {storyError && <UIFlashMessage type="error" message={storyError} />}
            <div className="flex flex-wrap gap-2">
              <UIButton type="button" icon={<Sparkles aria-hidden="true" />} isLoading={writingStory} disabled={writingStory || source === "offline" || (!input.text.trim() && !storyIdea.trim())} onClick={() => void writeStory()}>
                {writingStory ? t("studio.storyAi.writing") : t(input.text.trim() ? "studio.storyAi.enhance" : "studio.storyAi.write")}
              </UIButton>
              <UIButton type="button" variant="ghost" disabled={writingStory} onClick={() => setShowAiStory(false)}>{t("common.cancel")}</UIButton>
            </div>
          </div>
        )}
        <UITextarea className={`min-h-40 ${km ? `${KHMER} text-lg leading-loose` : ""}`} value={input.text} lang={input.language} onChange={(e) => set("text", e.target.value)}
          id="library-story"
          placeholder={km ? t("studio.field.storyHintKm") : t("studio.field.storyHint")} />
      </div>
      <div>
        <UIButton type="button" iconRight={<ChevronRight aria-hidden="true" />} disabled={!input.text.trim() || !input.title.trim()} onClick={onNext}>{t("skillCard.continue")}</UIButton>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ReviewStep({ draft, verdict, confirmed, onConfirmed, onEdit, target, source }: {
  source: Source; draft: Draft; verdict: Verdict; confirmed: boolean; onConfirmed(c: boolean): void; onEdit(d: Draft): void; target?: string;
}) {
  const { t } = useT();
  const km = draft.language === "km";
  const need = draft.questionCounts ?? BANDS[draft.band];
  const [tab, setTab] = useState<"splits" | "understand" | "match" | "words" | "spell" | "notes">("splits");
  useEffect(() => {
    const question = draft.questions.find((item) => item.id === target);
    if (question) setTab(question.kind === "comprehension" ? "understand" : question.kind === "vocab" ? "words" : question.kind === "match" ? "match" : "spell");
    else if (target === "story") setTab("splits");
  }, [target]);
  useEffect(() => {
    if (target) document.getElementById(`studio-question-${target}`)?.scrollIntoView?.({ block: "center" });
  }, [tab, target]);
  const [addMessage, setAddMessage] = useState("");
  const byQ = (id: string) => verdict.checks.filter((c) => c.question === id);
  const setQ = (id: string, patch: Partial<Question>) => onEdit({ ...draft, questions: draft.questions.map((q) => (q.id === id ? ({ ...q, ...patch } as Question) : q)) });
  const del = (id: string) => onEdit({ ...draft, questions: draft.questions.filter((q) => q.id !== id) });
  const nextId = (prefix: string) => {
    let n = 1;
    while (draft.questions.some((q) => q.id === `${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  };
  const [addingWord, setAddingWord] = useState(false);
  const addVocab = (next: VocabEdit) => {
    onEdit({ ...draft, pictures: next.pictures, confirmedPictures: next.confirmedPictures, questions: [...draft.questions, next.question] });
    setAddingWord(false);
  };
  const setVocab = (id: string, next: VocabEdit) =>
    onEdit({ ...draft, pictures: next.pictures, confirmedPictures: next.confirmedPictures, questions: draft.questions.map((x) => (x.id === id ? next.question : x)) });
  const picWords = [...new Set(draft.sentences.flatMap((s) => s.words.map(core)).filter((w) => w && pictureFor(w, draft.language, PICTURE_KEYS)))];

  const add = (kind: Question["kind"]) => {
    setAddMessage("");
    if (kind === "match") {
      // The book's matching target when it sets one; otherwise only the ceiling.
      if (need.match !== undefined && count("match") >= need.match) setAddMessage(t("studio.review.full"));
      else if (count("match") >= MATCH_MAX_QUESTIONS) setAddMessage(t("studio.review.matchFull", { max: MATCH_MAX_QUESTIONS }));
      else onEdit({ ...draft, questions: [...draft.questions, blankMatch(nextId("m"), draft.language)] });
      return;
    }
    if (count(kind) >= need[kind === "comprehension" ? "understand" : kind === "vocab" ? "words" : "spell"]) {
      setAddMessage(t("studio.review.full"));
      return;
    }
    const s = draft.sentences[0];
    if (kind === "comprehension") onEdit({ ...draft, questions: [...draft.questions, { id: nextId("q"), kind, prompt: "", options: ["", "", ""], answer: 0, evidence: s.id }] });
    if (kind === "spell") {
      const w = core(s.words.find((t) => core(t).length >= 3) ?? s.words[0]);
      onEdit({ ...draft, questions: [...draft.questions, { id: nextId("sp"), kind, sentence: s.id, word: km ? w : w.toLowerCase() }] });
    }
    if (kind === "vocab") {
      // A word the curated list can draw goes straight in; any other waits for a person to pick its picture.
      const w = picWords.find((x) => !draft.questions.some((q) => q.kind === "vocab" && q.word === (km ? x : x.toLowerCase())));
      const word = w && (km ? w : w.toLowerCase());
      const next = word ? withVocabWord(draft, nextId("q"), word, pictureFor(word, draft.language, PICTURE_KEYS)!, PICTURE_KEYS) : null;
      if (next) addVocab(next);
      else setAddingWord(true);
    }
  };

  const [makingMatch, setMakingMatch] = useState(false);
  const [making, setMaking] = useState<Question["kind"] | null>(null);
  const [madeNote, setMadeNote] = useState("");
  // "No AI" on the Source step still drafts these three offline; Match and notes need a model, so they use the default one.
  const aiProvider = source === "offline" ? undefined : (source as Provider);
  const partOf = (kind: "comprehension" | "vocab" | "spell") => (kind === "comprehension" ? "understand" : kind === "vocab" ? "words" : "spell");

  /**
   * Fills one section up to its target with AI (or the offline drafter), keeping
   * what is there. The model sees the sentences numbered s1, s2… in order — the
   * draft's own ids can differ once lines are joined — so its answers are mapped
   * back, and anything repeating an existing item is dropped.
   */
  const makeWithAi = async (kind: "comprehension" | "vocab" | "spell") => {
    setAddMessage("");
    setMadeNote("");
    const want = need[partOf(kind)] - count(kind);
    if (want <= 0) return setAddMessage(t("studio.review.full"));
    setMaking(kind);
    try {
      const ids = draft.sentences.map((x) => x.id);
      const num = (sid: string) => `s${ids.indexOf(sid) + 1}`;
      const back = (sid: string) => ids[Number(sid.slice(1)) - 1] ?? sid;
      const counts = { ...need, understand: kind === "comprehension" ? want : 0, words: kind === "vocab" ? want : 0, spell: kind === "spell" ? want : 0 };
      const numbered = { ...draft, questionCounts: counts, sentences: draft.sentences.map((x, i) => ({ ...x, id: `s${i + 1}` })) };
      const have = draft.questions.filter((q) => q.kind === kind);
      const avoid = have.map((q) =>
        q.kind === "comprehension" ? `Understand: "${q.prompt}" → "${q.options[q.answer]}" (${num(q.evidence)})`
        : q.kind === "vocab" ? `Words: "${q.word}"`
        : q.kind === "spell" ? `Spell: "${q.word}" (${num(q.sentence)})` : "");
      const reply = source === "offline"
        ? draftLocally(numbered, PICTURE_KEYS, have.length + 1)
        : (await requestAiDraft({ provider: aiProvider, language: draft.language, band: draft.band, questionCounts: counts, sentences: draft.sentences.map((x) => x.text), pictures: [...PICTURE_KEYS], easyWords: readingWordsFor(draft.band, draft.language), avoid })).draft;
      const made = fromModel(numbered, reply, PICTURE_KEYS);
      const usedWords = new Set(have.flatMap((q) => (q.kind === "vocab" || q.kind === "spell" ? [q.word] : [])));
      const usedSentences = new Set(have.flatMap((q) => (q.kind === "comprehension" ? [q.evidence] : q.kind === "spell" ? [q.sentence] : [])));
      const usedAnswers = new Set(have.flatMap((q) => (q.kind === "comprehension" ? [q.options[q.answer]] : [])));
      const taken = new Set(draft.questions.map((q) => q.id));
      const freshId = (prefix: string) => {
        let n = 1;
        while (taken.has(`${prefix}${n}`)) n++;
        taken.add(`${prefix}${n}`);
        return `${prefix}${n}`;
      };
      const fresh: Question[] = [];
      for (const q of made.questions) {
        if (q.kind !== kind || fresh.length >= want) continue;
        if (q.kind === "comprehension") {
          const evidence = back(q.evidence);
          if (usedSentences.has(evidence) || usedAnswers.has(q.options[q.answer])) continue;
          usedSentences.add(evidence);
          usedAnswers.add(q.options[q.answer]);
          fresh.push({ ...q, id: freshId("q"), evidence });
        } else if (q.kind === "vocab") {
          if (usedWords.has(q.word)) continue;
          usedWords.add(q.word);
          fresh.push({ ...q, id: freshId("q") });
        } else if (q.kind === "spell") {
          const sentence = back(q.sentence);
          if (usedWords.has(q.word) || usedSentences.has(sentence)) continue;
          usedWords.add(q.word);
          usedSentences.add(sentence);
          fresh.push({ ...q, id: freshId("sp"), sentence });
        }
      }
      if (!fresh.length) return setAddMessage(t("studio.section.nothingNew"));
      // A Words question brings its picture; only the curated list's pictures arrive confirmed.
      const words = fresh.flatMap((q) => (q.kind === "vocab" ? [q.word] : []));
      const pick = (m: Record<string, string> | undefined) => Object.fromEntries(words.filter((w) => m?.[w]).map((w) => [w, m![w]]));
      onEdit({
        ...draft,
        pictures: { ...draft.pictures, ...pick(made.pictures) },
        confirmedPictures: { ...(draft.confirmedPictures ?? {}), ...pick(made.confirmedPictures) },
        questions: [...draft.questions, ...fresh],
      });
      setMadeNote(fresh.length < want ? t("studio.section.madeSome", { count: fresh.length, want }) : t("studio.section.made", { count: fresh.length }));
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : t("studio.error.drafter"));
    } finally {
      setMaking(null);
    }
  };
  /** A matching set drafted by AI, added like one typed by hand — the checks below judge it the same way. */
  const makeMatch = async () => {
    setAddMessage("");
    if (need.match !== undefined && count("match") >= need.match) return setAddMessage(t("studio.review.full"));
    if (count("match") >= MATCH_MAX_QUESTIONS) return setAddMessage(t("studio.review.matchFull", { max: MATCH_MAX_QUESTIONS }));
    setMakingMatch(true);
    try {
      const avoid = draft.questions.flatMap((q) => (q.kind === "match" ? q.pairs.map((pr) => pr.left) : []));
      const made = await requestAiMatch({ provider: aiProvider, language: draft.language, band: draft.band, sentences: draft.sentences.map((s) => ({ id: s.id, text: s.text })), pairs: 4, avoid });
      onEdit({ ...draft, questions: [...draft.questions, { id: nextId("m"), kind: "match", prompt: made.prompt ?? matchPrompt(draft.language), pairs: made.pairs }] });
      setMadeNote(t("studio.section.madeMatch", { count: made.pairs.length }));
    } catch (error) {
      setAddMessage(error instanceof Error ? error.message : t("studio.error.matchFailed"));
    } finally {
      setMakingMatch(false);
    }
  };

  const count = (k: Question["kind"]) => draft.questions.filter((q) => q.kind === k).length;
  const strip: Array<[string, number, number]> = [[t("library.part.understand"), count("comprehension"), need.understand], [t("library.part.words"), count("vocab"), need.words], [t("library.part.spell"), count("spell"), need.spell]];
  const tabKind: Record<Exclude<typeof tab, "splits" | "notes">, Question["kind"]> = { understand: "comprehension", match: "match", words: "vocab", spell: "spell" };
  const activeQuestions = tab === "splits" || tab === "notes" ? [] : draft.questions.filter((q) => q.kind === tabKind[tab]);
  const [splitTarget, setSplitTarget] = useState<{ sid: string; index: number } | null>(null);
  const [splitText, setSplitText] = useState("");
  const tabItems: UITabItem<typeof tab>[] = [
    { id: "splits", label: t("studio.col.content") },
    ...strip.map(([name, have, want], index) => {
      const key = (["understand", "words", "spell"] as const)[index];
      const passing = have >= minimumQuestions(want) && have <= want;
      return { id: key, label: `${passing ? "✓" : "✕"} ${name}`, count: `${have}/${want}` };
    }),
    // Held to its target like any section once the book sets one; without one, just the count.
    need.match !== undefined
      ? { id: "match" as const, label: `${meetsTarget(count("match"), need.match) ? "✓" : "✕"} ${t("library.part.match")}`, count: `${count("match")}/${need.match}` }
      : { id: "match" as const, label: t("library.part.match"), count: String(count("match")) },
    { id: "notes", label: t("studio.notes.tab"), count: String(Object.values(draft.wordNotes ?? {}).filter((n) => n.reading || n.opposite).length) },
  ];
  // One piece fixes the word, several split it, none deletes it.
  const applyWordEdit = (sid: string, index: number, pieces: string[]) => {
    const sentence = draft.sentences.find((x) => x.id === sid);
    if (!sentence || (pieces.length === 0 && sentence.words.length < 2)) return;
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
      <UITabs items={tabItems} value={tab} onChange={setTab} label={t("studio.review.sections")} />

      <p className="text-sm text-muted">{t("studio.review.toPublish", { understand: minimumQuestions(need.understand), words: minimumQuestions(need.words), spell: minimumQuestions(need.spell) })}
        {need.match ? ` ${t("studio.review.toPublishMatch", { match: minimumQuestions(need.match) })}` : ""}</p>

      {tab === "splits" && <details open={km} className="rounded-2xl border border-line p-3">
        <summary className="cursor-pointer font-extrabold text-ink">{t(km ? "studio.review.splitsKm" : "studio.review.splitsEn")}</summary>
        <p className="mt-2 text-sm text-muted">{t("studio.review.splitsHelp")}</p>
        {draft.sentences.map((s, si) => (
          <div key={s.id} className="mt-2 flex gap-2">
            <b className="w-8 shrink-0 pt-2 font-mono text-xs text-muted">{s.id}</b>
            {si > 0 && (
              <button type="button" aria-label={t("studio.review.joinLines", { line: s.id, above: draft.sentences[si - 1].id })} title={t("studio.review.joinLines", { line: s.id, above: draft.sentences[si - 1].id })}
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
                  <button type="button" disabled={i === s.words.length - 1} title={i === s.words.length - 1 ? t("studio.review.lastWord") : t("studio.review.joinNext")} onClick={() => {
                    onEdit({ ...draft, sentences: draft.sentences.map((x) => (x.id === s.id ? mergeWords(x, i, draft.language) : x)) });
                    if (km) onConfirmed(false);
                  }} className={`rounded-xl border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-100 ${km ? `${KHMER} text-lg` : ""}`}>
                    {w}
                  </button>
                  <button type="button" aria-label={t("studio.review.editWord", { line: s.id, n: i + 1 })} title={t("studio.review.fixWordTitle")} onClick={() => { setSplitTarget({ sid: s.id, index: i }); setSplitText(w); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300">
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
            {splitTarget?.sid === s.id && (() => {
              const pieces = splitText.trim().split(/[\s\u200B]+/u).filter(Boolean);
              const unchanged = pieces.length === 1 && pieces[0] === s.words[splitTarget.index];
              return (
                <div className="mt-2 basis-full rounded-xl border border-indigo-200 bg-indigo-50 p-2 dark:border-indigo-800 dark:bg-indigo-950/50">
                  <label className="block text-sm font-semibold text-ink">
                    {t("studio.review.fixWord")}
                    <UIInput autoFocus className={`mt-1 ${km ? KHMER : ""}`} value={splitText} lang={draft.language} onChange={(e) => setSplitText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && pieces.length > 0 && !unchanged) applyWordEdit(s.id, splitTarget.index, pieces); }} />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={primary} disabled={pieces.length === 0 || unchanged} onClick={() => applyWordEdit(s.id, splitTarget.index, pieces)}>
                      {pieces.length > 1 ? t("studio.review.splitInto", { count: pieces.length }) : t("studio.review.saveWord")}
                    </button>
                    <button type="button" className={quiet} onClick={() => { setSplitTarget(null); setSplitText(""); }}>{t("common.cancel")}</button>
                    <button type="button" disabled={s.words.length < 2} title={s.words.length < 2 ? t("studio.review.joinInstead") : t("studio.review.deleteWordTitle")}
                      onClick={() => applyWordEdit(s.id, splitTarget.index, [])}
                      className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-40 dark:text-rose-300 dark:hover:bg-rose-950">
                      <Trash2 className="h-4 w-4" aria-hidden="true" /> {t("studio.review.deleteWord")}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
        {km && (
          <label className="mt-3 flex items-center gap-2 font-bold text-ink">
            <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={confirmed} onChange={(e) => onConfirmed(e.target.checked)} />
            {t("studio.review.confirmSplits")}
          </label>
        )}
      </details>}

      {tab !== "splits" && tab !== "notes" && (() => {
        const kind = tabKind[tab];
        const want = kind === "match" ? need.match : need[partOf(kind)];
        const have = count(kind);
        const full = want !== undefined && have >= want ? t("studio.section.full") : kind === "match" && have >= MATCH_MAX_QUESTIONS ? t("studio.review.matchFull", { max: MATCH_MAX_QUESTIONS }) : undefined;
        const aiCount = kind === "match" || want === undefined ? 0 : Math.max(0, want - have);
        return (
          <SectionHeader
            title={t(`library.part.${tab}`)}
            help={t(`studio.section.help.${tab}`)}
            have={have}
            want={want}
            manualLabel={t(kind === "match" ? "studio.section.writeSet" : "studio.section.write")}
            onManual={() => { setMadeNote(""); add(kind); }}
            aiLabel={aiCount > 1 ? t("studio.section.makeN", { count: aiCount }) : t("studio.section.make")}
            onAi={() => void (kind === "match" ? makeMatch() : makeWithAi(kind))}
            aiBusy={kind === "match" ? makingMatch : making === kind}
            aiDisabled={full}
          >
            {tab === "words" && addingWord && <NewWordFields draft={draft} id={nextId("q")} onAdd={addVocab} onCancel={() => setAddingWord(false)} />}
            {addMessage && <p role="status" className="text-sm font-semibold text-rose-700 dark:text-rose-300">{addMessage}</p>}
            {madeNote && <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">✓ {madeNote}</p>}
          </SectionHeader>
        );
      })()}

      {tab !== "splits" && tab !== "notes" && activeQuestions.length === 0 && !addingWord && (
        <SectionEmpty text={t(tab === "match" ? "studio.section.emptyMatch" : "studio.section.empty", { part: t(`library.part.${tab}`) })} />
      )}

      {activeQuestions.map((q) => (
        <div key={q.id} id={`studio-question-${q.id}`}><QuestionCard q={q} draft={draft} checks={byQ(q.id)} onChange={(patch) => setQ(q.id, patch)} onVocab={(next) => setVocab(q.id, next)} onDelete={() => del(q.id)} /></div>
      ))}

      {tab === "notes" && <WordNotesFields draft={draft} provider={aiProvider} onChange={(wordNotes) => onEdit({ ...draft, wordNotes })} onInQuiz={(notesInQuiz) => onEdit({ ...draft, notesInQuiz })} />}

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

function QuestionCard({ q, draft, checks, onChange, onVocab, onDelete }: {
  q: Question; draft: Draft; checks: Verdict["checks"];
  onChange(patch: Partial<Question>): void; onVocab(next: VocabEdit): void; onDelete(): void;
}) {
  const { t } = useT();
  const failing = checks.some((c) => c.status === "fail");
  const tag = t(`library.part.${q.kind === "comprehension" ? "understand" : q.kind === "vocab" ? "words" : q.kind === "match" ? "match" : "spell"}`);
  const collapsible = true;
  const [expanded, setExpanded] = useState(true);
  const [correcting, setCorrecting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ question: Question; explanation: string } | null>(null);
  const suggestedComprehension = suggestion?.question.kind === "comprehension" ? suggestion.question : null;
  const correctWithAi = async () => {
    setCorrecting(true);
    try {
      const result = await requestAiCorrection({ language: draft.language, band: draft.band, sentences: draft.sentences.map((s) => ({ id: s.id, text: s.text })), question: q, checks: checks.map((c) => ({ message: c.message, status: c.status })), easyWords: readingWordsFor(draft.band, draft.language) });
      const corrected = correctedQuestion(result.question, q, draft.sentences);
      if (!corrected) throw new Error(t("studio.ai.badFormat"));
      setSuggestion({ question: corrected, explanation: result.explanation });
    } catch (error) {
      setSuggestion({ question: q, explanation: error instanceof Error ? error.message : t("studio.ai.failed") });
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
              aria-label={t(expanded ? "studio.q.collapseLabel" : "studio.q.expandLabel", { part: tag, id: q.id })}
              aria-expanded={expanded}
              title={expanded ? t("studio.q.collapse") : t("studio.q.expand")}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
            </button>
          )}
          <span>{q.id}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* The AI corrector knows the three required parts; a matching set is the author's own. */}
          {q.kind !== "match" && <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950" onClick={() => void correctWithAi()} disabled={correcting} aria-label={correcting ? t("studio.ai.checking") : t("studio.ai.correct")} title={correcting ? t("studio.ai.checking") : t("studio.ai.correct")}>
            <Sparkles className={`h-4 w-4 ${correcting ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>}
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={onDelete} aria-label={t("studio.q.delete", { part: tag, id: q.id })} title={t("studio.q.delete", { part: tag, id: q.id })}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {(!collapsible || expanded) && <>
        {q.kind === "comprehension" && <UnderstandFields q={q} draft={draft} onChange={onChange} />}
        {q.kind === "vocab" && <WordsFields q={q} draft={draft} onChange={onVocab} />}
        {q.kind === "spell" && <SpellFields q={q} draft={draft} onChange={onChange} />}
        {q.kind === "match" && <MatchFields q={q} draft={draft} onChange={onChange} />}
      {suggestion && (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-100">
          <p><b>{t("studio.ai.says")}</b> {suggestion.explanation}</p>
          {suggestedComprehension && <>
            <p className="mt-1">{t("studio.ai.choices")} {suggestedComprehension.options.map((option, index) => <b key={index} className="mr-2 inline-block">{index === suggestedComprehension.answer ? "✓ " : ""}{option}</b>)}</p>
            <p className="mt-1">{t("studio.ai.answer")} <b>{suggestedComprehension.options[suggestedComprehension.answer]}</b> · {t("studio.ai.evidence")} {suggestedComprehension.evidence}</p>
          </>}
          {suggestion.question.kind === "vocab" && <p className="mt-1">{t("studio.ai.word")} <b>{suggestion.question.word}</b> · {t("studio.ai.picture")} {suggestion.question.options[suggestion.question.answer]}</p>}
          {suggestion.question.kind === "spell" && <p className="mt-1">{t("studio.ai.spellWord")} <b>{suggestion.question.word}</b> · {t("studio.ai.sentence")} {suggestion.question.sentence}</p>}
          {JSON.stringify(suggestion.question) === JSON.stringify(q) && <p className="mt-2 font-bold text-rose-700 dark:text-rose-300">{t("studio.ai.unchanged")}</p>}
          {JSON.stringify(suggestion.question) !== JSON.stringify(q) && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={primary} onClick={() => { onChange(suggestion.question); setSuggestion(null); }}>{t("studio.ai.apply")}</button>
              <button type="button" className={quiet} onClick={() => setSuggestion(null)}>{t("studio.ai.keep")}</button>
            </div>
          )}
        </div>
      )}
      <CheckLines checks={checks} />
      </>}
    </div>
  );
}

function correctedQuestion(value: unknown, current: Question, sentences: Draft["sentences"]): Question | null {
  if (!value || typeof value !== "object") return null;
  const next = value as Record<string, unknown>;
  if (next.id !== current.id || next.kind !== current.kind) return null;
  // A model that copied the sentence instead of its id still means a sentence; one that matches none keeps the current one.
  if (current.kind === "comprehension" && Array.isArray(next.options) && next.options.length === CHOICES && typeof next.prompt === "string" && typeof next.evidence === "string" && Number.isInteger(next.answer))
    return { ...next, evidence: sentenceIdFor(sentences, next.evidence) ?? current.evidence } as unknown as Question;
  if (current.kind === "vocab" && Array.isArray(next.options) && next.options.length === CHOICES && typeof next.word === "string" && Number.isInteger(next.answer)) return next as unknown as Question;
  if (current.kind === "spell" && typeof next.sentence === "string" && typeof next.word === "string")
    return { ...next, sentence: sentenceIdFor(sentences, next.sentence) ?? current.sentence } as unknown as Question;
  return null;
}

function RuleList({ verdict }: { verdict: Verdict }) {
  const { t } = useT();
  const rules = (Object.keys(RULES) as unknown as Array<keyof typeof RULES>).map((k) => {
    const n = Number(k) as keyof typeof RULES;
    const list = verdict.checks.filter((c) => c.rule === n);
    const bad = list.some((c) => c.status === "fail");
    const skip = list.some((c) => c.status === "skipped");
    // The check's title is the studio's label; `RULES` keeps the English the checks are defined in.
    return { n, title: t(`studio.rule.${n}`), status: bad ? "fail" : skip ? "skipped" : "pass" };
  });
  const zero = verdict.checks.filter((c) => c.rule === 0 && c.status === "fail");
  return (
    <div className="rounded-2xl border border-line p-3">
      <h3 className="mb-2 font-extrabold text-ink">{t("studio.rules")}</h3>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">
        {rules.map((r) => (
          <li key={r.n} className={r.status === "fail" ? "font-bold text-rose-700 dark:text-rose-400" : r.status === "pass" ? "text-ink" : "text-muted"}>
            {r.status === "fail" ? "✕" : r.status === "pass" ? "✓" : "ⓘ"} {r.n} · {r.title}{r.status === "skipped" ? ` — ${t("studio.notRunYet")}` : ""}
          </li>
        ))}
      </ul>
      {zero.length > 0 && <p className="mt-2 text-sm font-bold text-rose-700 dark:text-rose-400">{t("studio.malformed")} {zero.map((c) => `${c.question}: ${c.message}`).join(" · ")}</p>}
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
/* Names are names; the tone is a label, worded under `studio.voice.tone.<id>`. */

type VoiceSource = "gemini" | "vox" | "openai";
const SOURCE_NAME: Record<VoiceSource, string> = { gemini: "Gemini", vox: "Vox", openai: "ChatGPT" };
const OPENAI_VOICE_KEY = "koda_library_openai_voice_v1";
const VOICE_SOURCE_KEY = "koda_library_voice_source_v1";
const VOX_VOICE_KEY = "koda_library_vox_voice_v1";
const remembered = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* an authoring preference is optional */
  }
};

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
  if (!res.ok || !body?.audio) throw new Error(body?.error?.message ?? translate("studio.voice.geminiUnreachable"));
  return { blob: pcmToWav(body.audio), cues: body.cues ?? [] };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


function VoiceStep({ draft, onEdit }: { draft: Draft; onEdit(d: Draft): void }) {
  const { t } = useT();
  const km = draft.language === "km";
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const recorder = useRecorder();
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const [voiceCharacter, setVoiceCharacter] = useState<VoiceCharacterId>(rememberedVoiceCharacter);
  const [source, setSourceState] = useState<VoiceSource>(() => {
    const saved = remembered(VOICE_SOURCE_KEY);
    return saved === "vox" || saved === "openai" ? saved : "gemini";
  });
  const [openaiVoiceId, setOpenaiVoiceIdState] = useState(() => {
    const saved = remembered(OPENAI_VOICE_KEY);
    return OPENAI_VOICES.some((v) => v.id === saved) ? (saved as string) : OPENAI_VOICES[0].id;
  });
  const [voxVoices, setVoxVoices] = useState<VoxVoice[] | null>(null);
  const [voxProblem, setVoxProblem] = useState("");
  const [voxVoiceId, setVoxVoiceIdState] = useState(() => remembered(VOX_VOICE_KEY) ?? "");
  const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
  const recorded = draft.sentences.filter((s) => s.audio).length;
  const clipIds = [...new Set(draft.sentences.flatMap((s) => s.audio ? [s.audio] : []))];
  const clipKey = clipIds.join(",");
  const totalBytes = clipIds.reduce((total, id) => total + (sizes[id] ?? 0), 0);
  const sizesReady = clipIds.every((id) => sizes[id] !== undefined);
  const selectedVoiceCharacter = VOICE_CHARACTERS.find((character) => character.id === voiceCharacter) ?? VOICE_CHARACTERS[0];

  const setSource = (next: VoiceSource) => {
    setSourceState(next);
    remember(VOICE_SOURCE_KEY, next);
  };
  const chooseOpenaiVoice = (id: string) => {
    setOpenaiVoiceIdState(id);
    remember(OPENAI_VOICE_KEY, id);
  };
  const chooseVoxVoice = (id: string) => {
    setVoxVoiceIdState(id);
    remember(VOX_VOICE_KEY, id);
  };
  // Vox's voices are fetched when they are first wanted, not for every author who
  // opens this step: it is another service, and it may be down or not set up.
  useEffect(() => {
    if (source !== "vox" || voxVoices !== null) return;
    let live = true;
    fetchVoxVoices()
      .then((got) => {
        if (!live) return;
        setVoxVoices(got);
        setVoxProblem("");
      })
      .catch((e: unknown) => {
        if (live) setVoxProblem(e instanceof Error ? e.message : t("studio.voice.voxLoadFailed"));
      });
    return () => { live = false; };
  }, [source, voxVoices]);
  const orderedVox = useMemo(() => orderedFor(voxVoices ?? [], draft.language), [voxVoices, draft.language]);
  const chosenVox = orderedVox.find((v) => v.id === voxVoiceId) ?? orderedVox[0] ?? null;
  const usingVox = source === "vox";
  const usingOpenai = source === "openai";
  /** The name on the buttons: whoever is going to read. */
  const readerName = usingVox ? (chosenVox?.name ?? "Vox") : usingOpenai ? openaiVoiceId : selectedVoiceCharacter.name;
  /**
   * One line read aloud, by whichever source is chosen. The rest of the step asks
   * this and does not care who answers. Vox and ChatGPT give no word cues, so a line they read
   * highlights by word length as a hand-made recording does; Gemini's carry timings.
   */
  const generateLine = async (text: string, words: string[]): Promise<{ blob: Blob; cues: WordCue[] }> => {
    if (usingOpenai) return { blob: await openaiVoice(text, openaiVoiceId, draft.language), cues: [] };
    if (!usingVox) return geminiVoice(text, words, draft.language, voiceCharacter);
    if (!chosenVox) throw new Error(voxProblem || t("studio.voice.chooseVoxFirst"));
    return { blob: await voxVoice(text, chosenVox.id), cues: [] };
  };

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
      setErr(e instanceof Error ? e.message : t("studio.error.generic"));
    } finally {
      setBusy(null);
    }
  };
  const allByAi = () =>
    run("all", async () => {
      let next = draft;
      for (const s of draft.sentences) {
        if (s.audio) continue;
        const generated = await generateLine(s.text, s.words);
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
      if (!url) throw new Error(t("studio.voice.noDownload"));
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
        {t("studio.voice.intro")}
      </p>
      <div role="group" aria-label={t("studio.voice.sourceGroup")} className="flex flex-wrap gap-2">
        {(["gemini", "vox", "openai"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={source === k} disabled={busy !== null} onClick={() => setSource(k)}
            className={`${quiet} ${source === k ? "border-[#534AB7] bg-[#F1EFFF] text-[#0E0B55]" : ""}`}>
            {t("studio.voice.sourceVoices", { name: SOURCE_NAME[k] })}
          </button>
        ))}
      </div>
      {usingOpenai && (
        <fieldset className="rounded-2xl border border-line bg-surface p-3">
          <legend className="koda-admin-card-title px-1">{t("studio.voice.chooseNamed", { name: "ChatGPT" })}</legend>
          <label className="grid gap-1.5">
            <span className="koda-admin-label px-1">{t("studio.voice.voice")}</span>
            <select value={openaiVoiceId} disabled={busy !== null} onChange={(e) => chooseOpenaiVoice(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink">
              {OPENAI_VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.id} — {t(`studio.voice.openaiTone.${v.id}`)}</option>
              ))}
            </select>
          </label>
          {draft.language === "km" && (
            <p className="mt-2 px-1 text-xs text-muted">{t("studio.voice.chatgptKhmer")}</p>
          )}
        </fieldset>
      )}
      {usingVox && (
        <fieldset className="rounded-2xl border border-line bg-surface p-3">
          <legend className="koda-admin-card-title px-1">{t("studio.voice.chooseNamed", { name: "Vox" })}</legend>
          {voxProblem ? (
            <p role="alert" className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{voxProblem}</p>
          ) : voxVoices === null ? (
            <p className="text-sm text-muted">{t("studio.voice.loading")}</p>
          ) : orderedVox.length === 0 ? (
            <p className="text-sm text-muted">{t("studio.voice.voxEmpty")}</p>
          ) : (
            <>
              <label className="grid gap-1.5">
                <span className="koda-admin-label px-1">{t("studio.voice.voxOrder")}</span>
                <select value={chosenVox?.id ?? ""} disabled={busy !== null} onChange={(e) => chooseVoxVoice(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink">
                  {orderedVox.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.category ? ` — ${v.category}` : ""}</option>
                  ))}
                </select>
              </label>
              {chosenVox?.description && <p className="mt-2 px-1 text-xs text-muted">{chosenVox.description}</p>}
              <p className="mt-2 px-1 text-xs text-muted">{t("studio.voice.listenFirst")}</p>
            </>
          )}
        </fieldset>
      )}
      <fieldset className={`rounded-2xl border border-line bg-surface p-3 ${usingVox || usingOpenai ? "hidden" : ""}`}>
        <legend className="koda-admin-card-title px-1">{t("studio.voice.chooseGemini")}</legend>
        <p className="koda-admin-label mb-3 px-1">{t("studio.voice.geminiNote")}</p>
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
                  <span className="koda-admin-chip block text-muted">{t(`studio.voice.tone.${character.id}`)}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-black text-ink">{t("studio.voice.recordedOf", { done: recorded, total: draft.sentences.length })}</span>
        {recorded > 0 && sizesReady && <span className="text-sm font-bold text-muted">{t("studio.voice.stored", { size: formatBytes(totalBytes) })}</span>}
        <button type="button" className={quiet} disabled={busy !== null || recorded === draft.sentences.length} onClick={() => void allByAi()}>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {busy === "all" ? t("studio.voice.generating") : t("studio.voice.forTheRest", { name: readerName })}
        </button>
      </div>
      {err && <p role="alert" className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{err}</p>}
      <ol className="grid gap-2">
        {draft.sentences.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line px-3 py-2">
            <b className="w-8 font-mono text-xs text-muted">{s.id}</b>
            <span className={`min-w-40 flex-1 text-ink ${km ? `${KHMER} text-lg` : ""}`}>{s.text}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-black ${s.audio ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-surface-muted text-muted"}`}>{s.audio ? `${t("studio.voice.recorded")}${sizes[s.audio] !== undefined ? ` · ${formatBytes(sizes[s.audio])}` : ""}` : t("studio.voice.notRecorded")}</span>
            {s.audio && (
              <button type="button" className={quiet} aria-label={t("studio.voice.play", { line: s.id })} onClick={() => { stop(); void say(s.text, draft.language, s.audio); }}>
                <Play className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {s.audio && (
              <button type="button" className={quiet} disabled={busy !== null} aria-label={t("studio.voice.download", { line: s.id })} title={t("studio.voice.downloadM4a")} onClick={() => void downloadRecording(s)}>
                <Download className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            {canRecord && (recorder.recording === s.id ? (
              <button type="button" className={`${btn} bg-rose-600 text-white`} onClick={recorder.stop}>
                <Square className="h-4 w-4" aria-hidden="true" />{t("studio.voice.stop")}
              </button>
            ) : (
              <button type="button" className={quiet} disabled={busy !== null || recorder.recording !== null} aria-label={t("studio.voice.recordLine", { line: s.id })}
                onClick={() => void run(s.id, () => recorder.start(s.id, (blob) => void run(s.id, () => attach(s.id, blob))))}>
                <Mic className="h-4 w-4" aria-hidden="true" />{s.audio ? t("studio.voice.reRecord") : t("studio.voice.record")}
              </button>
            ))}
            <button type="button" className={quiet} disabled={busy !== null} aria-label={t("studio.voice.generateLine", { name: SOURCE_NAME[source], line: s.id })} onClick={() => void run(s.id, async () => {
              const generated = await generateLine(s.text, s.words);
              await attach(s.id, generated.blob, generated.cues);
            })}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />{busy === s.id ? "…" : readerName}
            </button>
            {s.audio && (
              <button type="button" className={quiet} aria-label={t("studio.voice.remove", { line: s.id })} onClick={() => onEdit({ ...draft, sentences: draft.sentences.map((x) => (x.id === s.id ? { ...x, audio: undefined, audioCues: undefined } : x)) })}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ol>
      {!canRecord && <p className="text-xs text-muted">{t("studio.voice.cannotRecord")}</p>}
      {/* Sentences are for reading the story aloud; these are for a child who
          stops at one word. Both, not either — see WordVoicePanel. */}
      <WordVoicePanel
        draft={draft}
        onEdit={onEdit}
        generatorName={readerName}
        generate={async (word) => (await generateLine(word, [word])).blob}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function SummaryStep({ draft, verdict, confirmed, onEdit, onNavigate, onQuestion, source }: { draft: Draft; verdict: Verdict; confirmed: boolean; onEdit(draft: Draft): void; onNavigate(step: Step): void; onQuestion(id: string): void; source: Source }) {
  const { t } = useT();
  const [mediaBytes, setMediaBytes] = useState({ voice: 0, images: 0 });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  const sentenceAudio = draft.sentences.map((sentence) => sentence.audio).filter((id): id is string => Boolean(id));
  const wordAudio = Object.values(draft.wordAudio ?? {});
  const audioIds = [...new Set([...sentenceAudio, ...wordAudio])];
  const pages = layoutBook(draft).story;
  const pageImages = pages.map((page) => pagePicture(page, draft).key).filter((picture): picture is string => Boolean(picture));
  const [imageDetails, setImageDetails] = useState<Record<string, number>>({});
  const [dimensions, setDimensions] = useState<Record<string, string>>({});
  const imageIds = [...new Set([draft.picture, ...pageImages, ...Object.values(draft.pictures ?? {})].filter(Boolean))];
  const uploadedImages = imageIds.filter(isPhoto);
  const vocabWords = [...new Set(draft.questions.filter((q) => q.kind === "vocab").map((q) => q.word))];
  const spellWords = [...new Set(draft.questions.filter((q) => q.kind === "spell").map((q) => q.word))];
  const storyWords = draft.sentences.reduce((sum, sentence) => sum + sentence.words.length, 0);
  const need = draft.questionCounts ?? BANDS[draft.band];
  const countsReady = meetsTarget(verdict.counts.comprehension, need.understand)
    && meetsTarget(verdict.counts.vocab, need.words)
    && meetsTarget(verdict.counts.spell, need.spell)
    && (need.match === undefined || meetsTarget(verdict.counts.match, need.match));
  const ready = verdict.failures === 0 && countsReady && (draft.language !== "km" || confirmed);

  useEffect(() => {
    let live = true;
    Promise.all(uploadedImages.map(async (key) => [key, await photoDimensions(key)] as const)).then((results) => {
      if (live) setDimensions(Object.fromEntries(results.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    }).catch(() => undefined);
    Promise.all([clipSizes(audioIds), photoSizes(uploadedImages)]).then(([voices, images]) => {
      if (live) setMediaBytes({
        voice: Object.values(voices).reduce((sum, bytes) => sum + bytes, 0),
        images: Object.values(images).reduce((sum, bytes) => sum + bytes, 0),
      });
      if (live) setImageDetails(images);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [audioIds.join("|"), uploadedImages.join("|")]);

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="koda-admin-section-title">{t("studio.summary.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("studio.summary.note")}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <SummaryCard label={t("studio.summary.story")} value={t("studio.summary.storyValue", { sentences: draft.sentences.length, words: storyWords })} detail={t("studio.summary.storyDetail", { language: draft.language === "km" ? "ភាសាខ្មែរ" : "English", ages: `${BANDS[draft.band].ages[0]}–${BANDS[draft.band].ages[1]}` })} />
        <SummaryCard label={t("studio.summary.questions")} value={t("studio.summary.questionValue", { understand: verdict.counts.comprehension, words: verdict.counts.vocab, spell: verdict.counts.spell })} detail={t("studio.summary.questionDetail", { checks: verdict.failures })} />
        <SummaryCard label={t("studio.summary.voices")} value={t("studio.summary.voiceValue", { sentences: sentenceAudio.length, total: draft.sentences.length, words: wordAudio.length })} detail={mediaBytes.voice ? t("studio.summary.storage", { size: formatBytes(mediaBytes.voice) }) : t("studio.summary.noStorage")} />
        <SummaryCard label={t("studio.summary.images")} value={t("studio.summary.imageValue", { total: imageIds.length, pages: pageImages.length })} detail={uploadedImages.length ? t("studio.summary.imageStorage", { count: uploadedImages.length, size: mediaBytes.images ? formatBytes(mediaBytes.images) : "…" }) : t("studio.summary.builtInImages")} />
      </div>

      <div className="grid items-start gap-3 md:grid-cols-2">
        <UICard className="p-3">
          <h3 className="koda-admin-card-title">{t("studio.summary.learning")}</h3>
          <label className="mt-2 block">
            <span className="koda-admin-label">{t("studio.summary.takeaway")}</span>
            <UITextarea rows={2} className="min-h-20 text-sm" value={draft.learningTakeaway ?? ""} onChange={(event) => onEdit({ ...draft, learningTakeaway: event.target.value })} placeholder={t("studio.summary.takeawayHint")} />
          </label>
          {source !== "offline" && <UIButton type="button" size="sm" variant="secondary" isLoading={suggesting} onClick={async () => {
            setSuggesting(true); setSuggestError("");
            try {
              const result = await requestAiStory({ provider: source, language: draft.language, band: draft.band, idea: "", story: draft.sentences.map((sentence) => sentence.text).join("\n"), takeawayOnly: true });
              if (!result.takeaway) throw new Error(t("studio.error.storyWriterFailed"));
              onEdit({ ...draft, learningTakeaway: result.takeaway });
            } catch (error) { setSuggestError(error instanceof Error ? error.message : t("studio.error.storyWriterFailed")); }
            finally { setSuggesting(false); }
          }}>{t("studio.summary.suggest")}</UIButton>}
          {suggestError && <UIFlashMessage type="error" message={suggestError} />}
          <label className="mt-3 block border-t border-line pt-2">
            <span className="koda-admin-label">{t("studio.summary.xp")}</span>
            <UIInput
              type="number"
              inputMode="numeric"
              min={0}
              max={500}
              step={5}
              className="max-w-32 text-sm"
              placeholder={String(ScoringAPI.current().xpPerLevel)}
              value={draft.xp ?? ""}
              onChange={(event) => onEdit({ ...draft, xp: event.target.value === "" ? null : Math.min(500, Math.max(0, Math.round(Number(event.target.value)))) })}
            />
            <span className="mt-1 block text-xs text-muted">{t("studio.summary.xpNote", { xp: ScoringAPI.current().xpPerLevel })}</span>
          </label>
          <ul className="mt-3 grid gap-1.5 border-t border-line pt-2 text-sm text-ink">
            <li>{t("studio.summary.understandLearning", { count: verdict.counts.comprehension })}</li>
            {verdict.counts.match > 0 && <li>{t("studio.summary.matchLearning", { count: verdict.counts.match })}</li>}
            <li>{t("studio.summary.vocabLearning", { words: vocabWords.join(", ") || "—" })}</li>
            <li>{t("studio.summary.spellLearning", { words: spellWords.join(", ") || "—" })}</li>
          </ul>
        </UICard>
        <UICard className="p-3">
          <h3 className="koda-admin-card-title">{t("studio.summary.publishCheck")}</h3>
          <div className={`mt-2 rounded-xl px-3 py-2 text-sm font-semibold ${ready ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200"}`}>
            {ready ? t("studio.summary.ready") : t("studio.summary.reviewNeeded")}
          </div>
          <PublishChecklist verdict={verdict} need={need} draft={draft} confirmed={confirmed} />
          <p className="mt-2 text-sm text-muted">{draft.category ? t("studio.summary.shelf", { shelf: draft.category }) : t("studio.summary.noShelf")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 [&>button]:min-h-8 [&>button]:px-2.5 [&>button]:py-1 [&>button]:text-xs [&>button]:font-medium [&>button]:text-left [&>button]:whitespace-normal">
            {verdict.checks.filter((check) => check.status === "fail").map((check, index) => (
              <UIButton key={index} type="button" variant="secondary" onClick={() => onQuestion(check.question)}>{check.question}: {check.message}</UIButton>
            ))}
            {!countsReady && <UIButton type="button" variant="secondary" onClick={() => onNavigate(2)}>{t("studio.summary.fixCounts")}</UIButton>}
            {draft.language === "km" && !confirmed && <UIButton type="button" variant="secondary" onClick={() => onNavigate(2)}>{t("studio.review.confirmSplits")}</UIButton>}
            {sentenceAudio.length < draft.sentences.length && <UIButton type="button" variant="secondary" onClick={() => onNavigate(4)}>{t("studio.summary.fixVoices", { count: draft.sentences.length - sentenceAudio.length })}</UIButton>}
            {pageImages.length < pages.length && <UIButton type="button" variant="secondary" onClick={() => onNavigate(3)}>{t("studio.summary.fixImages", { count: pages.length - pageImages.length })}</UIButton>}
          </div>
        </UICard>
      </div>
      <UICard className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <h3 className="koda-admin-card-title">{t("studio.summary.media")}</h3>
          <p className="text-xs text-muted">{t("studio.summary.totalMedia", { size: formatBytes(mediaBytes.voice + mediaBytes.images) })}</p>
        </div>
        {uploadedImages.length > 0 && <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {uploadedImages.map((key, index) => <p key={key} className="rounded-lg bg-surface-muted px-2 py-1.5 text-xs">{t("studio.summary.uploadedImage", { count: index + 1 })}: {imageDetails[key] === undefined ? t("studio.summary.unavailable") : formatBytes(imageDetails[key])} · {dimensions[key] ?? t("studio.summary.unavailable")}</p>)}
        </div>}
      </UICard>
    </div>
  );
}

/**
 * Everything publishing checks, in one list a teacher can read before pressing
 * Publish: each part with how many it has against what it needs, the optional
 * matching sets, and every rule. Matching never blocks for being absent — only
 * a set that is there and fails its own checks does.
 */
function PublishChecklist({ verdict, need, draft, confirmed }: { verdict: Verdict; need: QuestionCounts; draft: Draft; confirmed: boolean }) {
  const { t } = useT();
  const part = meetsTarget;
  const matchIds = new Set(draft.questions.filter((q) => q.kind === "match").map((q) => q.id));
  const matchFails = verdict.checks.filter((c) => matchIds.has(c.question) && c.status === "fail").length;
  const rows: Array<{ ok: boolean | "info"; text: string }> = [
    { ok: part(verdict.counts.comprehension, need.understand), text: t("studio.checklist.part", { part: t("library.part.understand"), have: verdict.counts.comprehension, min: minimumQuestions(need.understand), max: need.understand }) },
    { ok: part(verdict.counts.vocab, need.words), text: t("studio.checklist.part", { part: t("library.part.words"), have: verdict.counts.vocab, min: minimumQuestions(need.words), max: need.words }) },
    { ok: part(verdict.counts.spell, need.spell), text: t("studio.checklist.part", { part: t("library.part.spell"), have: verdict.counts.spell, min: minimumQuestions(need.spell), max: need.spell }) },
    // A book with a matching target is held to it like any section; without one, matching stays optional.
    ...(need.match !== undefined && (need.match > 0 || verdict.counts.match > 0)
      ? [{ ok: part(verdict.counts.match, need.match), text: t("studio.checklist.part", { part: t("library.part.match"), have: verdict.counts.match, min: minimumQuestions(need.match), max: need.match }) }]
      : []),
    verdict.counts.match === 0
      ? { ok: "info", text: t("studio.checklist.noMatch") }
      : { ok: matchFails === 0, text: t("studio.checklist.match", { count: verdict.counts.match }) },
    ...verdict.rules.map((r) => ({ ok: r.status === "skipped" ? ("info" as const) : r.status === "pass" || r.rule === 4, text: `${r.title} — ${r.message}` })),
    ...(draft.language === "km" ? [{ ok: confirmed, text: t("studio.review.confirmSplits") }] : []),
  ];
  return (
    <details className="mt-2 rounded-xl border border-line px-3 py-2" open={!verdict.publishable}>
      <summary className="cursor-pointer text-sm font-bold text-ink">{t("studio.checklist.title", { failing: rows.filter((r) => r.ok === false).length })}</summary>
      <ul className="mt-2 grid gap-1 text-xs">
        {rows.map((r, i) => (
          <li key={i} className={r.ok === false ? "font-bold text-rose-700 dark:text-rose-400" : r.ok === "info" ? "text-muted" : "text-emerald-700 dark:text-emerald-400"}>
            {r.ok === false ? "✕" : r.ok === "info" ? "ⓘ" : "✓"} {r.text}
          </li>
        ))}
      </ul>
    </details>
  );
}

function SummaryCard({ label: cardLabel, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <UICard className="p-3">
      <p className="koda-admin-label text-xs text-muted">{cardLabel}</p>
      <p className="mt-1 text-sm font-medium leading-snug text-ink">{value}</p>
      <p className="mt-1 text-xs leading-snug text-muted">{detail}</p>
    </UICard>
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
  const { t } = useT();
  const need = counts ?? BANDS[band];
  const off = ([
    ["understand", verdict.counts.comprehension, need.understand],
    ["words", verdict.counts.vocab, need.words],
    ["spell", verdict.counts.spell, need.spell],
  ] as const)
    .filter(([, has, wants]) => has < minimumQuestions(wants) || has > wants)
    .map(([part, has, wants]) =>
      `${t(`library.part.${part}`)} ${has}/${wants} — ${has > wants ? t("studio.publish.deleteN", { count: has - wants }) : t("studio.publish.addN", { count: minimumQuestions(wants) - has })}`,
    );

  const reasons = [
    verdict.failures > 0 ? t("studio.publish.failing", { count: verdict.failures }) : "",
    off.length ? t("studio.publish.bandNeeds", { band, list: off.join(", ") }) : "",
    km && !confirmed ? t("studio.publish.splitsUnconfirmed") : "",
  ].filter(Boolean);
  const ready = reasons.length === 0;
  const [sure, setSure] = useState(false);
  return (
    <div className="grid max-w-4xl gap-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink">{t("studio.publish.title", { rev: status.rev + 1 })}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{t("studio.publish.note")}</p>
      </div>
      {!ready && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">{t("studio.publish.notReady", { reasons: reasons.join(" · ") })}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <UIButton type="button" variant="success" size="sm" icon={<BookOpen className="h-4 w-4" aria-hidden="true" />} disabled={!ready || busy !== ""} isLoading={busy === "publish"} onClick={onPublish}>
          {t("studio.step.publish")}
        </UIButton>
        {status.published && (
          <UIButton type="button" variant="ghost" size="sm" className="!rounded-full !border-0 !border-b-0 !px-2.5 !py-1 !font-semibold" icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />} onClick={onUnpublish}>
            {t("studio.publish.remove")}
          </UIButton>
        )}
        {onDelete && (sure ? (
          <UIButton type="button" variant="ghost" size="sm" className="!rounded-full !border-0 !border-b-0 !px-2.5 !py-1 !font-semibold text-rose-700 dark:text-rose-300" onClick={onDelete}>{t("studio.publish.confirmDelete")}</UIButton>
        ) : (
          <UIButton type="button" variant="ghost" size="sm" className="!rounded-full !border-0 !border-b-0 !px-2.5 !py-1 !font-semibold text-rose-700 dark:text-rose-300" icon={<Trash2 className="h-4 w-4" aria-hidden="true" />} onClick={() => setSure(true)}>
            {t("studio.publish.delete")}
          </UIButton>
        ))}
      </div>
    </div>
  );
}

export default LibraryStudio;
