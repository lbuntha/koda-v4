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
import { Bot, BotMessageSquare, SkipForward, User } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UICountdown, UICountUp, UIHintPanel, UIKidMessage, UIOutcome, UIPointsPop, UIProgressBar } from "../../components/ui";
import { elapsedOf, hintStatus, machineLockedOut, machineProgress, type RoundState } from "../engine";
import { LetterTiles } from "./LetterTiles";
import { PuzzleCanvas } from "./PieceView";
import type { RebusRound } from "./useRebusRound";

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

const ScoreChip: React.FC<{ icon: React.ReactNode; label: string; points: number; cue?: string; standing: Standing; iconClass?: string; gain?: number; gainKey?: string | number }> = ({ icon, label, points, cue, standing, iconClass = "", gain = 0, gainKey = 0 }) => {
  const { t } = useT();
  return (
    <div className={themeSystem.card("default", `relative flex flex-1 items-center gap-2 px-3 py-2 ${gain > 0 ? "ui-glow" : ""} ${standing === "ahead" ? "!border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800" : ""}`)}>
      {gain > 0 && <UIPointsPop key={gainKey}>+{gain}</UIPointsPop>}
      <span className={`inline-flex text-indigo-600 dark:text-indigo-300 [&>svg]:h-5 [&>svg]:w-5 ${iconClass}`}>{icon}</span>
      <div className="min-w-0">
        <UICountUp value={points} className="block text-xl font-black leading-none text-ink" />
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
const Scoreboard: React.FC<{ you: number; machine: number; machineCue?: string; mood?: MachineMood; final?: boolean; gain?: { you?: number; machine?: number; key: string | number } }> = ({ you, machine, machineCue, mood = "thinking", final, gain }) => {
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
        <ScoreChip icon={<User />} label={t("rebus.you")} points={you} standing={standingOf(you, machine)} gain={gain?.you} gainKey={gain?.key} />
        <ScoreChip
          key={mood}
          icon={mood === "cheer" || mood === "oops" ? <BotMessageSquare /> : <Bot />}
          iconClass={MOOD_CLASS[mood]}
          label={t("rebus.machineName")}
          points={machine}
          cue={machineCue ?? (mood === "thinking" ? undefined : t(`rebus.mood.${mood}`))}
          standing={standingOf(machine, you)}
          gain={gain?.machine}
          gainKey={gain?.key}
        />
      </div>
      <p role="status" className="text-center text-sm font-bold text-body">
        {line}
      </p>
    </div>
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
  const hint = hintStatus(state, now);
  const secondsLeft = Math.max(0, Math.ceil(config.settings.puzzleLimitSec - elapsedOf(run, now)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) send({ type: "answer", text });
    setText("");
    input.current?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-20">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <UIProgressBar value={state.index} max={total} size="sm" label={t("rebus.puzzleOf", { n: state.index + 1, total })} caption={t("rebus.puzzleOf", { n: state.index + 1, total })} />
        </div>
        <UICountdown secondsLeft={secondsLeft} totalSeconds={config.settings.puzzleLimitSec} label={t("rebus.timeLeft", { seconds: secondsLeft })} />
      </div>

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

      {letterTiles && run.puzzle.kind !== "math" ? (
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
            placeholder={run.puzzle.kind === "math" ? t("rebus.answerPlaceholderMath") : t("rebus.answerPlaceholder")}
            inputMode={run.puzzle.kind === "math" ? "numeric" : undefined}
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

      <UIHintPanel
        status={hint}
        delaySec={config.settings.hintDelaySec}
        totalRungs={config.settings.hintRungs}
        hints={run.hints}
        onTake={() => send({ type: "hint" })}
        buttonLabel={hint.state === "locked" ? t("rebus.hintLocked", { seconds: Math.ceil(hint.secondsLeft) }) : hint.state === "ready" ? t("rebus.hintReady", { n: hint.rung, total: config.settings.hintRungs }) + (config.settings.hintCost > 0 ? ` ${t("rebus.hintCostSuffix", { cost: config.settings.hintCost })}` : "") : t("rebus.hintNone")}
        hintTitle={(n) => t("rebus.hintN", { n })}
        progressLabel={t("rebus.hintsUsedOf", { used: run.hints.length, total: config.settings.hintRungs })}
      />
      <div className="flex justify-end">
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

  const outcome =
    last.reason === "solved"
      ? { kind: "correct" as const, title: t("rebus.wonTitle"), message: undefined, points: last.points }
      : last.reason === "machine"
        ? { kind: "beaten" as const, title: t("rebus.machineWonTitle"), message: t("rebus.machineWonText", { points: last.points }), points: undefined }
        : last.reason === "time"
          ? { kind: "timeUp" as const, title: t("rebus.timeUpTitle"), message: t("rebus.timeUpText"), points: undefined }
          : { kind: "skipped" as const, title: t("rebus.skippedTitle"), message: t("rebus.skippedText"), points: undefined };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-20">
      <Scoreboard you={state.score.child} machine={state.score.machine} mood={moodOf(state, false)} final={lastPuzzle} gain={{ you: last.winner === "child" ? last.points : 0, machine: last.winner === "machine" ? last.points : 0, key: state.index }} />

      <UIOutcome {...outcome} pointsLabel={outcome.points ? t("rebus.pointsChip", { points: outcome.points }) : undefined} actionLabel={lastPuzzle ? t("rebus.seeResults") : t("rebus.next")} onAction={() => send({ type: "next" })} />

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
