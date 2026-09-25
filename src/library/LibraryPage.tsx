import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowLeft, BookOpen, Check, Lightbulb, Search, Volume2, X } from "lucide-react";
import { LetterWheel } from "../components/wheel/LetterWheel";
import { ScoringAPI } from "../lib/scoring";
import type { Language, Passage } from "./data/passage";
import { ringOf } from "./data/spellingDeck";
import { useShelf } from "./bookStore";
import { spellsWord, tilesOf } from "./data/tiles";
import { unitLabel } from "./data/khmer";
import { LEVEL_NAME, drawnLeftNote, nextUnit, orderFeedback, spellingLevel, unitCue, type SpellingLevel } from "./data/khmerCoach";
import { motion, useReducedMotion } from "motion/react";
import { prefetchUnits, sayUnit, useUnitVoices } from "./unitVoices";
import { BookRecorder } from "./learning";
import { Picture } from "./Picture";
import { LibraryProgress, type BookProgress } from "./progress";
import { isFirstTry, minutesToRead, parentSummary, quizOf, reward, tally, wordsToPractise, type Outcome, type QuizItem } from "./session";
import { canSpeak, say, sentenceSpeaks, stop } from "./voice";
import { prefetchBook } from "./clips";
import { prefetchPhotos } from "./photos";
import { reportBook, type ReportReason } from "./api";
import { BookReader } from "./BookReader";
import { playSound } from "../utils/audio";
import "./khmerFont";

/**
 * Koda Library — a shelf of short stories to read, answer and spell.
 *
 * A module of its own, not a skill: books are content, not curriculum, so there
 * are no lessons, no locks and no course position here. Phase 2 plays the bundled
 * starter shelf; published books arrive with the server in Phase 3.
 *
 * Screens: catalog → book → read → quiz (understand, words, spell) → results.
 */

type Screen = "catalog" | "book" | "read" | "quiz" | "results";

const LANG_KEY = "koda_library_lang_v1";
const KHMER = "font-['Noto_Sans_Khmer','Khmer_OS','Khmer_MN',sans-serif]";
const COVER: Record<string, string> = {
  Animals: "from-indigo-500 to-indigo-800",
  Food: "from-emerald-500 to-emerald-800",
  Family: "from-rose-500 to-rose-800",
  Places: "from-purple-500 to-purple-800",
  "Weather & play": "from-sky-500 to-indigo-700",
  Everyday: "from-indigo-400 to-purple-700",
};
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
const primary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
const quiet = `${btn} border border-line bg-surface text-ink hover:border-indigo-400`;
const kh = (p: { language: Language }) => (p.language === "km" ? KHMER : "");

function readLang(): Language {
  try {
    return localStorage.getItem(LANG_KEY) === "km" ? "km" : "en";
  } catch {
    return "en";
  }
}

export interface LibraryPageProps {
  /** Paid once, when a book is finished. The host owns the total. */
  onAwardXp?(amount: number): void;
  /** Lets the app shell give the reader the phone screen on mobile. */
  onReaderChange?(open: boolean): void;
}

export function LibraryPage({ onAwardXp, onReaderChange }: LibraryPageProps) {
  const [screen, setScreen] = useState<Screen>("catalog");
  const [bookId, setBookId] = useState<string | null>(null);
  const [lang, setLangState] = useState<Language>(readLang);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [earned, setEarned] = useState<{ stars: number; xp: number } | null>(null);
  const shelf = useShelf();
  const book = shelf.find((p) => p.id === bookId) ?? null;
  const top = useRef<HTMLDivElement>(null);

  const setLang = (l: Language) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* a remembered language is a convenience */
    }
  };
  const go = (s: Screen) => {
    stop();
    setScreen(s);
    top.current?.scrollIntoView?.({ block: "start" });
  };
  useEffect(() => () => stop(), []);
  useEffect(() => {
    onReaderChange?.(screen === "read" || screen === "quiz");
  }, [onReaderChange, screen]);

  const open = (id: string) => {
    setBookId(id);
    go("book");
  };

  return (
    <div ref={top} className={`mx-auto w-full max-w-5xl ${screen === "read" || screen === "quiz" ? "px-0 pb-4" : "px-2 pb-24"} pt-4 sm:px-6`} data-koda-library>
      {screen === "catalog" && <Catalog shelf={shelf} lang={lang} onLang={setLang} onOpen={open} />}
      {book && screen === "book" && (
        <BookPage book={book} onBack={() => go("catalog")} onRead={() => go("read")} />
      )}
      {book && screen === "read" && (
        <Reader
          book={book}
          onBack={() => go("book")}
          onReady={() => {
            LibraryProgress.set(book.id, { stage: "quiz", rev: book.rev });
            setOutcomes([]);
            go("quiz");
          }}
        />
      )}
      {book && screen === "quiz" && (
        <Quiz
          book={book}
          onLeave={() => go("book")}
          onFinish={(result) => {
            const quiz = quizOf(book);
            const r = reward(result, quiz.length, ScoringAPI.current());
            const [u, w, s] = tally(result, quiz);
            LibraryProgress.set(book.id, { stage: "done", rev: book.rev, firstTry: u.firstTry + w.firstTry + s.firstTry, total: quiz.length, stars: r.stars });
            if (r.xp > 0) onAwardXp?.(r.xp);
            setOutcomes(result);
            setEarned({ stars: r.stars, xp: r.xp });
            go("results");
          }}
        />
      )}
      {book && screen === "results" && (
        <Results book={book} outcomes={outcomes} earned={earned} onShelf={() => go("catalog")} onAgain={() => go("read")} />
      )}
    </div>
  );
}

/**
 * An author's test run of a book that may not be published yet.
 *
 * The same reader, quiz and results a child gets, with nothing kept: no progress,
 * no XP, and the learning log told "preview", which keeps it out of every child's
 * record.
 */
export function BookPreview({ book, onExit }: { book: Passage; onExit(): void }) {
  const [screen, setScreen] = useState<"read" | "quiz" | "results">("read");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  useEffect(() => () => stop(), []);
  return (
    <div data-koda-library data-preview>
      <p className="mb-3 rounded-2xl border border-dashed border-indigo-400 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
        Preview — nothing here is saved, scored or sent to a child’s record.
      </p>
      {screen === "read" && <Reader book={book} preview onBack={onExit} onReady={() => setScreen("quiz")} />}
      {screen === "quiz" && <Quiz book={book} preview onLeave={onExit} onFinish={(o) => { setOutcomes(o); setScreen("results"); }} />}
      {screen === "results" && <Results book={book} outcomes={outcomes} earned={null} onShelf={onExit} onAgain={() => setScreen("read")} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Catalog                                                                     */
/* -------------------------------------------------------------------------- */

function useProgress(): (p: Passage) => BookProgress | null {
  useSyncExternalStore(LibraryProgress.subscribe, LibraryProgress.version, LibraryProgress.version);
  return (p) => LibraryProgress.get(p.id, p.rev);
}

function Cover({ book, size = "shelf" }: { book: Passage; size?: "shelf" | "page" }) {
  return (
    <span
      className={`relative grid ${size === "page" ? "aspect-[4/3] sm:aspect-[3/4]" : "aspect-[3/4]"} content-end overflow-hidden rounded-2xl bg-gradient-to-br p-3 shadow-md ${COVER[book.category ?? ""] ?? "from-indigo-500 to-indigo-800"} ${size === "page" ? "w-full max-w-none sm:max-w-[220px]" : "w-full"}`}
    >
      <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-black text-slate-900">Level {book.band}</span>
      <span className="absolute inset-x-[14%] top-[13%] aspect-square rounded-full bg-white/90 p-[10%]">
        <Picture name={book.picture} />
      </span>
      <span className={`relative text-[15px] font-extrabold leading-tight text-white drop-shadow ${kh(book)}`}>{book.title}</span>
    </span>
  );
}

function Catalog({ shelf, lang, onLang, onOpen }: { shelf: readonly Passage[]; lang: Language; onLang(l: Language): void; onOpen(id: string): void }) {
  const progressOf = useProgress();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const mine = shelf.filter((p) => p.language === lang);
  const cats = [...new Set(mine.map((p) => p.category ?? "Everyday"))];
  const query = q.trim().toLowerCase();
  const list = mine.filter((p) => (cat === "All" || (p.category ?? "Everyday") === cat) && (!query || p.title.toLowerCase().includes(query)));
  const reading = list.filter((p) => {
    const st = progressOf(p)?.stage;
    return st === "read" || st === "quiz";
  });

  const shelfRow = (title: string, books: readonly Passage[], note?: string) =>
    books.length ? (
      <section key={title} className="mt-6">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          {note && <span className="text-xs text-muted">{note}</span>}
        </div>
        <ul className="flex snap-x gap-4 overflow-x-auto pb-3">
          {books.map((b) => (
            <li key={b.id} className="w-[136px] shrink-0 snap-start">
              <BookTile book={b} progress={progressOf(b)} onOpen={() => onOpen(b.id)} />
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-ink">Library</h1>
          <p className="text-sm text-muted">Read a story, answer questions, then spell words from it.</p>
        </div>
        <div role="group" aria-label="Language" className="inline-flex overflow-hidden rounded-full border border-line bg-surface">
          {(["en", "km"] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => onLang(l)} className={`min-h-11 px-4 font-bold ${lang === l ? "bg-indigo-600 text-white" : "text-muted"} ${l === "km" ? KHMER : ""}`}>
              {l === "en" ? "English" : "ភាសាខ្មែរ"}
            </button>
          ))}
        </div>
      </header>

      <label className="relative mt-4 block">
        <span className="sr-only">Search books</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search books"
          className="min-h-11 w-full rounded-full border border-line bg-surface py-2 pl-10 pr-4 text-ink placeholder:text-muted"
        />
      </label>

      <div role="group" aria-label="Category" className="mt-3 flex flex-wrap gap-2">
        {["All", ...cats].map((c) => (
          <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={`min-h-11 rounded-full border px-4 text-sm font-bold ${cat === c ? "border-indigo-600 bg-indigo-600 text-white" : "border-line bg-surface text-ink"}`}>
            {c}
          </button>
        ))}
      </div>

      {query ? (
        shelfRow(`Results for “${q.trim()}”`, list, `${list.length} book${list.length === 1 ? "" : "s"}`) ?? <p className="mt-6 text-muted">No books match that.</p>
      ) : (
        <>
          {shelfRow("Continue reading", reading, "pick up where you left off")}
          {(cat === "All" ? cats : [cat]).map((c) => shelfRow(c, list.filter((p) => (p.category ?? "Everyday") === c)))}
          {!list.length && <p className="mt-6 text-muted">No books here yet.</p>}
        </>
      )}
    </div>
  );
}

function BookTile({ book, progress, onOpen }: { book: Passage; progress: BookProgress | null; onOpen(): void }) {
  const st = progress?.stage;
  const label = st === "done" ? `Finished ✓${progress?.total ? ` ${progress.firstTry}/${progress.total}` : ""}` : st ? "In progress" : "New";
  return (
    <button type="button" onClick={onOpen} className="group grid w-full gap-1.5 text-left" aria-label={`${book.title}. Level ${book.band}. ${label}.`}>
      <span className="rounded-2xl ring-indigo-400 ring-offset-2 ring-offset-canvas group-hover:ring-2 group-focus-visible:ring-2">
        <Cover book={book} />
      </span>
      <span className="text-xs text-muted">{minutesToRead(book)} min · {book.sentences.length} sentences</span>
      <span className={`text-xs font-bold ${st === "done" ? "text-emerald-700 dark:text-emerald-400" : "text-muted"}`}>{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Book page                                                                   */
/* -------------------------------------------------------------------------- */

function BackBar({ label, onBack, right }: { label: string; onBack(): void; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={onBack} className={quiet}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
      {right}
    </div>
  );
}

function BookPage({ book, onBack, onRead }: { book: Passage; onBack(): void; onRead(): void }) {
  const progress = useProgress()(book);
  const [clips, setClips] = useState<{ ready: number; total: number } | null>(null);
  useEffect(() => {
    let live = true;
    void prefetchBook(book).then((r) => live && setClips(r));
    void prefetchPhotos(book); // so its photos show on the bus too
    return () => { live = false; };
  }, [book]);
  const vocab = book.questions.filter((q) => q.kind === "vocab").map((q) => (q.kind === "vocab" ? q.word : ""));
  const count = (k: string) => book.questions.filter((q) => q.kind === k).length;
  // A Khmer book's spelling level: its hardest spelling word.
  const levels = book.language === "km" ? book.questions.flatMap((q) => (q.kind === "spell" ? [spellingLevel(tilesOf(q.word, "km"))] : [])) : [];
  const level = levels.length ? (Math.max(...levels) as SpellingLevel) : null;
  return (
    <div>
      <BackBar label="Library" onBack={onBack} />
      <div className="grid gap-6 sm:grid-cols-[220px_minmax(0,1fr)]">
        <Cover book={book} size="page" />
        <div>
          <h1 className={`text-3xl font-extrabold tracking-tight text-ink ${kh(book)}`}>{book.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {[book.category ?? "Story", `Level ${book.band}`, `${minutesToRead(book)} min`, book.language === "km" ? "ភាសាខ្មែរ" : "English"].map((c) => (
              <span key={c} className={`rounded-full bg-surface-muted px-3 py-1 font-bold text-ink ${c === "ភាសាខ្មែរ" ? KHMER : ""}`}>{c}</span>
            ))}
          </div>
          <div className="mt-4">
            <button type="button" onClick={onRead} className={primary}>
              <BookOpen className="h-5 w-5" aria-hidden="true" />
              {progress?.stage === "done" ? "Read again" : progress ? "Keep reading" : "Read"}
            </button>
          </div>
          <ol className="mt-5 grid gap-2">
            {[
              ["Read the story", progress !== null],
              [`Understand — ${count("comprehension")} questions`, progress?.stage === "done"],
              [`Words — match ${count("vocab")} words to pictures`, progress?.stage === "done"],
              [`Spell — ${count("spell")} words from the story${level ? ` · level ${level}, ${LEVEL_NAME[level].toLowerCase()}` : ""}`, progress?.stage === "done"],
            ].map(([text, done], i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 text-ink">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${done ? "bg-emerald-600 text-white" : "bg-surface-muted text-ink"}`}>{done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}</span>
                {text}
                {done && <span className="sr-only">(done)</span>}
              </li>
            ))}
          </ol>
          {vocab.length > 0 && (
            <div className="mt-4">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">Words you will meet</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {vocab.map((w) => (
                  <span key={w} className={`rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 ${kh(book)}`}>{w}</span>
                ))}
              </div>
            </div>
          )}
          {clips && clips.total > 0 && (
            <p className="mt-4 text-xs font-bold text-muted">
              {clips.ready === clips.total ? "🔊 Read in a recorded voice · saved for offline" : `🔊 Recorded voice · ${clips.ready} of ${clips.total} saved — open the book online once to save the rest`}
            </p>
          )}
          {book.provenance && <p className="mt-4 text-xs text-muted">{book.provenance}</p>}
          <ReportBook book={book} />
        </div>
      </div>
    </div>
  );
}

const REASONS: Array<[ReportReason, string]> = [
  ["wrong_in_story", "Something in the story is wrong"],
  ["wrong_question", "A question or answer is wrong"],
  ["not_for_children", "Something is not right for children"],
  ["other", "Something else"],
];

/**
 * "Report a problem" — for a grown-up who spots something wrong. Quiet on
 * purpose: it is a link, not a button a child is drawn to, and it goes to the
 * authors in Library Studio, not to anyone else.
 */
function ReportBook({ book }: { book: Passage }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("wrong_question");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"" | "sending" | "sent" | "failed">("");
  if (state === "sent") return <p role="status" className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">Thank you — the people who write the books will look at it.</p>;
  if (!open) {
    return (
      <button type="button" className="mt-3 min-h-11 text-xs font-bold text-muted underline underline-offset-4" onClick={() => setOpen(true)}>
        Report a problem with this book
      </button>
    );
  }
  const send = async () => {
    setState("sending");
    try {
      await reportBook(book.id, book.rev, reason, note);
      setState("sent");
    } catch {
      setState("failed");
    }
  };
  return (
    <form className="mt-3 grid gap-2 rounded-2xl border border-line bg-surface p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
      <fieldset>
        <legend className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted">What is wrong?</legend>
        {REASONS.map(([r, label]) => (
          <label key={r} className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="radio" name="report-reason" className="h-5 w-5 accent-indigo-600" checked={reason === r} onChange={() => setReason(r)} />
            {label}
          </label>
        ))}
      </fieldset>
      <label className="text-sm text-ink">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-muted">Anything to add (optional)</span>
        <textarea className="min-h-16 w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {state === "failed" && <p role="alert" className="text-sm font-bold text-rose-700 dark:text-rose-400">It could not be sent — this device may be offline. Try again when it is online.</p>}
      <div className="flex gap-2">
        <button type="submit" className={primary} disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send report"}</button>
        <button type="button" className={quiet} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Reader                                                                      */
/* -------------------------------------------------------------------------- */

// The reader is a book of its own: see BookReader.
const Reader = BookReader;

/* -------------------------------------------------------------------------- */
/* Quiz                                                                        */
/* -------------------------------------------------------------------------- */

const PART_LABEL = { understand: "Understand", words: "Words", spell: "Spell" } as const;

function Quiz({ book, onLeave, onFinish, preview = false }: { book: Passage; onLeave(): void; onFinish(o: Outcome[]): void; preview?: boolean }) {
  const quiz = useMemo(() => quizOf(book), [book]);
  const recorder = useMemo(() => new BookRecorder(book), [book]);
  const [i, setI] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [sheet, setSheet] = useState<{ evidence: string | null } | null>(null);
  const cur = useRef<Outcome | null>(null);
  const finished = useRef(false);
  const item = quiz[i];

  useEffect(() => {
    recorder.start(preview ? "preview" : "picker");
    return () => {
      if (!finished.current) recorder.abandon();
    };
  }, [recorder, preview]);

  useEffect(() => {
    if (!item) return;
    cur.current = { part: item.part, id: item.part === "spell" ? item.word.id : item.question.id, word: item.part === "spell" ? item.word.word : item.part === "words" ? item.question.word : undefined, wrong: 0, hints: 0, reread: false };
    recorder.present(item);
  }, [item, recorder]);

  const readAgain = (evidence: string | null = null) => {
    if (cur.current) cur.current.reread = true;
    recorder.support("reveal");
    setSheet({ evidence });
  };
  const correct = () => {
    const done = [...outcomes, cur.current!];
    setOutcomes(done);
    if (i + 1 < quiz.length) setI(i + 1);
    else {
      finished.current = true;
      const r = reward(done, quiz.length, ScoringAPI.current());
      recorder.complete(r.stars, r.xp);
      onFinish(done);
    }
  };

  const doneIn = (part: QuizItem["part"]) => outcomes.filter((o) => o.part === part).length;
  const parts = (["understand", "words", "spell"] as const).map((p) => ({ p, n: quiz.filter((q) => q.part === p).length }));

  return (
    <div>
      <BackBar
        label="Stop"
        onBack={onLeave}
        right={
          <button type="button" onClick={() => readAgain()} className={quiet}>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Read again
          </button>
        }
      />
      <div className="mb-4 grid grid-cols-3 gap-2" aria-label="Progress">
        {parts.map(({ p, n }) => (
          <div key={p}>
            <div className={`mb-1 flex justify-between gap-1.5 text-[11px] font-extrabold uppercase tracking-wide ${item?.part === p ? "text-ink" : "text-muted"}`}>
              <span className="min-w-0 truncate">{PART_LABEL[p]}</span>
              <span className="shrink-0 tabular-nums">{doneIn(p)}/{n}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full bg-indigo-600 transition-[width]" style={{ width: `${n ? (doneIn(p) / n) * 100 : 0}%` }} />
            </div>
          </div>
        ))}
      </div>

      {item && item.part !== "spell" && (
        <ChoiceQuestion
          key={i}
          book={book}
          item={item}
          onWrong={(given) => { cur.current!.wrong++; recorder.answered(item, false, given); }}
          onRight={(given) => { recorder.answered(item, true, given); setTimeout(correct, 900); }}
          onHint={(level) => {
            cur.current!.hints = Math.max(cur.current!.hints, level);
            recorder.support("hint", level);
            if (level === 2 && item.part === "understand") readAgain(item.question.evidence);
            if (level === 2 && item.part === "words") void say(item.question.word, book.language);
          }}
        />
      )}
      {item && item.part === "spell" && (
        <SpellQuestion
          key={i}
          book={book}
          item={item}
          onWrong={(given) => { cur.current!.wrong++; recorder.answered(item, false, given); }}
          onRight={(given) => { recorder.answered(item, true, given); setTimeout(correct, 1000); }}
          onHint={(level) => { cur.current!.hints = Math.max(cur.current!.hints, level); recorder.support("hint", level); }}
          onReadAgain={() => readAgain()}
        />
      )}

      {sheet && <StorySheet book={book} evidence={sheet.evidence} onClose={() => setSheet(null)} />}
    </div>
  );
}

function StorySheet({ book, evidence, onClose }: { book: Passage; evidence: string | null; onClose(): void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Read again: ${book.title}`} className="fixed inset-0 z-50 grid place-items-end bg-slate-950/45 p-4 sm:place-items-center" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-xl overflow-auto rounded-3xl border border-line bg-surface p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className={`text-lg font-extrabold text-ink ${kh(book)}`}>{book.title}</h2>
          <button ref={close} type="button" onClick={onClose} className={quiet}>
            Close <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <ol className="grid gap-2">
          {book.sentences.map((s) => (
            <li key={s.id} className={`flex items-center gap-3 px-1 py-2.5 ${s.id === evidence ? "font-semibold text-indigo-900 dark:text-indigo-100" : "text-ink"}`}>
              <span className={`text-lg ${kh(book)}`}>{s.text}</span>
              {s.id === evidence && <span className="ml-auto shrink-0 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-black text-white">◂ look here</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function HintBar({ text, level, onHint }: { text: string; level: number; onHint(): void }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <p aria-live="polite" className="min-h-11 flex-1 rounded-2xl border border-line bg-surface-muted px-3 py-2.5 text-sm text-ink">{text || "Hints are free. Ask for one whenever you like."}</p>
      <button type="button" onClick={onHint} disabled={level >= 3} className={quiet}>
        <Lightbulb className="h-4 w-4" aria-hidden="true" />
        {level >= 3 ? "No more hints" : `Hint (${level + 1} of 3)`}
      </button>
    </div>
  );
}

function ChoiceQuestion({ book, item, onWrong, onRight, onHint }: {
  book: Passage;
  item: Extract<QuizItem, { part: "understand" | "words" }>;
  onWrong(given: string): void;
  onRight(given: string): void;
  onHint(level: number): void;
}) {
  const q = item.question;
  const pics = item.part === "words";
  const [wrong, setWrong] = useState<number[]>([]);
  const [out, setOut] = useState<number[]>([]);
  const [right, setRight] = useState(false);
  const [hint, setHint] = useState(0);
  const [hintText, setHintText] = useState("");
  const [fb, setFb] = useState("");

  const pick = (i: number) => {
    if (right || wrong.includes(i) || out.includes(i)) return;
    if (i === q.answer) {
      setRight(true);
      setFb("Yes! That’s right.");
      playSound("success");
      onRight(q.options[i]);
    } else {
      setWrong((w) => [...w, i]);
      setFb("Not quite — try another one.");
      playSound("error");
      onWrong(q.options[i]);
    }
  };
  const nextHint = () => {
    const level = hint + 1;
    setHint(level);
    onHint(level);
    if (level === 1) setHintText(pics ? "Say the word out loud. What does it look like?" : "The answer is in the story. Try Read again.");
    if (level === 2) setHintText(pics ? "Listen to the word again." : "Look at the sentence marked “look here”.");
    if (level === 3) {
      const candidate = q.options.map((_, i) => i).find((i) => i !== q.answer && !wrong.includes(i) && !out.includes(i));
      if (candidate !== undefined) setOut((o) => [...o, candidate]);
      setHintText("One wrong choice is ruled out — it is crossed out and marked ✕.");
    }
  };

  return (
    <div>
      <p className={`text-2xl font-extrabold leading-snug text-ink ${kh(book)}`}>
        {q.prompt}
        {pics && canSpeak(book.language) && (
          <button type="button" onClick={() => void say(q.kind === "vocab" ? q.word : "", book.language)} aria-label="Hear the word" className="ml-2 inline-grid h-11 w-11 place-items-center rounded-full border border-line bg-surface-muted align-middle">
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </p>
      <div className={`mt-4 grid gap-3 ${pics ? "grid-cols-3" : "sm:grid-cols-3"}`}>
        {q.options.map((o, i) => {
          const isWrong = wrong.includes(i) || out.includes(i);
          const isRight = right && i === q.answer;
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={isWrong || right}
              aria-label={pics ? `${o}${isWrong ? ", not this one" : isRight ? ", right" : ""}` : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-lg font-extrabold transition-colors ${
                isRight ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                : isWrong ? "border-rose-400 bg-rose-50 text-rose-800 line-through opacity-60 dark:bg-rose-950 dark:text-rose-200"
                : "border-line bg-surface text-ink hover:border-indigo-400"
              } ${kh(book)}`}
            >
              {pics ? <span className="h-20 w-full max-w-[140px]"><Picture name={o} /></span> : null}
              <span>
                {isRight ? "✓ " : isWrong ? "✕ " : ""}
                {pics ? "" : o}
              </span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className={`mt-3 min-h-6 text-sm font-bold ${right ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{fb}</p>
      <HintBar text={hintText} level={hint} onHint={nextHint} />
    </div>
  );
}

function SpellQuestion({ book, item, onWrong, onRight, onHint, onReadAgain }: {
  book: Passage;
  item: Extract<QuizItem, { part: "spell" }>;
  onWrong(given: string): void;
  onRight(given: string): void;
  onHint(level: number): void;
  onReadAgain(): void;
}) {
  const w = item.word;
  const ring = useMemo(() => ringOf(w), [w]);
  const [solved, setSolved] = useState(false);
  const [hint, setHint] = useState(0);
  const [hintText, setHintText] = useState("");
  const [traced, setTraced] = useState<string[]>([]);
  const [coach, setCoach] = useState<string | null>(null);
  const km = book.language === "km";
  const [before, after] = w.gapped.split("___");
  // The hint follows the trace: the next piece needed, or the first again when
  // the trace has gone wrong. A repeated tile (◌ា in សាលា) marks its next copy.
  const next = nextUnit(w.tiles, traced) ?? { unit: w.tiles[0], index: 0 };
  const seen = traced.slice(0, next.index).filter((t) => t === next.unit).length;
  const nextOnRing = ring.map((t, i) => (t === next.unit ? i : -1)).filter((i) => i >= 0)[seen] ?? ring.indexOf(next.unit);
  // Each piece's name, recorded by a person where there is a recording. Fetched
  // when the word comes up, so it is there offline next time.
  useUnitVoices();
  useEffect(() => {
    if (km) prefetchUnits(ring);
  }, [km, ring]);
  const shownHint =
    coach ??
    (hint === 2
      ? km ? `Next: ${unitCue(next.unit)} — it is marked on the ring.` : "The next letter is marked on the ring."
      : hint === 3
        ? km ? `The word is “${w.original}”: ${w.tiles.map(unitCue).join(" · ")}. Now trace it.` : `The word is “${w.original}”. Now trace it.`
        : hintText);
  const sentence = book.sentences.find((x) => x.id === w.sentenceId);
  const voice = !!sentence && sentenceSpeaks(book, sentence);
  const full = w.gapped.replace("___", w.original);

  const nextHint = () => {
    const level = hint + 1;
    setHint(level);
    onHint(level);
    if (level === 1) {
      if (voice) void say(full, book.language, sentence?.audio);
      setHintText(voice ? "Listen to the sentence, then say the missing word slowly." : "Read the sentence again, then say the missing word slowly.");
    }
    setCoach(null);
    if (km && level === 2) void sayUnit(next.unit);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div>
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">Finish the sentence</h2>
        <p className={`mt-2 text-2xl leading-loose text-ink ${kh(book)}`}>
          {before}
          <span data-gap className={`mx-1 inline-block min-w-20 border-b-4 text-center font-extrabold ${solved || hint >= 3 ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : traced.length ? "border-indigo-600 text-indigo-700 dark:text-indigo-300" : "border-indigo-600 text-transparent"}`}>
            {solved || hint >= 3 ? w.original : traced.length ? traced.join("") : " "}
          </span>
          {after}
        </p>
        {km && !solved && traced.length > 0 && <WordForming traced={traced} />}
        <div className="mt-3 flex flex-wrap gap-2">
          {voice && (
            <button type="button" onClick={() => void say(full, book.language, sentence?.audio)} className={quiet}>
              <Volume2 className="h-4 w-4" aria-hidden="true" />
              Read it to me
            </button>
          )}
          <button type="button" onClick={onReadAgain} className={quiet}>
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Whole story
          </button>
        </div>
        <HintBar text={shownHint} level={hint} onHint={nextHint} />
      </div>
      <LetterWheel
        tiles={ring}
        script={book.language === "km" ? "khmer" : "latin"}
        display={book.language === "km" ? unitLabel : undefined}
        label="Spell the missing word"
        minTiles={Math.min(2, w.tiles.length)}
        autoSubmitAt={w.tiles.length}
        highlight={hint >= 2 ? nextOnRing : null}
        disabled={solved}
        onTraceChange={(labels) => {
          // A piece just chosen is named aloud, as a class spells: "ផ … ជើងស …".
          if (km && labels.length > traced.length) void sayUnit(labels[labels.length - 1]);
          setTraced(labels);
          if (labels.length) setCoach(null);
        }}
        onSubmit={(labels) => {
          const given = labels.join("");
          if (spellsWord(labels, w.word, book.language)) {
            setSolved(true);
            playSound("success");
            onRight(given);
            return "correct";
          }
          playSound("error");
          onWrong(given);
          // The right pieces in the drawn order: say the rule, not just ✕.
          if (km) setCoach(orderFeedback(w.tiles, labels));
          return "wrong";
        }}
      />
    </div>
  );
}

/**
 * The Khmer word as it forms, tile by tile: large, with each piece named
 * beneath. When a piece lands on the left of what is there (◌ែ in front of
 * ផ្អ), the note says why — the drawn order and the spelled order part here.
 */
function WordForming({ traced }: { traced: readonly string[] }) {
  const reduce = useReducedMotion() ?? false;
  const note = drawnLeftNote(traced);
  return (
    <div data-word-forming aria-live="polite" className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3">
      <motion.span
        key={traced.length}
        initial={reduce ? false : { scale: 1.12, opacity: 0.55 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        className={`block origin-left text-4xl font-bold leading-snug text-ink ${KHMER}`}
      >
        {traced.join("")}
      </motion.span>
      <span className={`mt-1 block text-sm text-muted ${KHMER}`}>{traced.map(unitCue).join(" · ")}</span>
      {note && <span className={`mt-2 block rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100 ${KHMER}`}>{note}</span>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

function Results({ book, outcomes, earned, onShelf, onAgain }: { book: Passage; outcomes: Outcome[]; earned: { stars: number; xp: number } | null; onShelf(): void; onAgain(): void }) {
  const quiz = quizOf(book);
  const parts = tally(outcomes, quiz);
  const need = wordsToPractise(outcomes);
  return (
    <div>
      <h1 className={`text-2xl font-extrabold text-ink ${kh(book)}`}>You finished “{book.title}”</h1>
      {earned && (
        <p className="mt-1 text-sm text-muted">
          <span aria-label={`${earned.stars} of 3 stars`}>{"★".repeat(earned.stars)}{"☆".repeat(3 - earned.stars)}</span>
          {earned.xp > 0 && ` · +${earned.xp} XP`}
        </p>
      )}
      <p className="mt-3 text-sm text-muted">✓ first try · + needed a second try, a hint or Read again</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {parts.map((t) => (
          <div key={t.part} className="rounded-2xl border border-line bg-surface p-4">
            <div className="text-sm text-muted">{PART_LABEL[t.part]}</div>
            <div className="text-3xl font-extrabold text-ink">{t.firstTry}/{t.total}</div>
            <div className="text-xs text-muted">on the first try</div>
            <div className="mt-2 flex gap-1" aria-hidden="true">
              {outcomes.filter((o) => o.part === t.part).map((o, i) => (
                <span key={i} className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-black text-white ${isFirstTry(o) ? "bg-emerald-600" : "bg-purple-600"}`}>{isFirstTry(o) ? "✓" : "+"}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">Words to practise</h2>
        {need.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {need.map((w) => <span key={w} className={`rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 ${kh(book)}`}>{w}</span>)}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">Nothing — every answer was right first time.</p>
        )}
      </div>
      <div className="mt-3 rounded-2xl border border-line border-l-4 border-l-indigo-600 bg-surface p-4 text-sm text-ink">
        <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wider text-muted">What a parent will see</div>
        {parentSummary(book, outcomes, quiz)}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={onShelf} className={primary}>Back to the library</button>
        <button type="button" onClick={onAgain} className={quiet}>Read it again</button>
      </div>
    </div>
  );
}

export default LibraryPage;
