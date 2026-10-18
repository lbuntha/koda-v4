/**
 * The puzzle on screen, and what follows it.
 *
 * One column, picture first: the puzzle, then the Machine's progress, then the
 * answer. The hint is a button with a ring that empties as it unlocks, so the
 * owner's delay is something a child can watch rather than be told. Nothing
 * here keeps time or draws a random number; it reads the engine's state and the
 * clock `now`, and sends events back.
 */

import React, { useEffect, useRef, useState } from "react";
import { Bot, BotMessageSquare, Lightbulb, SkipForward, User } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIKidMessage, UIProgressBar } from "../../components/ui";
import { elapsedOf, hintStatus, machineLockedOut, machineProgress, type RoundState } from "../engine";
import { LetterTiles } from "./LetterTiles";
import { PuzzleCanvas } from "./PieceView";
import type { RebusRound } from "./useRebusRound";

const RING = 2 * Math.PI * 18;
/** How long a puzzle's answer stays up before the next one, when the player chose to move on by themselves. */
export const AUTO_NEXT_MS = 3000;
/** How long the "not quite" message stays before it gets out of the way. */
const WRONG_MS = 2500;

type Standing = "ahead" | "behind" | "tied";

/**
 * How the Machine is feeling, for the little character in its score chip.
 * It is only ever a reaction to what just happened, never a judgement of the
 * child: it groans when the child is quicker, and it never gloats.
 */
export type MachineMood = "thinking" | "oops" | "cheer" | "groan" | "shrug";

export const moodOf = (state: RoundState, locked: boolean): MachineMood => {
  if (state.phase === "playing") return locked ? "oops" : "thinking";
  const reason = state.last?.reason;
  return reason === "machine" ? "cheer" : reason === "solved" ? "groan" : "shrug";
};

const MOOD_CLASS: Record<MachineMood, string> = { thinking: "", oops: "rebus-bot-oops", cheer: "rebus-bot-cheer", groan: "rebus-bot-groan", shrug: "" };


const standingOf = (mine: number, theirs: number): Standing => (mine > theirs ? "ahead" : mine < theirs ? "behind" : "tied");

const ScoreChip: React.FC<{ icon: React.ReactNode; label: string; points: number; cue?: string; standing: Standing; iconClass?: string }> = ({ icon, label, points, cue, standing, iconClass = "" }) => {
  const { t } = useT();
  return (
    <div className={themeSystem.card("default", `flex flex-1 items-center gap-2 px-3 py-2 ${standing === "ahead" ? "!border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800" : ""}`)}>
      <span className={`inline-flex text-indigo-600 dark:text-indigo-300 [&>svg]:h-5 [&>svg]:w-5 ${iconClass}`}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xl font-black leading-none text-ink">{points}</div>
        <div className="truncate text-[11px] font-bold text-muted">{cue ?? label}</div>
      </div>
      {standing !== "tied" && (
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${standing === "ahead" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
          {t(standing === "ahead" ? "rebus.ahead" : "rebus.behind")}
        </span>
      )}
    </div>
  );
};

/** Both scores, and in words who is winning: it should never take working out. */
const Scoreboard: React.FC<{ you: number; machine: number; machineCue?: string; mood?: MachineMood; final?: boolean }> = ({ you, machine, machineCue, mood = "thinking", final }) => {
  const { t } = useT();
  const diff = Math.abs(you - machine);
  const line = final
    ? you > machine
      ? t("rebus.youWinLine", { diff })
      : you < machine
        ? t("rebus.machineWinsLine", { diff })
        : t("rebus.tieLine")
    : you > machine
      ? t("rebus.youAheadLine", { diff })
      : you < machine
        ? t("rebus.machineAheadLine", { diff })
        : t("rebus.tiedLine");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <ScoreChip icon={<User />} label={t("rebus.you")} points={you} standing={standingOf(you, machine)} />
        <ScoreChip
          key={mood}
          icon={mood === "cheer" || mood === "oops" ? <BotMessageSquare /> : <Bot />}
          iconClass={MOOD_CLASS[mood]}
          label={t("rebus.machineName")}
          points={machine}
          cue={machineCue ?? (mood === "thinking" ? undefined : t(`rebus.mood.${mood}`))}
          standing={standingOf(machine, you)}
        />
      </div>
      <p role="status" className="text-center text-sm font-bold text-body">
        {line}
      </p>
    </div>
  );
};

/** The hint button: a ring that drains while locked, the next rung's name when ready. */
const HintButton: React.FC<{ state: RoundState; now: number; onHint(): void }> = ({ state, now, onHint }) => {
  const { t } = useT();
  const status = hintStatus(state, now);
  const delay = state.config.settings.hintDelaySec;
  const left = status.state === "locked" ? status.secondsLeft : 0;
  const label =
    status.state === "locked"
      ? t("rebus.hintLocked", { seconds: Math.ceil(left) })
      : status.state === "ready"
        ? t("rebus.hintReady", { n: status.rung, total: state.config.settings.hintRungs }) + (state.config.settings.hintCost > 0 ? ` ${t("rebus.hintCostSuffix", { cost: state.config.settings.hintCost })}` : "")
        : t("rebus.hintNone");

  return (
    <UIButton
      variant="secondary"
      fullWidth
      disabled={status.state !== "ready"}
      onClick={onHint}
      icon={
        status.state === "locked" ? (
          <svg viewBox="0 0 44 44" aria-hidden="true" className="!h-7 !w-7">
            <circle cx="22" cy="22" r="18" fill="none" strokeWidth="5" stroke="currentColor" className="text-line" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              stroke="currentColor"
              className="origin-center -rotate-90 text-indigo-600"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - left / delay)}
            />
          </svg>
        ) : (
          <Lightbulb />
        )
      }
    >
      {label}
    </UIButton>
  );
};

export const PlayView: React.FC<{ round: RebusRound; letterTiles: boolean }> = ({ round, letterTiles }) => {
  const { t } = useT();
  const { state, now, send } = round;
  const [text, setText] = useState("");
  const [showWrong, setShowWrong] = useState(false);
  const wrong = state?.run.wrong ?? 0;
  const seenWrong = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  // A wrong answer shows its message briefly; a new puzzle starts clean.
  useEffect(() => {
    if (wrong > seenWrong.current) {
      setShowWrong(true);
      const id = window.setTimeout(() => setShowWrong(false), WRONG_MS);
      seenWrong.current = wrong;
      return () => window.clearTimeout(id);
    }
    seenWrong.current = wrong;
  }, [wrong]);

  const puzzleId = state?.run.puzzle.id;
  useEffect(() => {
    setText("");
    setShowWrong(false);
    seenWrong.current = 0;
    // The cursor is in the answer box, ready to type.
    input.current?.focus();
  }, [puzzleId]);

  if (!state) return null;
  const { run, config } = state;
  const total = config.puzzles.length;
  const locked = machineLockedOut(state, now);
  const secondsLeft = Math.max(0, Math.ceil(config.settings.puzzleLimitSec - elapsedOf(run, now)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) send({ type: "answer", text });
    setText("");
    input.current?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-20">
      <UIProgressBar value={state.index} max={total} size="sm" label={t("rebus.puzzleOf", { n: state.index + 1, total })} caption={t("rebus.puzzleOf", { n: state.index + 1, total })} />

      <Scoreboard you={state.score.child} machine={state.score.machine} machineCue={locked ? t("rebus.machineLocked") : undefined} mood={moodOf(state, locked)} />

      <PuzzleCanvas pieces={run.puzzle.pieces} label={t("rebus.puzzle")} />

      <UIProgressBar value={Math.round(machineProgress(state, now) * 100)} max={100} size="sm" label={t("rebus.thinking")} caption={`${t("rebus.thinking")} · ${t("rebus.seconds", { seconds: secondsLeft })}`} />

      <div aria-live="polite">
        {showWrong ? (
          <UIKidMessage tone="nudge" title={t("rebus.wrongTitle")} message={t("rebus.wrongText")} />
        ) : locked ? (
          <UIKidMessage tone="nudge" title={t("rebus.machineLocked")} />
        ) : null}
      </div>

      {run.hints.length > 0 && (
        <ul className={themeSystem.card("default", "flex flex-col gap-1.5 p-3")}>
          {run.hints.map((h) => (
            <li key={h.rung} className="flex items-start gap-2 text-sm font-bold text-ink">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
              {h.text}
            </li>
          ))}
        </ul>
      )}

      {letterTiles ? (
        <LetterTiles key={run.puzzle.id} answer={run.puzzle.answer} seed={run.puzzle.id} onSubmit={(value) => send({ type: "answer", text: value })} />
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <input
            key={run.puzzle.id}
            ref={input}
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={t("rebus.answerLabel")}
            placeholder={t("rebus.answerPlaceholder")}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className={`${themeSystem.field("lg")} min-w-0 flex-1`}
          />
          <UIButton type="submit" disabled={!text.trim()}>
            {t("rebus.check")}
          </UIButton>
        </form>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <HintButton state={state} now={now} onHint={() => send({ type: "hint" })} />
        </div>
        <UIButton variant="ghost" icon={<SkipForward />} onClick={() => send({ type: "skip" })}>
          {t("rebus.skip")}
        </UIButton>
      </div>
    </div>
  );
};

export const RevealView: React.FC<{ round: RebusRound; autoNext?: boolean }> = ({ round, autoNext = false }) => {
  const { t } = useT();
  const { state, send } = round;
  const shown = state?.last?.puzzle.id;
  // Moving on by themselves: the answer stays up for a few seconds, and Next still works at once.
  useEffect(() => {
    if (!autoNext || !shown) return;
    const id = window.setTimeout(() => send({ type: "next" }), AUTO_NEXT_MS);
    return () => window.clearTimeout(id);
  }, [autoNext, shown, send]);
  if (!state?.last) return null;
  const { last } = state;
  const lastPuzzle = state.index + 1 >= state.config.puzzles.length;

  const message =
    last.reason === "solved"
      ? { tone: "correct" as const, title: t("rebus.wonTitle"), message: t("rebus.wonText", { points: last.points }) }
      : last.reason === "machine"
        ? { tone: "nudge" as const, title: t("rebus.machineWonTitle"), message: t("rebus.machineWonText", { points: last.points }) }
        : last.reason === "time"
          ? { tone: "nudge" as const, title: t("rebus.timeUpTitle"), message: t("rebus.timeUpText") }
          : { tone: "nudge" as const, title: t("rebus.skippedTitle"), message: t("rebus.skippedText") };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-20">
      <Scoreboard you={state.score.child} machine={state.score.machine} mood={moodOf(state, false)} final={lastPuzzle} />

      <UIKidMessage {...message} actionLabel={lastPuzzle ? t("rebus.seeResults") : t("rebus.next")} onAction={() => send({ type: "next" })} />

      {autoNext && <p className={themeSystem.typography("caption", "text-center")}>{t("rebus.movingOn", { seconds: AUTO_NEXT_MS / 1000 })}</p>}

      <PuzzleCanvas pieces={last.puzzle.pieces} label={t("rebus.puzzle")} />

      <div className="text-center">
        <div className={themeSystem.typography("caption")}>{t("rebus.answerWas")}</div>
        <div className="text-3xl font-black text-ink">{last.puzzle.answer}</div>
      </div>

      <div className={themeSystem.card("default", themeSystem.spacing.cardSm)}>
        <span className="font-black text-ink">{t("rebus.why")} </span>
        <span className="text-body">{last.puzzle.explanation}</span>
      </div>
    </div>
  );
};
