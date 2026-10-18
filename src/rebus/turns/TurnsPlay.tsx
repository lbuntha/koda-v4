/**
 * The screens of a game taken in turns: pass the device, play, see the answer,
 * and the results. Built from the same pieces as the other Rebus screens, so it
 * looks and sounds like the rest of the game, and it needs no network.
 */

import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Hand, Lightbulb, LogOut, RotateCcw, SkipForward, Trophy } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIKidMessage, UIProgressBar } from "../../components/ui";
import { useNickname } from "../group/NicknamePicker";
import { Podium } from "../group/Podium";
import { RoomAvatar } from "../group/RoomAvatar";
import type { RoomPlayer } from "../group/types";
import { cue } from "../sound";
import { LetterTiles } from "../ui/LetterTiles";
import { PuzzleCanvas } from "../ui/PieceView";
import { elapsedOf, hintStatus, playerOf, standingsOf, type TurnsState } from "./engine";
import type { TurnsGame } from "./useTurns";

const WRONG_MS = 2500;

/** Everyone's score, the player whose turn it is ringed. */
const Scores: React.FC<{ state: TurnsState; active: number | null }> = ({ state, active }) => {
  const { t } = useT();
  const show = useNickname();
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t("rebus.group.play.scores")}>
      {state.config.players.map((p, i) => (
        <li key={i} className={themeSystem.card("default", `flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 ${active === i ? "!border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800" : ""}`)}>
          <RoomAvatar avatar={p.avatar} />
          <div className="min-w-0">
            <div className="text-xl font-black leading-none text-ink">{state.scores[i]}</div>
            <div className="truncate text-[11px] font-bold text-muted">{show(p.name)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
};

/** Nothing is running here: the device is being handed to whoever is next. */
export const Handover: React.FC<{ game: TurnsGame }> = ({ game }) => {
  const { t } = useT();
  const show = useNickname();
  const state = game.state as TurnsState;
  const who = state.config.players[playerOf(state)];
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-5 pb-20 text-center">
      <UIProgressBar value={state.index} max={state.config.puzzles.length} size="sm" label={t("rebus.puzzleOf", { n: state.index + 1, total: state.config.puzzles.length })} caption={t("rebus.puzzleOf", { n: state.index + 1, total: state.config.puzzles.length })} />
      <Scores state={state} active={playerOf(state)} />
      <div className="flex flex-col items-center gap-3 py-4">
        <Hand aria-hidden="true" className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
        <RoomAvatar avatar={who.avatar} />
        <h2 role="status" className={themeSystem.typography("h2")}>
          {t("rebus.turns.passTo", { name: show(who.name) })}
        </h2>
        <p className={themeSystem.typography("body-sm")}>{t("rebus.turns.passHint")}</p>
      </div>
      <UIButton size="lg" fullWidth icon={<ArrowRight />} onClick={() => game.send({ type: "ready" })}>
        {t("rebus.turns.ready")}
      </UIButton>
    </div>
  );
};

/** One player's turn at one puzzle. */
export const TurnPlay: React.FC<{ game: TurnsGame; letterTiles: boolean }> = ({ game, letterTiles }) => {
  const { t } = useT();
  const show = useNickname();
  const { state, now, send } = game;
  const [text, setText] = useState("");
  const [showWrong, setShowWrong] = useState(false);
  const seenWrong = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const puzzleId = state?.config.puzzles[state.index].id;
  const wrong = state?.wrong ?? 0;

  useEffect(() => {
    setText("");
    setShowWrong(false);
    seenWrong.current = 0;
    input.current?.focus();
  }, [puzzleId]);

  // A wrong answer is told once, then gets out of the way.
  useEffect(() => {
    if (wrong > seenWrong.current) {
      seenWrong.current = wrong;
      cue("wrong");
      setShowWrong(true);
      const id = window.setTimeout(() => setShowWrong(false), WRONG_MS);
      return () => window.clearTimeout(id);
    }
  }, [wrong]);

  if (!state) return null;
  const me = playerOf(state);
  const puzzle = state.config.puzzles[state.index];
  const left = Math.max(0, Math.ceil(state.config.settings.puzzleLimitSec - elapsedOf(state, now)));
  const status = hintStatus(state, now);
  const hintLabel =
    status.state === "locked"
      ? t("rebus.hintLocked", { seconds: Math.ceil(status.secondsLeft) })
      : status.state === "ready"
        ? t("rebus.hintReady", { n: status.rung, total: state.config.settings.hintRungs })
        : t("rebus.hintNone");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) send({ type: "answer", text });
    setText("");
    input.current?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-20">
      <UIProgressBar value={state.index} max={state.config.puzzles.length} size="sm" label={t("rebus.puzzleOf", { n: state.index + 1, total: state.config.puzzles.length })} caption={t("rebus.puzzleOf", { n: state.index + 1, total: state.config.puzzles.length })} />
      <Scores state={state} active={me} />
      <p role="status" className="text-center text-sm font-black text-indigo-700 dark:text-indigo-300">
        {t("rebus.turns.turnOf", { name: show(state.config.players[me].name) })} · {t("rebus.seconds", { seconds: left })}
      </p>

      <PuzzleCanvas pieces={puzzle.pieces} label={t("rebus.puzzle")} />

      <div aria-live="polite">{showWrong && <UIKidMessage tone="nudge" title={t("rebus.wrongTitle")} message={t("rebus.wrongText")} />}</div>

      {state.hints.length > 0 && (
        <ul className={themeSystem.card("default", "flex flex-col gap-1.5 p-3")}>
          {state.hints.map((h) => (
            <li key={h.rung} className="flex items-start gap-2 text-sm font-bold text-ink">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
              {h.text}
            </li>
          ))}
        </ul>
      )}

      {letterTiles ? (
        <LetterTiles key={puzzle.id} answer={puzzle.answer} seed={puzzle.id} onSubmit={(value) => send({ type: "answer", text: value })} />
      ) : (
        <form onSubmit={submit} className="flex gap-2">
          <input
            key={puzzle.id}
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
          <UIButton variant="secondary" fullWidth icon={<Lightbulb />} disabled={status.state !== "ready"} onClick={() => send({ type: "hint" })}>
            {hintLabel}
          </UIButton>
        </div>
        <UIButton variant="ghost" icon={<SkipForward />} onClick={() => send({ type: "skip" })}>
          {t("rebus.skip")}
        </UIButton>
      </div>
    </div>
  );
};

/** The answer, who got the points, and on to the next hand-over. */
export const TurnReveal: React.FC<{ game: TurnsGame }> = ({ game }) => {
  const { t } = useT();
  const show = useNickname();
  const state = game.state as TurnsState;
  const last = state.last;
  const announced = useRef<string | null>(null);
  const lastKey = last ? `${state.index}` : null;

  useEffect(() => {
    if (!last || announced.current === lastKey) return;
    announced.current = lastKey;
    cue(last.reason === "solved" ? "solved" : "timeUp");
  }, [last, lastKey]);

  if (!last) return null;
  const finalPuzzle = state.index + 1 >= state.config.puzzles.length;
  const next = state.config.players[(state.index + 1) % state.config.players.length];
  const name = show(state.config.players[last.player].name);
  const message =
    last.reason === "solved"
      ? { tone: "correct" as const, title: t("rebus.turns.solved", { name }), message: t("rebus.wonText", { points: last.points }) }
      : last.reason === "time"
        ? { tone: "nudge" as const, title: t("rebus.timeUpTitle"), message: t("rebus.timeUpText") }
        : { tone: "nudge" as const, title: t("rebus.skippedTitle"), message: t("rebus.skippedText") };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-20">
      <Scores state={state} active={last.player} />
      <UIKidMessage {...message} actionLabel={finalPuzzle ? t("rebus.seeResults") : t("rebus.turns.passTo", { name: show(next.name) })} onAction={() => game.send({ type: "next" })} />
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

/** The results: a podium, and play again or leave. */
export const TurnsFinal: React.FC<{ game: TurnsGame; onAgain(): void; onLeave(): void }> = ({ game, onAgain, onLeave }) => {
  const { t } = useT();
  const show = useNickname();
  const state = game.state as TurnsState;
  const standings = standingsOf(state);
  const winners = standings.filter((s) => s.place === 1);

  useEffect(() => {
    cue(winners.length === 1 ? "roundWon" : "roundTie");
    // Said once, when the results appear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The podium draws rooms' players; here a "player" is a seat at this device.
  const players: RoomPlayer[] = state.config.players.map((p, i) => ({ pid: String(i), name: p.name, avatar: p.avatar, score: state.scores[i], solved: standings.find((s) => s.player === i)?.solved ?? 0, isHost: false, isKodaUser: false, connected: true }));
  const rest = standings.filter((s) => s.place > 3);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <Trophy aria-hidden="true" className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        <h2 role="status" className={themeSystem.typography("h2")}>
          {winners.length === 1 ? t("rebus.group.play.winnerIs", { name: show(state.config.players[winners[0].player].name) }) : t("rebus.group.play.itsATie")}
        </h2>
      </div>
      <Podium standings={standings.map((s) => ({ pid: String(s.player), place: s.place, score: s.score }))} players={players} mePid="" />
      {rest.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label={t("rebus.group.play.finalTitle")} start={4}>
          {rest.map((s) => (
            <li key={s.player} className={themeSystem.card("default", "flex items-center gap-3 px-3 py-2")}>
              <span className="w-8 text-center text-2xl font-black text-ink">{s.place}</span>
              <RoomAvatar avatar={state.config.players[s.player].avatar} />
              <span className="min-w-0 flex-1 truncate font-black text-ink">{show(state.config.players[s.player].name)}</span>
              <span className="text-xl font-black text-ink">{t("rebus.group.play.pts", { n: s.score })}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-col gap-2">
        <UIButton size="lg" fullWidth icon={<RotateCcw />} onClick={onAgain}>
          {t("rebus.playAgain")}
        </UIButton>
        <UIButton variant="ghost" fullWidth icon={<LogOut />} onClick={onLeave}>
          {t("rebus.turns.leave")}
        </UIButton>
      </div>
    </div>
  );
};
