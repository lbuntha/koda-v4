import type React from "react";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LANG_KEY, readLang } from "./lang";
import { readPickFrom, useTodayContext } from "../components/learn/useToday";
import { ArrowLeft, BookOpen, Check, ChevronDown, Globe, Lightbulb, RotateCcw, Search, Star, Volume2, Zap } from "lucide-react";
import { LetterWheel } from "../components/wheel/LetterWheel";
import { ScoringAPI } from "../lib/scoring";
import { noteFor, type Language, type Passage } from "./data/passage";
import { ringOf } from "./data/spellingDeck";
import { useShelf } from "./bookStore";
import { spellsWord, tilesOf } from "./data/tiles";
import { unitLabel } from "./data/khmer";
import { levelName, drawnLeftNote, nextUnit, orderFeedback, spellingLevel, unitCue, type SpellingLevel } from "./data/khmerCoach";
import { motion, useReducedMotion } from "motion/react";
import { prefetchUnits, sayUnit, useUnitVoices } from "./unitVoices";
import { BookRecorder } from "./learning";
import { Picture } from "./Picture";
import { isPhoto } from "./photos";
import { LibraryProgress, type BookProgress } from "./progress";
import { OPTIONAL_PARTS, PARTS, notesQuiz, isFirstTry, minutesToRead, parentSummary, quizOf, reward, tally, wordsToPractise, type Outcome, type QuizItem } from "./session";
import { canSpeak, say, sentenceSpeaks, stop } from "./voice";
import { prefetchBook } from "./clips";
import { prefetchPhotos } from "./photos";
import { reportBook, type ReportReason } from "./api";
import { BookReader } from "./BookReader";
import { playSound } from "../utils/audio";
import { UIButton, UICard, UICarousel, UIMenu, UIMenuItem, UIGuideBubble, UIBookCard, UILinkButton, UIQuizToolbar, UIModal, UIMatchPairs, UIProgressBar, UISearchInput } from "../components/ui";
import { themeSystem } from "../lib/themeSystem";
import "./khmerFont";
import { useT } from "../lib/i18n";

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

/** Each book language in its own name, so a reader finds theirs whatever the app is set to. */
const LANGUAGE_NAMES: Record<Language, string> = { en: "English", km: "ភាសាខ្មែរ" };
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
const quiet = `${btn} border border-line bg-surface text-ink hover:border-indigo-400`;
/** Catalog layout knobs, named once so the page has no loose numbers. */
const TILE_MIN = "16rem";
/** A book card's width in a sideways row, and the grid a row opens into. */
const ROW_ITEM = "[&>li]:w-full sm:[&>li]:w-72";
const ROW_GRID = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
const kh = (p: { language: Language }) => (p.language === "km" ? KHMER : "");



export interface LibraryPageProps {
  /** Paid once, when a book is finished. The host owns the total. */
  onAwardXp?(amount: number): void;
  /** Lets the app shell give the reader the phone screen on mobile. */
  onReaderChange?(open: boolean): void;
  /** Whether a book is open at all (its page, the reader, the quiz, the results) — the phone hides its tab bar then. */
  onBookChange?(open: boolean): void;
  /** Shown inside Learn, which carries the page's title. */
  embedded?: boolean;
  /** Open this book's page straight away — a Today pick on Home. */
  openBookId?: string | null;
  /** The book above was opened (or is not on the shelf), so the host can forget it. */
  onOpened?(): void;
}

export function LibraryPage({ onAwardXp, onReaderChange, onBookChange, embedded = false, openBookId, onOpened }: LibraryPageProps) {
  const [screen, setScreen] = useState<Screen>("catalog");
  const [bookId, setBookId] = useState<string | null>(null);
  const [lang, setLangState] = useState<Language>(readLang);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [earned, setEarned] = useState<{ stars: number; xp: number } | null>(null);
  const shelf = useShelf();
  const book = shelf.find((p) => p.id === bookId) ?? null;
  // What "Next story" opens: the next book in this language not yet finished.
  const nextStory = book && screen === "results"
    ? shelf.find((p) => p.language === book.language && p.id !== book.id && LibraryProgress.get(p.id, p.rev)?.stage !== "done") ?? null
    : null;
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
  useEffect(() => {
    onBookChange?.(screen !== "catalog");
  }, [onBookChange, screen]);

  const open = useCallback((id: string) => {
    setBookId(id);
    go("book");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- go only touches refs and setters

  // A Today pick from Home: open its page once, then let the host forget it.
  useEffect(() => {
    if (!openBookId) return;
    if (shelf.some((b) => b.id === openBookId)) open(openBookId);
    onOpened?.();
  }, [openBookId]); // eslint-disable-line react-hooks/exhaustive-deps -- once per target, not per shelf change

  // scroll-mt: a phone's toolbar is sticky, and scrolling to the top must land
  // below it, or a book opens with its back link hidden under the bar.
  return (
    <div ref={top} className={`mx-auto w-full max-w-5xl ${screen === "read" || screen === "quiz" ? "px-0 pb-4" : "scroll-mt-14 px-2 pb-24 rail:scroll-mt-0"} pt-4 sm:px-6`} data-koda-library>
      {screen === "catalog" && <Catalog shelf={shelf} lang={lang} onLang={setLang} onOpen={open} embedded={embedded} />}
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
            const r = reward(result, quiz.length, ScoringAPI.current(), book.xp);
            const firstTry = tally(result, quiz).reduce((n, part) => n + part.firstTry, 0);
            LibraryProgress.set(book.id, { stage: "done", rev: book.rev, firstTry, total: quiz.length, stars: r.stars });
            if (r.xp > 0) onAwardXp?.(r.xp);
            setOutcomes(result);
            setEarned({ stars: r.stars, xp: r.xp });
            go("results");
          }}
        />
      )}
      {book && screen === "results" && (
        <Results book={book} outcomes={outcomes} earned={earned} next={nextStory} onNext={open} onShelf={() => go("catalog")} onAgain={() => go("read")} />
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
  const { t: tr } = useT();
  const [screen, setScreen] = useState<"read" | "quiz" | "results">("read");
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  useEffect(() => () => stop(), []);
  return (
    <div data-koda-library data-preview>
      <p className="mb-3 rounded-2xl border border-dashed border-indigo-400 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100">
        {tr("library.previewNote")}
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
  const version = useSyncExternalStore(LibraryProgress.subscribe, LibraryProgress.version, LibraryProgress.version);
  // Stable until progress changes, so memoised tiles are not re-rendered by unrelated state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((p: Passage) => LibraryProgress.get(p.id, p.rev), [version]);
}

const wordCounts = new WeakMap<Passage, number>();
/** A book's word count, worked out once per book rather than on every render. */
const wordsIn = (book: Passage): number => {
  let n = wordCounts.get(book);
  if (n === undefined) {
    n = book.sentences.reduce((total, sentence) => total + sentence.words.length, 0);
    wordCounts.set(book, n);
  }
  return n;
};
const categoryOf = (p: Passage) => p.category ?? "Everyday";

function Cover({ book, size = "shelf", showTitle = size === "page" }: { book: Passage; size?: "shelf" | "page"; showTitle?: boolean }) {
  const { t: tr } = useT();
  const shelf = size === "shelf";
  return (
    <span
      className={`relative grid ${size === "page" ? "aspect-[4/3] sm:aspect-[3/4]" : "aspect-[5/2] sm:aspect-[2/1]"} ${shelf ? "bg-gradient-to-br from-slate-50 to-indigo-100 p-3 sm:p-4" : "content-end overflow-hidden rounded-2xl bg-gradient-to-br p-3 shadow-md"} ${COVER[book.category ?? ""] ?? "from-indigo-500 to-indigo-800"} ${size === "page" ? "w-full max-w-none sm:max-w-[220px]" : "w-full"}`}
    >
      <span className={`absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-[11px] font-black ${shelf ? "bg-emerald-700 text-white" : "bg-white/95 text-slate-900"}`}>{tr("library.level", { level: book.band })}</span>
      {shelf && <span className="absolute right-3 top-3 z-10 rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-black text-slate-700">{book.category ?? "Story"}</span>}
      <span className={`absolute ${shelf ? "inset-0" : "inset-x-[14%] top-[13%] aspect-square rounded-full bg-white/90 p-[10%]"}`}>
        <Picture name={book.picture} />
      </span>
      {!shelf && showTitle && <span className={`relative text-[15px] font-extrabold leading-tight text-white drop-shadow ${kh(book)}`}>{book.title}</span>}
    </span>
  );
}

function Catalog({ shelf, lang, onLang, onOpen, embedded }: { shelf: readonly Passage[]; lang: Language; onLang(l: Language): void; onOpen(id: string): void; embedded: boolean }) {
  const { t: tr } = useT();
  const progressOf = useProgress();
  const todayContext = useTodayContext();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const deferredQ = useDeferredValue(q);
  const query = deferredQ.trim().toLowerCase();
  const mine = useMemo(() => shelf.filter((p) => p.language === lang), [shelf, lang]);
  const cats = useMemo(() => [...new Set(mine.map(categoryOf))], [mine]);
  const active = cat === "All" || cats.includes(cat) ? cat : "All";
  const list = useMemo(
    () => mine.filter((p) => (active === "All" || categoryOf(p) === active) && (!query || p.title.toLowerCase().includes(query))),
    [mine, active, query],
  );
  const reading = list
    .filter((p) => {
      const st = progressOf(p)?.stage;
      return st === "read" || st === "quiz";
    })
    .sort((a, b) => (progressOf(b)?.updatedAt ?? 0) - (progressOf(a)?.updatedAt ?? 0));
  // A book already under "Continue reading" is not listed a second time below it.
  const readingIds = new Set(reading.map((p) => p.id));
  /* The banner is Today's Read pick — the same one Home offers: the book being
     read most recently, else a new one that suits the child and goes with what
     they did lately. The first unopened book is the fallback. */
  const hero = readPickFrom(shelf, lang, todayContext)?.book ?? reading[0] ?? mine.find((p) => !progressOf(p)) ?? null;
  const browsing = !query && active === "All";
  const belowReading = reading.filter((p) => p.id !== hero?.id);
  const belowShelves = cats
    .map((c) => [c, list.filter((p) => categoryOf(p) === c && !readingIds.has(p.id))] as const)
    .filter(([, books]) => books.length > 0);
  const other: Language = lang === "en" ? "km" : "en";
  const otherCount = useMemo(() => shelf.filter((p) => p.language === other).length, [shelf, other]);

  /** A searched or filtered list: everything at once, as a grid. */
  const gridRow = (title: string, books: readonly Passage[], note?: string) =>
    books.length ? (
      <section key={title} className="mt-6 sm:mt-8">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-extrabold text-ink">{title}</h2>
          {note && <span className="text-xs text-muted">{note}</span>}
        </div>
        <ul className="grid grid-cols-1 gap-3 sm:gap-4 sm:[grid-template-columns:repeat(auto-fill,minmax(var(--tile-min),1fr))]" style={{ "--tile-min": TILE_MIN } as React.CSSProperties}>
          {books.map((b) => (
            <li key={b.id}>
              <BookTile book={b} progress={progressOf(b)} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  /** Browsing: one row a shelf, scrolling sideways, opened out on "See all". */
  const shelfRow = (title: string, books: readonly Passage[]) =>
    books.length ? (
      <UICarousel key={title} title={title} count={books.length} itemClass={ROW_ITEM} gridClass={ROW_GRID} seeAllAfter={3}
        className="mt-6 sm:mt-8 [content-visibility:auto] [contain-intrinsic-size:auto_22rem]">
        {books.map((b) => (
          <li key={b.id}>
            <BookTile book={b} progress={progressOf(b)} onOpen={onOpen} />
          </li>
        ))}
      </UICarousel>
    ) : null;

  /* Beside the search rather than alone in the header, where on a phone it
     left a band of empty space above the banner. */
  const languageMenu = (
    <UIMenu align="end" className="w-44" trigger={({ toggle, isOpen }) => (
      <UIButton type="button" size="sm" variant="secondary" className="rounded-full" icon={<Globe className="h-4 w-4" />} iconRight={<ChevronDown className="h-4 w-4" />}
        aria-haspopup="menu" aria-expanded={isOpen} aria-label={`${tr("library.bookLanguageLabel")}: ${LANGUAGE_NAMES[lang]}`} onClick={toggle}>
        <span className={lang === "km" ? KHMER : ""}>{LANGUAGE_NAMES[lang]}</span>
      </UIButton>
    )}>
      {({ close }) => (["en", "km"] as const).map((l) => (
        <UIMenuItem key={l} isActive={lang === l} onSelect={() => { onLang(l); close(); }}>
          <span className={l === "km" ? KHMER : ""}>{LANGUAGE_NAMES[l]}</span>
        </UIMenuItem>
      ))}
    </UIMenu>
  );

  return (
    /* Inside Learn the switcher above already spaces the page; the banner needs no top margin of its own. */
    <div className={embedded ? "sm:[&>section:first-child]:mt-0" : undefined}>
      {!embedded && (
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            {/* Below `rail:` the app bar already names the page; the heading stays for screen readers. */}
            <h1 className="sr-only text-3xl font-extrabold tracking-tight text-ink rail:not-sr-only">{tr("nav.library")}</h1>
            <p className="hidden text-sm text-muted sm:block">{tr("library.tagline")}</p>
          </div>
        </header>
      )}

      {browsing && hero && <LibraryHero book={hero} reading={readingIds.has(hero.id)} progress={progressOf(hero)} onOpen={onOpen} />}

      <div className="mt-4 flex items-center justify-end gap-2 sm:mt-5">
        {mine.length > 0 && (
          <UISearchInput label={tr("library.search")} value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
        )}
        <div className="shrink-0">{languageMenu}</div>
      </div>

      {cats.length > 1 && (
        <div role="group" aria-label={tr("library.category")} className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {["All", ...cats].map((c) => (
            <UIButton key={c} type="button" size="sm" variant={active === c ? "primary" : "secondary"} aria-pressed={active === c} onClick={() => setCat(c)} className="shrink-0 rounded-full">
              {c === "All" ? tr("library.all") : c}
            </UIButton>
          ))}
        </div>
      )}

      {mine.length === 0 ? (
        <ShelfNote
          title={tr("library.shelfEmpty.title", { language: tr(`library.bookLanguage.${lang}`) })}
          note={tr("library.shelfEmpty.note")}
          other={otherCount ? { label: LANGUAGE_NAMES[other], count: otherCount, onSwitch: () => onLang(other) } : null}
        />
      ) : query ? (
        gridRow(tr("library.resultsFor", { query: deferredQ.trim() }), list, tr("library.books", { count: list.length })) ?? (
          <ShelfNote icon="search" title={tr("library.noMatchFor", { query: deferredQ.trim() })} note={tr("library.noMatchNote")} action={{ label: tr("library.clearSearch"), onClick: () => setQ("") }} />
        )
      ) : !browsing ? (
        gridRow(active, list, tr("library.books", { count: list.length }))
      ) : (
        <>
          {/* The banner already shows the book read last; the row is for the rest. */}
          {shelfRow(tr("library.continueReading"), belowReading)}
          {belowShelves.map(([c, books]) => shelfRow(c, books))}
          {/* Everything there is is already in the banner: say so, rather than leave a blank page. */}
          {belowReading.length === 0 && belowShelves.length === 0 && (
            <ShelfNote
              icon="done"
              title={tr("library.allHere.title", { language: tr(`library.bookLanguage.${lang}`) })}
              note={tr("library.allHere.note")}
              other={otherCount ? { label: LANGUAGE_NAMES[other], count: otherCount, onSwitch: () => onLang(other) } : null}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * What the shelf says instead of going blank: no books in this language yet,
 * nothing more beyond the banner, or a search with no match — each with the one
 * thing worth doing next.
 */
function ShelfNote({ title, note, icon = "book", other = null, action }: {
  title: string; note: string; icon?: "book" | "done" | "search";
  other?: { label: string; count: number; onSwitch(): void } | null;
  action?: { label: string; onClick(): void };
}) {
  const { t: tr } = useT();
  const Icon = icon === "search" ? Search : icon === "done" ? Check : BookOpen;
  return (
    <section className="mt-6 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center sm:mt-8">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300" aria-hidden="true">
        <Icon className="h-8 w-8" />
      </span>
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      <p className="max-w-sm text-sm text-muted">{note}</p>
      {other && (
        <UIButton type="button" variant="secondary" icon={<Globe className="h-4 w-4" />} onClick={other.onSwitch}>
          <span className={other.label === LANGUAGE_NAMES.km ? KHMER : ""}>{tr("library.readIn", { language: other.label, count: other.count })}</span>
        </UIButton>
      )}
      {action && <UIButton type="button" variant="secondary" onClick={action.onClick}>{action.label}</UIButton>}
    </section>
  );
}

/** The book to carry on with, or a new one to start: large, one tap to its page. */
function LibraryHero({ book, reading, progress, onOpen }: { book: Passage; reading: boolean; progress: BookProgress | null; onOpen(id: string): void }) {
  const { t: tr } = useT();
  /* The shared banner violet, as Learn's and Trace's — not the book's category colour. */
  const tone = themeSystem.heroGradient;
  return (
    <section className={`relative mt-0 grid overflow-hidden rounded-3xl sm:mt-5 text-white sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] ${tone}`} aria-label={tr(reading ? "library.hero.carryOn" : "library.hero.tryNew")}>
      <div className="relative z-10 flex flex-col justify-center gap-3 p-5 pt-0 sm:p-8">
        <span className="text-xs font-extrabold uppercase tracking-widest text-white/80">{tr(reading ? "library.hero.carryOn" : "library.hero.tryNew")}</span>
        <h2 className={`text-3xl font-extrabold leading-tight text-white sm:text-4xl ${kh(book)}`}>{book.title}</h2>
        <p className="text-sm font-semibold text-white/85">
          {tr("library.level", { level: book.band })} · {tr("library.minRead", { count: minutesToRead(book) })}
          {book.category ? ` · ${book.category}` : ""}
          {reading && progress?.stage === "quiz" ? ` · ${tr("library.inProgress")}` : ""}
        </p>
        {/* Medium and white-on-violet, as Trace's banner; the full width of a phone. */}
        <div className="mt-1">
          <UIButton variant="light" icon={<BookOpen aria-hidden="true" />} onClick={() => onOpen(book.id)} className="w-full sm:w-auto">
            {tr(reading ? "library.hero.keepReading" : "library.hero.startReading")}
          </UIButton>
        </div>
      </div>
      {/* A photo fills its side and fades into the colour, a poster rather than a
          picture in a box; on a phone it is a band across the top. A drawing
          floats large and whole — cropping one cuts off what it shows. */}
      {isPhoto(book.picture) ? (
        <span className="relative order-first block h-44 [mask-image:linear-gradient(to_bottom,black_55%,transparent)] sm:order-none sm:h-auto sm:min-h-64 sm:[mask-image:linear-gradient(to_right,transparent,black_35%)]" aria-hidden="true">
          <Picture name={book.picture} fill />
        </span>
      ) : (
        <span className="relative order-first flex h-40 items-center justify-center p-4 sm:order-none sm:h-auto sm:min-h-64 sm:p-8" aria-hidden="true">
          <span className="block h-full w-full max-w-56 drop-shadow-lg"><Picture name={book.picture} /></span>
        </span>
      )}
    </section>
  );
}

const BookTile = memo(function BookTile({ book, progress, onOpen }: { book: Passage; progress: BookProgress | null; onOpen(id: string): void }) {
  const { t: tr } = useT();
  const st = progress?.stage;
  const label = st === "done" ? `${tr("library.finished")}${progress?.total ? ` ${progress.firstTry}/${progress.total}` : ""}` : st ? tr("library.inProgress") : tr("lessonCard.tone.advance");
  const wordCount = wordsIn(book);
  return (
    <UIBookCard
      cover={<Cover book={book} />}
      title={<span className={kh(book)}>{book.title}</span>}
      meta={<>{tr("library.minRead", { count: minutesToRead(book) })}<span className="hidden sm:inline"> · {tr("library.words", { count: wordCount })}</span></>}
      status={<span className={st === "done" ? "text-emerald-700 dark:text-emerald-400" : undefined}>{label}</span>}
      quizLabel={tr("library.quizzes", { count: book.questions.length })}
      hasAudio={book.sentences.some((sentence) => Boolean(sentence.audio))}
      onClick={() => onOpen(book.id)}
      ariaLabel={`${book.title}. ${tr("library.level", { level: book.band })}. ${label}.`}
    />
  );
});

/* -------------------------------------------------------------------------- */
/* Book page                                                                   */
/* -------------------------------------------------------------------------- */

function BackBar({ label, onBack, right, mobileSafe = false }: { label: string; onBack(): void; right?: ReactNode; mobileSafe?: boolean }) {
  return (
    <div className={`${mobileSafe ? "mobile-reader-toolbar" : ""} mb-4`}>
      <div className={`${mobileSafe ? "mobile-reader-toolbar-row" : ""} flex flex-wrap items-center justify-between gap-2`}>
        <UILinkButton type="button" onClick={onBack} className="text-base">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {label}
        </UILinkButton>
        {right}
      </div>
    </div>
  );
}

function BookPage({ book, onBack, onRead }: { book: Passage; onBack(): void; onRead(): void }) {
  const { t: tr } = useT();
  const progress = useProgress()(book);
  const [clips, setClips] = useState<{ ready: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    setSaving(true);
    // Reported as it goes, not only when it finishes: the first save of a book
    // on a slow connection takes a while, and a line that counts up is the
    // difference between "it is working" and "it is broken".
    void prefetchBook(book, (p) => live && setClips(p))
      .then((r) => { if (live) { setClips(r); setSaving(false); } });
    void prefetchPhotos(book); // so its photos show on the bus too
    return () => { live = false; };
  }, [book]);
  // The Words questions' words, then any other word the author gave a reading or opposite.
  const vocab = [...new Set([...book.questions.flatMap((q) => (q.kind === "vocab" ? [q.word] : [])), ...Object.keys(book.wordNotes ?? {}).filter((w) => noteFor(book, w))])];
  const count = (k: string) => book.questions.filter((q) => q.kind === k).length;
  // A Khmer book's spelling level: its hardest spelling word.
  const levels = book.language === "km" ? book.questions.flatMap((q) => (q.kind === "spell" ? [spellingLevel(tilesOf(q.word, "km"))] : [])) : [];
  const level = levels.length ? (Math.max(...levels) as SpellingLevel) : null;
  const wordCount = wordsIn(book);
  const progressLabel = progress?.stage === "done" ? `${tr("library.finished")}${progress.total ? ` ${progress.firstTry}/${progress.total}` : ""}` : progress ? tr("library.inProgress") : tr("lessonCard.tone.advance");
  return (
    <div>
      <BackBar label={tr("nav.library")} onBack={onBack} />
      <div className="grid gap-6 sm:grid-cols-[220px_minmax(0,1fr)]">
        <UIBookCard
          cover={<Cover book={book} />}
          title={<span className={kh(book)}>{book.title}</span>}
          meta={`${tr("library.minRead", { count: minutesToRead(book) })} · ${tr("library.words", { count: wordCount })}`}
          status={<span className={progress?.stage === "done" ? "text-emerald-700 dark:text-emerald-400" : undefined}>{progressLabel}</span>}
          quizLabel={tr("library.quizzes", { count: book.questions.length })}
          hasAudio={book.sentences.some((sentence) => Boolean(sentence.audio))}
          showAction={false}
          className="h-fit self-start"
          onClick={onRead}
          ariaLabel={`${book.title}. ${progressLabel}.`}
        />
        <div>
          <h1 className="sr-only">{book.title}</h1>
          <div className="mt-4">
            <UIButton type="button" onClick={onRead} icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}>
              {progress?.stage === "done" ? tr("reader.readAgain") : progress ? tr("library.keepReading") : tr("library.read")}
            </UIButton>
          </div>
          <ol className="mt-5 grid gap-2">
            {[
              [tr("library.step.read"), progress !== null],
              [tr("library.step.understand", { count: count("comprehension") }), progress?.stage === "done"],
              ...(count("match") ? [[tr("library.step.match", { count: count("match") }), progress?.stage === "done"] as const] : []),
              [tr("library.step.words", { count: count("vocab") }), progress?.stage === "done"],
              ...(["opposite", "reading"] as const).flatMap((kind) => {
                const pairs = notesQuiz(book, kind).reduce((n, q) => n + q.pairs.length, 0);
                return pairs ? [[tr(`library.step.${kind}`, { count: pairs }), progress?.stage === "done"] as const] : [];
              }),
              [
                tr("library.step.spell", { count: count("spell") }) +
                  (level ? ` · ${tr("library.step.spellLevel", { level, name: levelName(level) })}` : ""),
                progress?.stage === "done",
              ],
            ].map(([text, done], i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 text-ink">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${done ? "bg-emerald-600 text-white" : "bg-surface-muted text-ink"}`}>{done ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}</span>
                {text}
                {done && <span className="sr-only">({tr("skillCard.done")})</span>}
              </li>
            ))}
          </ol>
          {vocab.length > 0 && (
            <div className="mt-4">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">{tr("library.wordsYouWillMeet")}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {vocab.map((w) => {
                  const note = noteFor(book, w);
                  return (
                    <span key={w} className={`rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 ${kh(book)}`}>
                      {w}
                      {note?.reading && <span className="ml-1.5 font-semibold text-indigo-600 dark:text-indigo-300">({note.reading})</span>}
                      {note?.opposite && <span className="ml-1.5 font-semibold text-indigo-600 dark:text-indigo-300">≠ {note.opposite}</span>}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {clips && clips.total > 0 && (
            <p className="mt-4 text-xs font-bold text-muted" aria-live="polite">
              {saving && clips.ready < clips.total
                ? `🔊 ${tr("library.voice.saving", { ready: clips.ready, total: clips.total })}`
                : clips.ready === clips.total
                  ? `🔊 ${tr("library.voice.saved")}`
                  : `🔊 ${tr("library.voice.partial", { ready: clips.ready, total: clips.total })}`}
            </p>
          )}
          {book.provenance && <p className="mt-4 text-xs text-muted">{book.provenance}</p>}
          <ReportBook book={book} />
        </div>
      </div>
    </div>
  );
}

/* Worded under `library.report.reason.<reason>`. */
const REASONS: ReportReason[] = ["wrong_in_story", "wrong_question", "not_for_children", "other"];

/**
 * "Report a problem" — for a grown-up who spots something wrong. Quiet on
 * purpose: it is a link, not a button a child is drawn to, and it goes to the
 * authors in Library Studio, not to anyone else.
 */
function ReportBook({ book }: { book: Passage }) {
  const { t: tr } = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("wrong_question");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"" | "sending" | "sent" | "failed">("");
  if (state === "sent") return <p role="status" className="mt-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">{tr("library.report.thanks")}</p>;
  if (!open) {
    return (
      <button type="button" className="mt-3 min-h-11 text-xs font-bold text-muted underline underline-offset-4" onClick={() => setOpen(true)}>
        {tr("library.report.open")}
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
        <legend className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted">{tr("library.report.whatIsWrong")}</legend>
        {REASONS.map((r) => (
          <label key={r} className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input type="radio" name="report-reason" className="h-5 w-5 accent-indigo-600" checked={reason === r} onChange={() => setReason(r)} />
            {tr(`library.report.reason.${r}`)}
          </label>
        ))}
      </fieldset>
      <label className="text-sm text-ink">
        <span className="mb-1 block text-xs font-extrabold uppercase tracking-wider text-muted">{tr("library.report.anythingToAdd")}</span>
        <textarea className="min-h-16 w-full rounded-xl border border-line bg-surface px-3 py-2 text-ink" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {state === "failed" && <p role="alert" className="text-sm font-bold text-rose-700 dark:text-rose-400">{tr("library.report.failed")}</p>}
      <div className="flex gap-2">
        <UIButton type="submit" size="sm" isLoading={state === "sending"}>{state === "sending" ? tr("account.sending") : tr("library.report.send")}</UIButton>
        <UILinkButton type="button" onClick={() => setOpen(false)}>{tr("common.cancel")}</UILinkButton>
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

/* Worded under `library.part.<part>`. */

function Quiz({ book, onLeave, onFinish, preview = false }: { book: Passage; onLeave(): void; onFinish(o: Outcome[]): void; preview?: boolean }) {
  const { t: tr } = useT();
  const quiz = useMemo(() => quizOf(book), [book]);
  const recorder = useMemo(() => new BookRecorder(book), [book]);
  const [i, setI] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const [sheet, setSheet] = useState<{ evidence: string | null } | null>(null);
  const [hintHost, setHintHost] = useState<HTMLDivElement | null>(null);
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
      const r = reward(done, quiz.length, ScoringAPI.current(), book.xp);
      recorder.complete(r.stars, r.xp);
      onFinish(done);
    }
  };

  const doneIn = (part: QuizItem["part"]) => outcomes.filter((o) => o.part === part).length;
  const parts = PARTS.map((p) => ({ p, n: quiz.filter((q) => q.part === p).length })).filter(({ p, n }) => n > 0 || !OPTIONAL_PARTS.has(p));

  return (
    <div>
      <div className="mb-4">
        <UIQuizToolbar onBack={onLeave} onReadAgain={() => readAgain()} hintHostRef={setHintHost} />
      </div>
      <div className={`mb-4 grid gap-2 ${parts.length > 3 ? "grid-cols-4" : "grid-cols-3"}`} aria-label={tr("library.progress")}>
        {parts.map(({ p, n }) => (
          <div key={p}>
            <div className={`mb-1 flex justify-between gap-1.5 text-[11px] font-extrabold uppercase tracking-wide ${item?.part === p ? "text-ink" : "text-muted"}`}>
              <span className="min-w-0 truncate">{tr(`library.part.${p}`)}</span>
              <span className="shrink-0 tabular-nums">{doneIn(p)}/{n}</span>
            </div>
            <UIProgressBar value={doneIn(p)} max={n} label={tr(`library.part.${p}`)} />
          </div>
        ))}
      </div>

      {item && (item.part === "match" || item.part === "opposite" || item.part === "reading") && (
        <MatchQuestionView
          key={i}
          book={book}
          item={item}
          onWrong={(given) => { cur.current!.wrong++; recorder.answered(item, false, given); }}
          onRight={(given) => { recorder.answered(item, true, given); setTimeout(correct, 900); }}
          onHint={(level) => {
            cur.current!.hints = Math.max(cur.current!.hints, level);
            recorder.support("hint", level);
            if (level === 2) readAgain();
          }}
          hintHost={hintHost}
        />
      )}
      {item && (item.part === "understand" || item.part === "words") && (
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
          hintHost={hintHost}
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
          hintHost={hintHost}
        />
      )}

      {sheet && <StorySheet book={book} evidence={sheet.evidence} onClose={() => setSheet(null)} />}
    </div>
  );
}

function StorySheet({ book, evidence, onClose }: { book: Passage; evidence: string | null; onClose(): void }) {
  const { t: tr } = useT();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <UIModal isOpen onClose={onClose} title={book.title} ariaLabel={tr("library.readAgainTitle", { title: book.title })} maxWidth="max-w-3xl" tone="plain">
      <ol className="grid gap-2">
        {book.sentences.map((s) => (
          <li key={s.id} className={`flex items-center gap-3 px-1 py-2.5 ${s.id === evidence ? "font-semibold text-indigo-900 dark:text-indigo-100" : "text-ink"}`}>
            <span className={`text-lg ${kh(book)}`}>{s.text}</span>
            {s.id === evidence && <span className="ml-auto shrink-0 rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-black text-white">◂ {tr("library.lookHere")}</span>}
          </li>
        ))}
      </ol>
    </UIModal>
  );
}

function HintBar({ text, level, onHint, host }: { text: string; level: number; onHint(): void; host: HTMLElement | null }) {
  const { t: tr } = useT();
  const label = level >= 3 ? tr("library.hint.none") : tr("library.hint.button", { n: level + 1, total: 3 });
  const action = (
    <button type="button" onClick={onHint} disabled={level >= 3} className={`${quiet} !w-11 !px-0`} aria-label={label} title={label}>
      <Lightbulb className="h-4 w-4" aria-hidden="true" />
    </button>
  );
  return (
    <div className={text ? "mt-4" : ""}>
      {host && createPortal(action, host)}
      {text && <UIGuideBubble compact title={tr("library.hint.title")} message={text} tail="up" />}
    </div>
  );
}

/** Once the word is found: how to read it and its opposite, when the author gave them. */
export function WordNotes({ book, word, className = "mt-2" }: { book: Passage; word: string; className?: string }) {
  const { t: tr } = useT();
  const note = noteFor(book, word);
  if (!note) return null;
  return (
    <dl className={`${className} grid gap-1 rounded-2xl bg-indigo-50 px-4 py-3 text-ink dark:bg-indigo-950 ${kh(book)}`}>
      {note.reading && (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-sm font-bold text-muted">{tr("library.word.readAs", { word })}</dt>
          <dd className="text-xl font-extrabold">{note.reading}</dd>
        </div>
      )}
      {note.opposite && (
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-sm font-bold text-muted">{tr("library.word.opposite")}</dt>
          <dd className="text-xl font-extrabold">{note.opposite}</dd>
        </div>
      )}
    </dl>
  );
}

function ChoiceQuestion({ book, item, onWrong, onRight, onHint, hintHost }: {
  book: Passage;
  item: Extract<QuizItem, { part: "understand" | "words" }>;
  onWrong(given: string): void;
  onRight(given: string): void;
  onHint(level: number): void;
  hintHost: HTMLElement | null;
}) {
  const { t: tr } = useT();
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
      setFb(tr("library.feedback.right"));
      playSound("success");
      onRight(q.options[i]);
    } else {
      setWrong((w) => [...w, i]);
      setFb(tr("library.feedback.wrong"));
      playSound("error");
      onWrong(q.options[i]);
    }
  };
  const nextHint = () => {
    const level = hint + 1;
    setHint(level);
    onHint(level);
    if (level === 1) setHintText(pics ? tr("library.hint.sayWord") : tr("library.hint.inStory"));
    if (level === 2) setHintText(pics ? tr("library.hint.listenWord") : tr("library.hint.lookHere"));
    if (level === 3) {
      const candidate = q.options.map((_, i) => i).find((i) => i !== q.answer && !wrong.includes(i) && !out.includes(i));
      if (candidate !== undefined) setOut((o) => [...o, candidate]);
      setHintText(tr("library.hint.ruledOut"));
    }
  };

  return (
    <div>
      <p className={`text-2xl font-extrabold leading-snug text-ink ${kh(book)}`}>
        {q.prompt}
        {pics && canSpeak(book.language) && (
          <button type="button" onClick={() => void say(q.kind === "vocab" ? q.word : "", book.language)} aria-label={tr("library.hearWord")} className="ml-2 inline-grid h-11 w-11 place-items-center rounded-full border border-line bg-surface-muted align-middle">
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
              aria-label={pics ? `${o}${isWrong ? `, ${tr("library.notThisOne")}` : isRight ? `, ${tr("library.right")}` : ""}` : undefined}
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
      {right && q.kind === "vocab" && <WordNotes book={book} word={q.word} />}
      <HintBar text={hintText} level={hint} onHint={nextHint} host={hintHost} />
    </div>
  );
}

/**
 * The answers' order on screen: shuffled the same way every time this question
 * is shown, and never left in the order they were written — or the answer to
 * the first question would always be the first answer.
 */
export function matchOrder(id: string, n: number): number[] {
  let seed = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) || 1;
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (n > 1 && order.every((v, i) => v === i)) order.push(order.shift()!);
  return order;
}

/** "Match each question to its answer": the shared board, with this quiz's sounds, hints and scoring. */
function MatchQuestionView({ book, item, onWrong, onRight, onHint, hintHost }: {
  book: Passage;
  item: Extract<QuizItem, { part: "match" | "opposite" | "reading" }>;
  onWrong(given: string): void;
  onRight(given: string): void;
  onHint(level: number): void;
  hintHost: HTMLElement | null;
}) {
  const { t: tr } = useT();
  const q = item.question;
  const order = useMemo(() => matchOrder(q.id, q.pairs.length), [q.id, q.pairs.length]);
  const [joined, setJoined] = useState<Record<number, number>>({});
  const [hint, setHint] = useState(0);
  const [hintText, setHintText] = useState("");
  const [fb, setFb] = useState("");
  const done = Object.keys(joined).length === q.pairs.length;

  const join = (l: number) => {
    const next = { ...joined, [l]: Object.keys(joined).length };
    setJoined(next);
    setFb("");
    if (Object.keys(next).length === q.pairs.length) {
      setFb(tr("library.feedback.right"));
      playSound("success");
      onRight(q.pairs.map((pr) => `${pr.left} → ${pr.right}`).join("; "));
    } else playSound("pop");
  };
  const miss = (l: number, r: number) => {
    setFb(tr("library.feedback.wrong"));
    playSound("error");
    onWrong(`${q.pairs[l].left} → ${q.pairs[r].right}`);
  };
  const nextHint = () => {
    const level = hint + 1;
    setHint(level);
    onHint(level);
    if (level === 1) setHintText(tr("library.hint.matchTap"));
    if (level === 2) setHintText(tr(item.part === "match" ? "library.hint.inStory" : "library.hint.tapWord"));
    if (level === 3) {
      const open = q.pairs.findIndex((_, i) => !(i in joined));
      if (open >= 0) join(open);
      setHintText(tr("library.hint.matchJoined"));
    }
  };

  return (
    <div>
      <p className={`text-2xl font-extrabold leading-snug text-ink ${kh(book)}`}>{q.prompt}</p>
      <p className="mt-1 text-sm text-muted">{tr(item.part === "match" ? "library.matchHow" : "library.notesQuiz.how")}</p>
      <div className="mt-4">
        <UIMatchPairs
          pairs={q.pairs}
          order={order}
          joined={joined}
          onJoin={join}
          onMiss={miss}
          leftLabel={tr(item.part === "match" ? "library.matchQuestions" : "library.notesQuiz.words")}
          rightLabel={tr(item.part === "opposite" ? "library.notesQuiz.opposites" : item.part === "reading" ? "library.notesQuiz.readings" : "library.matchAnswers")}
          textClassName={kh(book)}
          disabled={done}
        />
      </div>
      <p aria-live="polite" className={`mt-3 min-h-6 text-sm font-bold ${done ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>{fb}</p>
      <HintBar text={hintText} level={hint} onHint={nextHint} host={hintHost} />
    </div>
  );
}

function SpellQuestion({ book, item, onWrong, onRight, onHint, hintHost }: {
  book: Passage;
  item: Extract<QuizItem, { part: "spell" }>;
  onWrong(given: string): void;
  onRight(given: string): void;
  onHint(level: number): void;
  hintHost: HTMLElement | null;
}) {
  const { t: tr } = useT();
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
      ? km ? tr("library.hint.nextUnit", { unit: unitCue(next.unit) }) : tr("library.hint.nextLetter")
      : hint === 3
        ? km
          ? tr("library.hint.wordIsUnits", { word: w.original, units: w.tiles.map(unitCue).join(" · ") })
          : tr("library.hint.wordIs", { word: w.original })
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
      setHintText(voice ? tr("library.hint.listenSentence") : tr("library.hint.readSentence"));
    }
    setCoach(null);
    if (km && level === 2) void sayUnit(next.unit);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
      <div>
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">{tr("library.finishSentence")}</h2>
        <p className={`mt-2 text-2xl leading-loose text-ink ${kh(book)}`}>
          {voice && (
            <button type="button" onClick={() => void say(full, book.language, sentence?.audio)} aria-label={tr("library.readSentenceToMe")} title={tr("library.readSentenceToMe")} className="mr-2 inline-grid h-11 w-11 place-items-center rounded-full border border-line bg-surface-muted align-middle">
              <Volume2 className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
          {before}
          {/*
            * The blank is as wide as the finished word from the start.
            *
            * A blank that grows letter by letter re-wraps the sentence, and the
            * sentence sits above the ring: the ring then moves while a finger is
            * still on it. So the word itself holds the space open, unseen, and
            * the letters land on top of it.
            */}
          <span className="mx-1 inline-grid min-w-20 align-baseline">
            <span aria-hidden="true" className="invisible col-start-1 row-start-1 px-1 font-extrabold">{w.original}</span>
            <span data-gap className={`col-start-1 row-start-1 border-b-4 text-center font-extrabold ${solved || hint >= 3 ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : traced.length ? "border-indigo-600 text-indigo-700 dark:text-indigo-300" : "border-indigo-600 text-transparent"}`}>
              {solved || hint >= 3 ? w.original : traced.length ? traced.join("") : " "}
            </span>
          </span>
          {after}
        </p>
        {/*
          * The explanation's space is held whether or not there is anything to
          * say yet. Only once the ring has a column of its own does letting the
          * panel grow stop pushing it around.
          */}
        {km && !solved && (
          <div className="mt-3 h-28 md:h-auto md:min-h-28" data-word-forming-slot>
            {traced.length > 0 && <WordForming traced={traced} />}
          </div>
        )}
        <HintBar text={shownHint} level={hint} onHint={nextHint} host={hintHost} />
      </div>
      <LetterWheel
        tiles={ring}
        script={book.language === "km" ? "khmer" : "latin"}
        display={book.language === "km" ? unitLabel : undefined}
        label={tr("library.spellMissing")}
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
    <div data-word-forming aria-live="polite" className="h-full overflow-y-auto rounded-2xl border border-line bg-surface px-4 py-3 md:h-auto md:overflow-visible">
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

/**
 * The end of a book: first, plainly, that it is finished — a banner in the
 * book's own colour with its cover, the stars and the XP — then how each part
 * went, the words worth practising, and what to do next. The parent's summary
 * is there for a grown-up to open, not in the child's way.
 */
function Results({ book, outcomes, earned, next, onNext, onShelf, onAgain }: {
  book: Passage; outcomes: Outcome[]; earned: { stars: number; xp: number } | null;
  /** The next story in this language not yet finished, if there is one. */
  next?: Passage | null; onNext?(id: string): void;
  onShelf(): void; onAgain(): void;
}) {
  const { t: tr, tNodes } = useT();
  const reduce = useReducedMotion();
  const quiz = quizOf(book);
  // Matching, opposites and reading are optional: a book shows only the parts it has.
  const parts = tally(outcomes, quiz).filter((part) => part.total > 0 || !OPTIONAL_PARTS.has(part.part));
  const need = wordsToPractise(outcomes);
  const stars = earned?.stars ?? 0;
  const tone = COVER[book.category ?? ""] ?? "from-indigo-500 to-indigo-800";
  useEffect(() => {
    if (earned) playSound("levelup");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- once, on arrival
  const praise = stars === 3 ? "three" : stars === 2 ? "two" : "one";

  return (
    <div className="flex flex-col gap-4">
      <section className={`relative grid overflow-hidden rounded-3xl bg-gradient-to-br text-white sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] ${tone}`}>
        <div className="relative z-10 flex flex-col gap-3 p-5 sm:p-8">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold uppercase tracking-widest text-white">
            <Check className="h-4 w-4" aria-hidden="true" />
            {tr("library.results.eyebrow")}
          </span>
          <h1 className="text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            {tNodes("library.results.finished", { title: <span className={kh(book)}>{book.title}</span> })}
          </h1>
          {earned && (
            <>
              <div className="flex items-center gap-1.5" role="img" aria-label={tr("library.results.stars", { stars, total: 3 })}>
                {[1, 2, 3].map((n) => (
                  <motion.span key={n}
                    initial={reduce ? false : { scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: reduce ? 0 : 0.15 + n * 0.15, type: "spring", stiffness: 380, damping: 16 }}>
                    <Star className={`h-9 w-9 sm:h-10 sm:w-10 ${n <= stars ? "fill-white text-white drop-shadow" : "text-white/40"}`} aria-hidden="true" />
                  </motion.span>
                ))}
                {earned.xp > 0 && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-extrabold text-ink">
                    <Zap className="h-4 w-4 fill-indigo-600 text-indigo-600" aria-hidden="true" />+{earned.xp} XP
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-white/90 sm:text-base">{tr(`library.results.praise.${praise}`)}</p>
            </>
          )}
        </div>
        <span className="relative hidden min-h-48 sm:block [mask-image:linear-gradient(to_right,transparent,black_35%)]" aria-hidden="true">
          {isPhoto(book.picture) ? <Picture name={book.picture} fill /> : <span className="absolute inset-6"><Picture name={book.picture} /></span>}
        </span>
      </section>

      <section aria-labelledby="how-you-did">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="how-you-did" className="text-lg font-extrabold text-ink">{tr("library.results.howYouDid")}</h2>
          <span className="text-xs text-muted">{tr("library.results.legend")}</span>
        </div>
        <div className={`grid gap-3 ${parts.length > 3 ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
          {parts.map((t) => {
            const all = t.total > 0 && t.firstTry === t.total;
            return (
              <UICard key={t.part} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-muted">{tr(`library.part.${t.part}`)}</span>
                  {all && <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white" aria-hidden="true"><Check className="h-4 w-4" /></span>}
                </div>
                <div className="mt-1 text-3xl font-extrabold tabular-nums text-ink">{t.firstTry}/{t.total}</div>
                <div className="text-xs text-muted">{tr("library.results.firstTry")}</div>
                <div className="mt-3 flex flex-wrap gap-1" aria-hidden="true">
                  {outcomes.filter((o) => o.part === t.part).map((o, i) => (
                    <span key={i} className={`grid h-6 w-6 place-items-center rounded-full text-white ${isFirstTry(o) ? "bg-emerald-500" : "bg-indigo-400"}`}>
                      {isFirstTry(o) ? <Check className="h-3.5 w-3.5" /> : <RotateCcw className="h-3 w-3" />}
                    </span>
                  ))}
                </div>
              </UICard>
            );
          })}
        </div>
      </section>

      {need.length ? (
        <UICard className="p-4">
          <h2 className="text-sm font-extrabold text-ink">{tr("library.results.wordsToPractise")}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {need.map((w) => <span key={w} className={`rounded-full bg-indigo-50 px-3 py-1 font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 ${kh(book)}`}>{w}</span>)}
          </div>
        </UICard>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
          {tr("library.results.nothing")}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {next && onNext ? (
          <>
            <UIButton type="button" variant="primary" size="lg" icon={<BookOpen />} onClick={() => onNext(next.id)} className="sm:w-auto">
              <span>{tr("library.results.nextStory")}: <span className={kh(next)}>{next.title}</span></span>
            </UIButton>
            <UIButton type="button" variant="secondary" size="lg" onClick={onShelf}>{tr("library.results.backToLibrary")}</UIButton>
          </>
        ) : (
          <UIButton type="button" variant="primary" size="lg" onClick={onShelf}>{tr("library.results.backToLibrary")}</UIButton>
        )}
        <UIButton type="button" variant="ghost" size="lg" icon={<RotateCcw />} onClick={onAgain}>{tr("library.results.readItAgain")}</UIButton>
      </div>

      <details className="group rounded-2xl border border-line bg-surface p-4 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold text-muted">
          {tr("library.results.parentSees")}
          <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <p className="mt-2 text-ink">{parentSummary(book, outcomes, quiz)}</p>
      </details>
    </div>
  );
}

export default LibraryPage;
