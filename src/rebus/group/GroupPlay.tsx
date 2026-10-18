/**
 * One puzzle of a group race, from the countdown to the reveal.
 *
 * Everybody sees the same puzzle at the same moment (the server's clock, not
 * this device's). Typing the right answer sends one claim to the server; the
 * first claim to arrive wins the puzzle's points and ends it for everyone, and
 * anybody else is told who was first. The device checks the answer itself, so
 * typing never waits on the network.
 */

import React, { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIKidMessage, UIProgressBar } from "../../components/ui";
import { matchAnswer } from "../answer";
import { hintFor, hintState, type Hint } from "../hints";
import { cue } from "../sound";
import type { Puzzle } from "../types";
import { PuzzleCanvas } from "../ui/PieceView";
import { roomErrorKey } from "./errors";
import { GroupAPI } from "./groupApi";
import { useNickname } from "./NicknamePicker";
import { Scoreboard } from "./Scoreboard";
import type { RoomView } from "./types";
import { useServerClock } from "./useServerClock";

export interface GroupPlayProps {
  room: RoomView;
  token: string;
  skewMs: number;
  apply(room: RoomView): void;
}

/** What this player did on this puzzle. Reset for each one. */
interface Mine {
  hints: Hint[];
  lastHintMs: number;
  wrong: number;
  /** The answer was right and the claim is on its way or answered. */
  claimed: boolean;
  won: boolean | null;
  error: string;
}

const fresh = (startMs: number): Mine => ({ hints: [], lastHintMs: startMs, wrong: 0, claimed: false, won: null, error: "" });

export const GroupPlay: React.FC<GroupPlayProps> = ({ room, token, skewMs, apply }) => {
  const { t } = useT();
  const show = useNickname();
  const now = useServerClock(skewMs);
  const puzzle = room.puzzle as Puzzle;
  const index = room.index ?? 0;
  const startMs = room.startMs ?? 0;
  const limitMs = room.limitMs ?? 60_000;
  const [mine, setMine] = useState<Mine>(() => fresh(startMs));
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // A new puzzle: a clean slate, and the cursor in the box when it opens.
  useEffect(() => {
    setMine(fresh(startMs));
    setText("");
  }, [index, startMs]);

  const counting = now < startMs;
  const ended = room.endedMs != null;
  const locallyOver = !ended && now >= startMs + limitMs;
  const live = !counting && !ended && !locallyOver;

  useEffect(() => {
    if (live) input.current?.focus();
  }, [live, index]);

  // Sound at the moments that matter, once each.
  const sounded = useRef("");
  useEffect(() => {
    const key = `${index}:${ended ? "ended" : locallyOver ? "over" : counting ? "count" : "live"}`;
    if (sounded.current === key) return;
    sounded.current = key;
    if (key.endsWith("live")) cue("start");
    else if (ended && room.result?.winnerPid && room.result.winnerPid !== room.me.pid) cue("machineWon");
    else if (key.endsWith("over") || (ended && !room.result?.winnerPid)) cue("timeUp");
  }, [index, ended, locallyOver, counting, room.result, room.me.pid]);

  const hint = hintState(room.settings, mine.hints.length, mine.lastHintMs / 1000, now / 1000);

  const takeHint = () => {
    if (hint.state !== "ready" || !live) return;
    cue("hintTaken");
    setMine((m) => ({ ...m, hints: [...m.hints, hintFor(puzzle, hint.rung)], lastHintMs: now }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!live || mine.claimed || !text.trim()) return;
    if (!matchAnswer(puzzle, text).ok) {
      cue("wrong");
      setMine((m) => ({ ...m, wrong: m.wrong + 1 }));
      setText("");
      input.current?.focus();
      return;
    }
    setMine((m) => ({ ...m, claimed: true, error: "" }));
    try {
      const res = await GroupAPI.solve(room.code, token, index, mine.hints.length);
      if (res.won) cue("solved");
      setMine((m) => ({ ...m, won: res.won }));
      apply(res.room);
    } catch (err) {
      // The claim did not get through: the player may answer again.
      setMine((m) => ({ ...m, claimed: false, error: t(roomErrorKey(err)) }));
    }
  };

  const total = room.total ?? 1;
  const remaining = Math.max(0, Math.ceil((startMs + limitMs - now) / 1000));
  const winner = room.result?.winnerPid ? room.players.find((p) => p.pid === room.result?.winnerPid) : null;
  const iWon = winner?.pid === room.me.pid;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-20">
      <UIProgressBar value={index + (ended ? 1 : 0)} max={total} size="sm" label={t("rebus.puzzleOf", { n: index + 1, total })} caption={t("rebus.puzzleOf", { n: index + 1, total })} />
      <Scoreboard players={room.players} meId={room.me.pid} />

      {counting ? (
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 py-16 text-center">
          <span className={themeSystem.typography("h3")}>{t("rebus.group.play.ready")}</span>
          <span className="text-7xl font-black text-indigo-600 dark:text-indigo-400">{Math.max(1, Math.ceil((startMs - now) / 1000))}</span>
        </div>
      ) : (
        <>
          <PuzzleCanvas pieces={puzzle.pieces} label={t("rebus.puzzle")} />

          {ended || locallyOver ? (
            <div className="flex flex-col gap-3">
              <div aria-live="polite">
                {winner ? (
                  <UIKidMessage
                    tone={iWon ? "correct" : "nudge"}
                    title={iWon ? t("rebus.group.play.youFirst") : t("rebus.group.play.someoneFirst", { name: show(winner.name) })}
                    message={t("rebus.group.play.points", { points: room.result?.points ?? 0 })}
                  />
                ) : (
                  <UIKidMessage tone="nudge" title={t("rebus.timeUpTitle")} message={t("rebus.group.play.nobody")} />
                )}
              </div>
              {ended && (
                <>
                  <div className="text-center">
                    <div className={themeSystem.typography("caption")}>{t("rebus.answerWas")}</div>
                    <div className="text-3xl font-black text-ink">{puzzle.answer}</div>
                  </div>
                  <div className={themeSystem.card("default", themeSystem.spacing.cardSm)}>
                    <span className="font-black text-ink">{t("rebus.why")} </span>
                    <span className="text-body">{puzzle.explanation}</span>
                  </div>
                  <p className={themeSystem.typography("caption", "text-center")}>
                    {index + 1 >= total ? t("rebus.group.play.finishing") : t("rebus.group.play.nextIn", { seconds: Math.max(1, Math.ceil(((room.revealUntilMs ?? now) - now) / 1000)) })}
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <UIProgressBar value={remaining} max={Math.round(limitMs / 1000)} size="sm" label={t("rebus.seconds", { seconds: remaining })} caption={t("rebus.seconds", { seconds: remaining })} />

              <div aria-live="polite">
                {mine.claimed && mine.won === null ? (
                  <UIKidMessage tone="correct" title={t("rebus.group.play.checking")} />
                ) : mine.won === false ? (
                  <UIKidMessage tone="nudge" title={t("rebus.group.play.tooLate")} />
                ) : mine.error ? (
                  <p role="alert" className={themeSystem.flash("error")}>
                    {mine.error}
                  </p>
                ) : mine.wrong > 0 ? (
                  <UIKidMessage tone="nudge" title={t("rebus.wrongTitle")} message={t("rebus.wrongText")} />
                ) : null}
              </div>

              {mine.hints.length > 0 && (
                <ul className={themeSystem.card("default", "flex flex-col gap-1.5 p-3")}>
                  {mine.hints.map((h) => (
                    <li key={h.rung} className="flex items-start gap-2 text-sm font-bold text-ink">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                      {h.text}
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={(e) => void submit(e)} className="flex gap-2">
                <input
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
                  disabled={mine.claimed}
                  className={`${themeSystem.field("lg")} min-w-0 flex-1`}
                />
                <UIButton type="submit" disabled={!text.trim() || mine.claimed}>
                  {t("rebus.check")}
                </UIButton>
              </form>

              <UIButton variant="secondary" fullWidth disabled={hint.state !== "ready"} onClick={takeHint} icon={<Lightbulb />}>
                {hint.state === "locked"
                  ? t("rebus.hintLocked", { seconds: Math.ceil(hint.secondsLeft) })
                  : hint.state === "ready"
                    ? t("rebus.hintReady", { n: hint.rung, total: room.settings.hintRungs }) + (room.settings.hintCost > 0 ? ` ${t("rebus.hintCostSuffix", { cost: room.settings.hintCost })}` : "")
                    : t("rebus.hintNone")}
              </UIButton>
            </>
          )}
        </>
      )}
    </div>
  );
};
