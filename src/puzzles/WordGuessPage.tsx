/**
 * Word Guess, as a page inside Learn → Think.
 *
 * One daily word per line (language + number of tiles), the same for every
 * child that day, and practice words for anyone who wants more. Built for a
 * six-year-old and a sixteen-year-old at once: one clear job on screen at a
 * time, a picture with every clue, easy tiles by default for the youngest, and
 * colour that is never the only signal.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Check, Flame, HelpCircle, House, Lightbulb, RotateCcw, SlidersHorizontal, Sparkles, Trophy, X } from "lucide-react";
import { useT } from "../lib/i18n";
import { themeSystem } from "../lib/themeSystem";
import { playSound } from "../utils/audio";
import { activeLearnerId } from "../lib/learning/learningLog";
import { useAudienceViewer } from "../skills/viewer";
import { UIButton, UISelect } from "../components/ui";
import { puzzleDay } from "./day";
import { WordGuessRecorder } from "./learning";
import { dailyKey, liveStreak, practiceXpLeft, readPlay, saveDaily, savePractice, solvedIds, type GameRecord } from "./playStore";
import { dailySnapshot, levelsFor, lineWords, practicePuzzle, refreshDaily, subscribeDaily, todaysPuzzle } from "./store";
import { slotKey, type DailyPuzzle, type PuzzleCategory, type PuzzleLang } from "./types";
import { CategoryIcon } from "./ui/categoryIcon";
import { TileKeyboard, easyTiles } from "./ui/TileKeyboard";
import { WordPicture } from "./ui/WordPicture";
import { WordTiles, WordTileStyles } from "./ui/WordTiles";
import { WordGuessResult } from "./ui/WordGuessResult";
import { MAX_GUESSES, keyStates, scoreGuess, solved, tileLabel, tilesOf } from "./wordGuess";

const PREFS = "koda_word_guess_prefs_v1";

interface Prefs {
  lang: PuzzleLang;
  level: Record<PuzzleLang, number>;
  keys: "easy" | "all";
  seenHelp: boolean;
  /** Practice only: one topic, or "" for every topic. */
  topic: string;
}

/** Where a child starts: the app's language, and a word length for their age. */
export function defaultPrefs(language: string, age: number | null): Prefs {
  const a = age ?? 8;
  return {
    lang: language === "km" ? "km" : "en",
    /* Longer words as children grow: 3 at 6–7, 4 at 8–9, 5 at 10–11, 6 from 12 (Khmer 2 tiles for the very youngest). */
    level: { km: a <= 5 ? 2 : a <= 7 ? 3 : a <= 9 ? 4 : a <= 11 ? 5 : 6, en: a <= 7 ? 3 : a <= 9 ? 4 : a <= 11 ? 5 : 6 },
    keys: a <= 8 ? "easy" : "all",
    seenHelp: false,
    topic: "",
  };
}

function readPrefs(fallback: Prefs): Prefs {
  try {
    const raw = localStorage.getItem(`${PREFS}__${activeLearnerId()}`);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Prefs>) } : fallback;
  } catch {
    return fallback;
  }
}

function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(`${PREFS}__${activeLearnerId()}`, JSON.stringify(p));
  } catch {
    /* fine */
  }
}

/** XP for a game: a daily solve is worth more, and fewer guesses a little more again. */
export const xpFor = (won: boolean, guesses: number, daily: boolean): number => (!won ? 2 : daily ? 15 + (MAX_GUESSES - guesses) * 2 : 5);

export interface WordGuessPageProps {
  onExit(): void;
  onAwardXp?(xp: number): void;
  onDeepChange?(deep: boolean): void;
}

export const WordGuessPage: React.FC<WordGuessPageProps> = ({ onExit, onAwardXp, onDeepChange }) => {
  const { t, language } = useT();
  const viewer = useAudienceViewer();
  const snap = useSyncExternalStore(subscribeDaily, dailySnapshot, dailySnapshot);
  const [prefs, setPrefsState] = useState<Prefs>(() => readPrefs(defaultPrefs(language, viewer.age ?? null)));
  const [mode, setMode] = useState<"daily" | "practice">("daily");
  const [practiceId, setPracticeId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(!prefs.seenHelp);
  /* On a phone the choices fold into one line, so the board and keys fit the screen. Always open on a wide screen. */
  const [optionsOpen, setOptionsOpen] = useState(false);
  const today = puzzleDay();
  /* Play comes in rounds, so it has an end: 5 words, 3 for the youngest. Then the child chooses — another round, or done for today. */
  const roundSize = roundSizeFor(viewer.age ?? null);
  const [round, setRound] = useState<boolean[]>([]);
  const roundDone = round.length >= roundSize;

  // Opened from further down Home or Learn: start at the top, with the clue and the first row in view.
  useEffect(() => {
    window.scrollTo?.(0, 0);
  }, []);

  useEffect(() => {
    void refreshDaily();
  }, []);
  useEffect(() => {
    onDeepChange?.(true);
    return () => onDeepChange?.(false);
  }, [onDeepChange]);

  const setPrefs = (p: Partial<Prefs>) =>
    setPrefsState((old) => {
      const next = { ...old, ...p };
      writePrefs(next);
      return next;
    });

  const levels = levelsFor(snap, prefs.lang);
  const level = levels.includes(prefs.level[prefs.lang]) ? prefs.level[prefs.lang] : (levels[0] ?? 3);
  const slot = useMemo(() => ({ kind: "word-guess" as const, lang: prefs.lang, level }), [prefs.lang, level]);
  const key = slotKey(slot);

  const daily = todaysPuzzle(snap, slot, today);
  const puzzle: DailyPuzzle | null = mode === "daily" ? daily : (snap.puzzles.find((p) => p.id === practiceId) ?? null);

  // A practice word is chosen once per "next word", never on every render.
  useEffect(() => {
    if (
      mode !== "practice" ||
      (practiceId && snap.puzzles.some((p) => p.id === practiceId && p.lang === slot.lang && p.level === slot.level))
    )
      return;
    const avoid = new Set([...(daily ? [daily.id] : []), ...readPlay().recent]);
    setPracticeId(practicePuzzle(snap, slot, avoid, Math.random, { topic: prefs.topic, solved: solvedIds() })?.id ?? null);
  }, [mode, practiceId, snap, slot, daily, prefs.topic]);
  const topics = useMemo(() => [...new Set(lineWords(snap, slot).map((p) => p.data.category))].sort(), [snap, slot]);
  const lineIds = useMemo(() => lineWords(snap, slot).map((p) => p.id), [snap, slot]);

  if (!puzzle) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onExit}>
          {t("wordGuess.back")}
        </UIButton>
        <p className={themeSystem.card("default", "p-6 text-center text-body")}>{t("wordGuess.noWords")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 pb-6 lg:max-w-4xl">
      <WordTileStyles />
      <div className="flex items-center gap-2">
        <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onExit} aria-label={t("wordGuess.back")}>
          <span className="hidden sm:inline">{t("wordGuess.back")}</span>
        </UIButton>
        <h2 className="min-w-0 flex-1 truncate text-xl font-black text-ink sm:text-2xl">{t("wordGuess.title")}</h2>
        <StreakChip />
        {/* Phone only: language, length, today or practice and the keys fold away behind one button. */}
        <button
          type="button"
          onClick={() => setOptionsOpen((o) => !o)}
          aria-expanded={optionsOpen}
          aria-label={t("wordGuess.options")}
          className={`inline-flex shrink-0 items-center rounded-full p-2 text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300 sm:hidden ${optionsOpen ? "bg-indigo-100 dark:bg-indigo-950" : "hover:bg-indigo-50"}`}
        >
          <SlidersHorizontal className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setHelpOpen((o) => !o)}
          aria-expanded={helpOpen}
          aria-label={t("wordGuess.howTitle")}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-bold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <HelpCircle className="h-5 w-5" aria-hidden /> <span className="hidden sm:inline">{t("wordGuess.howTitle")}</span>
        </button>
      </div>
      <p className={`${themeSystem.typography("subtitle")} -mt-3 hidden sm:block`}>{t("wordGuess.tagline")}</p>

      <div className={`${optionsOpen ? "flex" : "hidden"} flex-wrap items-center gap-2 sm:flex`}>
        <Segmented
          label={t("wordGuess.languageLabel")}
          value={prefs.lang}
          options={[
            { id: "km", label: "ខ្មែរ" },
            { id: "en", label: "English" },
          ]}
          onChange={(lang) => {
            setPrefs({ lang: lang as PuzzleLang });
            setPracticeId(null);
          }}
        />
        <Segmented
          label={t("wordGuess.lengthLabel")}
          value={String(level)}
          options={levels.map((n) => ({
            id: String(n),
            label: t(prefs.lang === "km" ? "wordGuess.tilesN" : "wordGuess.lettersN", { n: String(n) }),
          }))}
          onChange={(n) => {
            setPrefs({ level: { ...prefs.level, [prefs.lang]: Number(n) } });
            setPracticeId(null);
          }}
        />
        <Segmented
          label={t("wordGuess.modeLabel")}
          value={mode}
          options={[
            { id: "daily", label: t("wordGuess.today") },
            { id: "practice", label: t("wordGuess.practice") },
          ]}
          onChange={(m) => setMode(m as "daily" | "practice")}
        />
        {mode === "practice" && topics.length > 1 && (
          <UISelect
            aria-label={t("wordGuess.topicLabel")}
            className="w-auto"
            value={topics.includes(prefs.topic as PuzzleCategory) ? prefs.topic : ""}
            onChange={(e) => {
              setPrefs({ topic: e.target.value });
              setPracticeId(null);
            }}
          >
            <option value="">{t("wordGuess.allTopics")}</option>
            {topics.map((c) => (
              <option key={c} value={c}>
                {t(`puzzles.category.${c}`)}
              </option>
            ))}
          </UISelect>
        )}
        <div className="sm:hidden">
          <Segmented
            label={t("wordGuess.keysLabel")}
            value={prefs.keys}
            options={[
              { id: "easy", label: t("wordGuess.easyKeys") },
              { id: "all", label: t("wordGuess.allKeys") },
            ]}
            onChange={(k) => setPrefs({ keys: k as "easy" | "all" })}
          />
        </div>
      </div>

      {helpOpen && (
        <HowToPlay
          lang={prefs.lang}
          onClose={() => {
            setHelpOpen(false);
            setPrefs({ seenHelp: true });
          }}
        />
      )}

      <RoundDots results={round} size={roundSize} />

      <Game
        key={`${mode}:${key}:${puzzle.id}`}
        puzzle={puzzle}
        daily={mode === "daily"}
        slot={key}
        day={today}
        keys={prefs.keys}
        onKeys={(k) => setPrefs({ keys: k })}
        onAwardXp={onAwardXp}
        lineIds={lineIds}
        lastInRound={roundDone}
        onFinished={(won) => setRound((r) => (r.length >= roundSize ? [won] : [...r, won]))}
        onNext={() => {
          setMode("practice");
          setPracticeId(null);
        }}
      />

      {roundDone && (
        <RoundDone
          results={round}
          onAgain={() => {
            setRound([]);
            setMode("practice");
            setPracticeId(null);
            window.scrollTo?.({ top: 0, behavior: "smooth" });
          }}
          onFinish={onExit}
        />
      )}
    </div>
  );
};

/** Words in a round: 3 for children of 7 and under, 5 from 8. */
export const roundSizeFor = (age: number | null): number => ((age ?? 8) <= 7 ? 3 : 5);

/** Where the child is in the round: a dot per word — solved, missed, this one, still to come. */
const RoundDots: React.FC<{ results: boolean[]; size: number }> = ({ results, size }) => {
  const { t } = useT();
  const done = results.length >= size;
  const at = Math.min(results.length + 1, size);
  return (
    <div
      className="-mt-1 flex items-center justify-center gap-2"
      role="status"
      aria-label={done ? t("wordGuess.roundComplete") : t("wordGuess.roundOf", { n: String(at), total: String(size) })}
    >
      <span className="text-xs font-black uppercase tracking-wide text-muted" aria-hidden>
        {done ? t("wordGuess.roundComplete") : t("wordGuess.roundOf", { n: String(at), total: String(size) })}
      </span>
      <span className="flex gap-1.5" aria-hidden>
        {Array.from({ length: size }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              i < results.length
                ? results[i]
                  ? "w-2.5 bg-emerald-500"
                  : "w-2.5 bg-rose-400"
                : i === results.length
                  ? "w-6 bg-indigo-500"
                  : "w-2.5 bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </span>
    </div>
  );
};

/** The end of a round: what they did, then one clear choice. Never a dead end, never a nag. */
const RoundDone: React.FC<{ results: boolean[]; onAgain(): void; onFinish(): void }> = ({ results, onAgain, onFinish }) => {
  const { t } = useT();
  const solved = results.filter(Boolean).length;
  const title =
    solved === results.length ? "wordGuess.roundPerfect" : solved * 2 >= results.length ? "wordGuess.roundGreat" : "wordGuess.roundGood";
  return (
    <section
      ref={(el) => el?.scrollIntoView?.({ behavior: "smooth", block: "center" })}
      className={themeSystem.card("default", "koda-celebrate space-y-4 border-2 border-indigo-200 p-6 text-center dark:border-indigo-800")}
      aria-live="polite"
    >
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
        <Trophy className="h-8 w-8" aria-hidden />
      </div>
      <h3 className="text-2xl font-black text-ink">{t(title)}</h3>
      <p className="text-base font-bold text-body">{t("wordGuess.roundSolved", { n: String(solved), total: String(results.length) })}</p>
      <div className="flex justify-center gap-2" aria-hidden>
        {results.map((won, i) => (
          <span
            key={i}
            className={`grid h-9 w-9 place-items-center rounded-full ${won ? "bg-emerald-500 text-white" : "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300"}`}
          >
            {won ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </span>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <UIButton size="lg" icon={<RotateCcw />} onClick={onAgain}>
          {t("wordGuess.anotherRound")}
        </UIButton>
        <UIButton size="lg" variant="outline" icon={<House />} onClick={onFinish}>
          {t("wordGuess.finishToday")}
        </UIButton>
      </div>
      <p className="text-xs font-semibold text-muted">{t("wordGuess.roundBye")}</p>
    </section>
  );
};

const StreakChip: React.FC = () => {
  const { t } = useT();
  const n = liveStreak(readPlay().streak, puzzleDay());
  if (n === 0) return null;
  return (
    <span
      title={t("wordGuess.streak", { n: String(n) })}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1.5 text-sm font-black text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
    >
      <Flame className="h-4 w-4" aria-hidden />
      <span className="sm:hidden" aria-label={t("wordGuess.streak", { n: String(n) })}>
        {n}
      </span>
      <span className="hidden sm:inline">{t("wordGuess.streak", { n: String(n) })}</span>
    </span>
  );
};

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange(id: string): void;
}) {
  if (options.length < 2) return null;
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-2xl border-2 border-line bg-surface p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`rounded-xl px-3 py-1.5 text-sm font-black transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            o.id === value ? "bg-indigo-600 text-white" : "text-body hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const HowToPlay: React.FC<{ lang: PuzzleLang; onClose(): void }> = ({ lang, onClose }) => {
  const { t } = useT();
  const example = lang === "km" ? tilesOf("ឆ្កែ", "km") : ["d", "o", "g"];
  return (
    <section className={themeSystem.card("default", "space-y-3 p-4")} aria-label={t("wordGuess.howTitle")}>
      <h3 className="text-base font-black text-ink">{t("wordGuess.howTitle")}</h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-body">
        <li>
          {t(lang === "km" ? "wordGuess.how1km" : "wordGuess.how1en", {
            n: String(MAX_GUESSES),
          })}
        </li>
        <li>{t("wordGuess.how2")}</li>
        <li>{t("wordGuess.how3")}</li>
      </ol>
      <div className="space-y-2 rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/40">
        <WordTiles tiles={example} lang={lang} result={["correct", "present", "absent"]} size={44} />
        <ul className="space-y-1 text-sm">
          <li>
            <b className="text-emerald-700 dark:text-emerald-400">{t("wordGuess.state.correct")}</b> · {t("wordGuess.legendCorrect")}
          </li>
          <li>
            <b className="text-violet-700 dark:text-violet-400">{t("wordGuess.state.present")}</b> · {t("wordGuess.legendPresent")}
          </li>
          <li>
            <b className="text-slate-600 dark:text-slate-300">{t("wordGuess.state.absent")}</b> · {t("wordGuess.legendAbsent")}
          </li>
        </ul>
      </div>
      <UIButton size="md" fullWidth onClick={onClose}>
        {t("wordGuess.gotIt")}
      </UIButton>
    </section>
  );
};

interface GameProps {
  puzzle: DailyPuzzle;
  daily: boolean;
  slot: string;
  day: string;
  keys: "easy" | "all";
  onKeys(k: "easy" | "all"): void;
  onAwardXp?(xp: number): void;
  onNext(): void;
  /** The game ended this visit (not one reopened already finished). */
  onFinished?(won: boolean): void;
  /** The last word of a round: no "next word" here, the round card offers the choice. */
  lastInRound?: boolean;
  /** Every live word on this line, to count the child's word book. */
  lineIds: readonly string[];
}

/**
 * The tile size that lets the whole board show at once, with the keys under it
 * on a phone or beside it on a wide screen: measured from where the board starts
 * and how tall the keys are, so it still fits when the clue grows a hint line,
 * the keys switch tray, or the phone turns. Never below 30px (still easy to
 * read), never above 60px.
 */
function useTileSize(
  board: React.RefObject<HTMLDivElement | null>,
  keys: React.RefObject<HTMLDivElement | null>,
  n: number,
  below: number,
): number {
  const [size, setSize] = useState(48);
  useLayoutEffect(() => {
    const fit = () => {
      const vw = window.innerWidth;
      const wide = vw >= 1024;
      const byWidth = Math.floor(((wide ? 440 : Math.min(vw, 512)) - 48 - (n - 1) * 6) / n);
      const top = (board.current?.getBoundingClientRect().top ?? 0) + window.scrollY;
      const keysHeight = wide ? 0 : (keys.current?.offsetHeight ?? 0);
      const room = window.innerHeight - top - keysHeight - below - 16;
      const byHeight = Math.floor((room - (MAX_GUESSES - 1) * 6) / MAX_GUESSES);
      setSize(Math.max(30, Math.min(60, byWidth, byHeight)));
    };
    fit();
    const watch = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    if (keys.current) watch?.observe(keys.current);
    if (board.current?.parentElement) watch?.observe(board.current.parentElement.firstElementChild ?? board.current.parentElement);
    window.addEventListener("resize", fit);
    return () => {
      watch?.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [board, keys, n, below]);
  return size;
}

/**
 * The clue in the language on screen, falling back to the other one. A Khmer
 * word's English clue is its meaning, so it reads "It means “cat”".
 */
export function clueLine(puzzle: DailyPuzzle, ui: string, means: (word: string) => string): string {
  const { km, en } = puzzle.data.clue;
  if (ui === "km" && km) return km;
  if (en) return puzzle.lang === "km" ? means(en) : en;
  return km;
}

const Game: React.FC<GameProps> = ({
  puzzle,
  daily,
  slot,
  day,
  keys,
  onKeys,
  onAwardXp,
  onNext,
  onFinished,
  lastInRound = false,
  lineIds,
}) => {
  const { t, language } = useT();
  const answer = useMemo(() => tilesOf(puzzle.data.word, puzzle.lang), [puzzle]);
  const n = answer.length;
  const [game, setGame] = useState<GameRecord>(() => {
    const saved = daily ? readPlay().daily[dailyKey(slot, day)] : undefined;
    return saved && saved.puzzleId === puzzle.id ? saved : { puzzleId: puzzle.id, rows: [], over: false, won: false, hints: 0 };
  });
  const [current, setCurrent] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [shake, setShake] = useState(false);
  /* The row being typed. On a phone the pinned keys cover the bottom of the board, so each new row is scrolled to the middle. */
  const board = useRef<HTMLDivElement | null>(null);
  const keysBox = useRef<HTMLDivElement | null>(null);
  const typingRow = useRef<HTMLDivElement | null>(null);
  const rowsPlayed = game.rows.length;
  useEffect(() => {
    const row = typingRow.current;
    if (rowsPlayed === 0 || !row) return;
    /* Land the row just above the pinned keys, not under them. */
    const keysHeight = window.innerWidth < 1024 ? (keysBox.current?.offsetHeight ?? 0) : 0;
    row.style.scrollMarginBottom = `${keysHeight + 12}px`;
    row.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [rowsPlayed]);
  const [revealRow, setRevealRow] = useState(-1);
  const [xp, setXp] = useState(0);
  const [xpCapped, setXpCapped] = useState(false);
  /* Was this word already in the child's word book before this game? Read once, before the game can add it. */
  const [solvedBefore] = useState(() => solvedIds().has(puzzle.id));
  const recorder = useRef<WordGuessRecorder | null>(null);
  if (!recorder.current) recorder.current = new WordGuessRecorder(puzzle, !daily);

  useEffect(() => () => recorder.current?.abandon(), []);

  const easy = useMemo(() => easyTiles(answer, puzzle.lang, puzzle.id), [answer, puzzle]);
  const states = useMemo(() => keyStates(game.rows), [game.rows]);
  const size = useTileSize(board, keysBox, n, puzzle.lang === "km" ? 40 : 8);
  const phone = typeof window !== "undefined" && window.innerWidth < 640;

  const type = useCallback(
    (tile: string) => {
      if (game.over) return;
      setNote("");
      setCurrent((c) => (c.length >= n ? c : [...c, tile]));
    },
    [game.over, n],
  );
  const del = useCallback(() => !game.over && setCurrent((c) => c.slice(0, -1)), [game.over]);

  const check = useCallback(() => {
    if (game.over) return;
    if (current.length < n) {
      setNote(t(puzzle.lang === "km" ? "wordGuess.needTiles" : "wordGuess.needLetters", { n: String(n) }));
      setShake(true);
      setTimeout(() => setShake(false), 320);
      playSound("error");
      return;
    }
    recorder.current?.begin();
    const result = scoreGuess(current, answer);
    const rows = [...game.rows, { tiles: current, result }];
    const won = solved(result);
    const over = won || rows.length >= MAX_GUESSES;
    const next: GameRecord = {
      ...game,
      rows,
      won,
      over,
      startedAt: game.startedAt ?? Date.now(),
      secs: over ? Math.round((Date.now() - (game.startedAt ?? Date.now())) / 1000) : undefined,
    };
    setGame(next);
    setCurrent([]);
    setRevealRow(rows.length - 1);
    setTimeout(() => setRevealRow(-1), 120 * n + 500);
    if (daily) saveDaily(slot, day, next);
    if (over) {
      const earned = daily || practiceXpLeft(day) > 0 ? xpFor(won, rows.length, daily) : 0;
      setXpCapped(!daily && earned === 0);
      setXp(earned);
      onAwardXp?.(earned);
      onFinished?.(won);
      recorder.current?.finish(won, rows.length, earned);
      if (!daily) savePractice(next, day);
      setTimeout(() => playSound(won ? "success" : "page"), 120 * n + 200);
    } else {
      playSound("pop");
      setNote(t(rows.length === MAX_GUESSES - 1 ? "wordGuess.lastTry" : "wordGuess.keepGoing"));
    }
  }, [game, current, n, answer, daily, slot, day, onAwardXp, onFinished, puzzle.lang, t]);

  // A real keyboard works too, for English.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest?.("input,textarea")) return;
      if (e.key === "Enter") {
        e.preventDefault();
        check();
      } else if (e.key === "Backspace") del();
      else if (puzzle.lang === "en" && /^[a-z]$/i.test(e.key)) type(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [check, del, type, puzzle.lang]);

  const hint = () => {
    if (game.over || game.hints >= 2) return;
    recorder.current?.begin();
    recorder.current?.hint(game.hints + 1);
    const next = { ...game, hints: game.hints + 1 };
    setGame(next);
    if (daily) saveDaily(slot, day, next);
  };

  const clueText = clueLine(puzzle, language, (word) => t("wordGuess.means", { word }));
  /* Easy tiles (the youngest, by default) show the picture from the start: a child who cannot read
     the clue yet sees a cat and spells it. With all the letters, the picture is the first hint. */
  const picture = puzzle.data.picture && (keys === "easy" || game.hints >= 1 || game.over) ? puzzle.data.picture : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <section className={themeSystem.card("default", "flex items-center gap-3 p-2 sm:p-3")} aria-label={t("wordGuess.clue")}>
          {picture ? (
            <WordPicture id={picture} label={t("wordGuess.picture")} size={phone ? 56 : 72} />
          ) : (
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
              <CategoryIcon category={puzzle.data.category} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold uppercase tracking-wide text-muted">{t("wordGuess.clue")}</div>
            <div className="font-black text-ink">{t(`puzzles.category.${puzzle.data.category}`)}</div>
            {game.hints >= 1 && clueText ? <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{clueText}</div> : null}
            {game.hints >= 2 ? (
              <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                {t("wordGuess.startsWith", {
                  tile: tileLabel(answer[0], puzzle.lang),
                })}
              </div>
            ) : null}
          </div>
          {!game.over && (
            <UIButton variant="outline" size="sm" icon={<Lightbulb />} onClick={hint} disabled={game.hints >= 2}>
              {game.hints ? t("wordGuess.hintLeft", { n: String(2 - game.hints) }) : t("wordGuess.hint")}
            </UIButton>
          )}
        </section>

        {/* Above the board, where a child is looking: under it, the pinned keys would hide it on a phone. */}
        <p className="-my-1 min-h-5 text-center text-sm font-bold text-indigo-700 dark:text-indigo-300" aria-live="polite">
          {note}
        </p>
        <div ref={board} className="flex flex-col items-center gap-1.5" aria-label={t("wordGuess.board")}>
          {/* Once the game is over, only the rows played: the result sits right under them. */}
          {Array.from({ length: game.over ? game.rows.length : MAX_GUESSES }, (_, r) => {
            const row = game.rows[r];
            const typing = !row && r === game.rows.length && !game.over;
            const tiles = Array.from({ length: n }, (_, i) => (row ? row.tiles[i] : typing ? current[i] : undefined));
            return (
              <div key={r} ref={typing ? typingRow : undefined}>
                <WordTiles
                  tiles={tiles}
                  lang={puzzle.lang}
                  result={row?.result}
                  size={size}
                  reveal={r === revealRow}
                  active={typing}
                  shake={typing && shake}
                />
              </div>
            );
          })}
          {puzzle.lang === "km" && !game.over && current.length > 0 && (
            <div className="mt-1 text-2xl font-black text-ink" aria-live="polite">
              {current.join("")}
            </div>
          )}
        </div>
      </div>

      {/* While playing, the keys stay pinned to the bottom of a phone screen as the board scrolls; on a wide screen they sit beside the board. */}
      <div
        ref={keysBox}
        className={`flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:bottom-auto ${game.over ? "" : "sticky bottom-0 z-10"}`}
      >
        {game.over ? (
          <WordGuessResult
            puzzle={puzzle}
            game={game}
            daily={daily}
            day={day}
            xp={xp}
            xpCapped={xpCapped}
            book={{ solvedBefore, spelled: lineIds.filter((id) => solvedIds().has(id)).length, total: lineIds.length }}
            onNext={onNext}
            hideNext={lastInRound}
          />
        ) : (
          <div className={themeSystem.card("default", "p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg sm:p-4 lg:shadow-none")}>
            <TileKeyboard
              lang={puzzle.lang}
              easy={easy}
              states={states}
              mode={keys}
              onMode={onKeys}
              onTile={type}
              onDelete={del}
              onCheck={check}
              canCheck={current.length === n}
            />
          </div>
        )}

        {!game.over && game.rows.length === 0 && (
          <p className="hidden items-center justify-center gap-1.5 text-xs font-semibold text-muted sm:flex">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> {daily ? t("wordGuess.dailyNote") : t("wordGuess.practiceNote")}
          </p>
        )}
      </div>
    </div>
  );
};
