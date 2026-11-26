import React, { useCallback, useRef, useState } from "react";
import { readsAloud } from "../internal/readsAloud";
import { motion } from "motion/react";
import type { ActivityProps } from "../../types";
import {
  HowToPlay,
  HowToPlayButton,
  SkillRound,
  answerChoices,
  composeHints,
  isPractice,
  playCopy,
  useHowToPlay,
  useMotionOK,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { tx } from "../internal/i18n";
import { TRACK, buildTrack, isProper, trackModeAt, type Block, type TrackQuestion, type TrackSetup } from "../internal/track";
import { ThingArt } from "./things";
import { UnitsDemoScene, unitsDemoSteps } from "./MeasureDemos";

/**
 * UnitTrack — measuring with blocks. `lay`: tap to lay blocks end to end
 * along a thing, then say how many. `spot`: of two rows, tap the one laid
 * properly, then count it. `unit_size`: the same thing in cubes and in rods;
 * which needs more (or fewer)?
 *
 * The number of blocks laid is never printed: counting them is the lesson.
 */

interface TrackParams extends TrackSetup {
  question?: TrackSetup;
}
export interface TrackRoundQuestion extends RoundQuestion {
  q: TrackQuestion;
}

const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);
const thingName = (t: string) => tx(`thing.${t}`);
const pct = (v: number) => `${(v / TRACK) * 100}%`;

export function trackPrompt(q: TrackQuestion): string {
  const thing = thingName(q.thing);
  if (q.mode === "lay") return tx("track.prompt.lay", { thing });
  if (q.mode === "spot") return tx("track.prompt.spot", { thing });
  return tx(q.ask === "more" ? "track.prompt.unit_more" : "track.prompt.unit_fewer", { thing });
}

export function buildTrackQuestion(params: TrackParams, index: number, seen: Set<string> = new Set()): TrackRoundQuestion {
  const setup = { ...params, ...params.question };
  const q = buildTrack(setup, trackModeAt(setup, index), seen);
  return {
    id: `track-${index}-${q.mode}-${q.thing}-${q.length}-${q.flaw ?? ""}-${q.rod ?? ""}-${q.ask ?? ""}-${q.answer}`,
    taskKind: `track_${q.mode}`,
    prompt: trackPrompt(q),
    expected: q.mode === "spot" ? String(q.length) : q.answer,
    q,
  };
}

export function trackHints(q: TrackQuestion, kidTip?: string): string[] {
  const key = q.mode === "unit_size" ? "unit" : q.mode;
  return composeHints(kidTip, tx(`track.hint.${key}.look`, { thing: thingName(q.thing), rod: String(q.rod ?? "") }), tx(`track.hint.${key}.worked`));
}

interface Play {
  qid: string;
  laid: number;
  rowPicked: boolean;
  status: string | null;
}

const choiceClass =
  "min-h-11 min-w-14 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-lg font-black text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500";

const overlaps = (row: Block[]) => row.some((b, i) => i > 0 && b.at < row[i - 1].at + row[i - 1].len - 1e-9);

/** One drawn row of blocks on the 10-cube track. */
const BlockRow: React.FC<{ blocks: Block[]; tone: "violet" | "emerald"; motionOK: boolean; flagFlaws?: boolean; testId?: string }> = ({
  blocks,
  tone,
  motionOK,
  flagFlaws,
  testId,
}) => (
  <div className="relative h-8" data-testid={testId} data-count={blocks.length}>
    {blocks.map((b, i) => {
      const prev = blocks[i - 1];
      const gap = flagFlaws && prev && b.at > prev.at + prev.len + 1e-9;
      const over = flagFlaws && prev && b.at < prev.at + prev.len - 1e-9;
      return (
        <React.Fragment key={i}>
          {gap && (
            <span className="absolute inset-y-0 rounded bg-rose-300/70 dark:bg-rose-500/50" style={{ left: pct(prev.at + prev.len), width: pct(b.at - prev.at - prev.len) }} data-testid="flaw" />
          )}
          <motion.span
            className={`absolute inset-y-0 rounded border-2 ${tone === "violet" ? "border-violet-700 bg-violet-400" : "border-emerald-700 bg-emerald-400"} ${over ? "ring-2 ring-rose-500" : ""}`}
            // Overlapping blocks sit staggered, so they read as lying on top of each other.
            style={{ left: pct(b.at), width: pct(b.len), ...(overlaps(blocks) ? { top: i % 2 ? -5 : 5, bottom: i % 2 ? 5 : -5 } : {}) }}
            initial={motionOK ? { y: -16, opacity: 0 } : false}
            animate={{ y: 0, opacity: 1 }}
            transition={motionOK ? { type: "spring", stiffness: 420, damping: 24 } : { duration: 0 }}
            data-testid={over ? "flaw" : undefined}
          />
        </React.Fragment>
      );
    })}
  </div>
);

/**
 * The thing being measured, drawn to scale from the start line. `indent` lines
 * it up with labelled rows below it: "label" for plain rows, "framed" for rows
 * that are bordered buttons.
 */
const ThingOnTrack: React.FC<{ q: TrackQuestion; indent?: "label" | "framed" }> = ({ q, indent }) => {
  const thing = (
    <div className="relative h-10">
      <div className="h-full" style={{ width: pct(q.length) }} data-testid="track-thing" data-length={q.length}>
        <ThingArt thing={q.thing} colour="pink" />
      </div>
    </div>
  );
  if (!indent) return thing;
  return (
    <div className={`flex items-center gap-2 ${indent === "framed" ? "border-2 border-transparent p-1" : ""}`}>
      <span className="w-14 shrink-0" aria-hidden="true" />
      <span className="flex-1">{thing}</span>
    </div>
  );
};

export const UnitTrack: React.FC<ActivityProps<TrackParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = { ...params, ...params.question };
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;
  const motionOK = useMotionOK() && koda.config.isEnabled("instrument_motion", true);
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const soundEnabled = koda.config.isEnabled("sound_chimes", true);
  const hapticsEnabled = koda.config.isEnabled("haptic_feedback", true);
  const seen = useRef(new Set<string>());

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising || !readsAloud(lesson?.id) ? undefined : copy.audioPrompt,
    resumable: practising,
    nextQuestion: useCallback((i: number) => buildTrackQuestion(params, i, seen.current), [params]),
    onComplete,
  });
  const question = round.question as TrackRoundQuestion;
  const q = question.q;
  const locked = Boolean(round.feedback);

  const firstMode = setup.modes?.[0] ?? setup.mode ?? "lay";
  const demo = useHowToPlay(`${koda.skillId}/units`, !practising && firstMode === "lay");
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);

  const fresh = (): Play => ({ qid: question.id, laid: 0, rowPicked: false, status: null });
  const [stored, setStored] = useState<Play>(fresh);
  const play = stored.qid === question.id ? stored : fresh();
  const update = (next: Partial<Play>) => setStored({ ...play, ...next });

  const chime = (name: "pop" | "success" | "error") => {
    if (soundEnabled && koda.sound.isEnabled()) koda.sound.play(name);
  };
  const buzz = (ok: boolean) => {
    if (!hapticsEnabled) return;
    if (ok) koda.haptics.success(); else koda.haptics.pulse("error");
  };

  const thing = thingName(q.thing);
  const submit = (given: string, correct: boolean, message: string) => {
    if (locked) return;
    chime(correct ? "success" : "error");
    buzz(correct);
    round.submit({ correct, given, expected: question.expected ?? q.answer, title: tx(correct ? "title.right" : "title.wrong"), message });
  };
  const refuse = (message: string) => {
    chime("error");
    update({ status: message });
  };

  const hints = practising ? [] : trackHints(q, copy.kidTip);
  const rung = round.hint.open ? round.hint.level : 0;

  const numberChoices = (onPick: (n: number) => void) => (
    <div className="flex flex-wrap justify-center gap-2">
      {answerChoices(q.length, question.id, { min: 1, max: TRACK }).map((n) => (
        <button key={n} type="button" disabled={locked} className={choiceClass} onClick={() => onPick(n)}>
          {n}
        </button>
      ))}
    </div>
  );

  let board: React.ReactNode;

  if (q.mode === "lay") {
    const lay = (n: number) => {
      chime("pop");
      update({
        laid: n,
        status: n === q.length ? tx("track.status.covered", { thing: cap(thing) }) : n > q.length ? tx("track.status.past") : null,
      });
    };
    board = (
      <div className="flex flex-col gap-3">
        <div className="relative flex flex-col gap-1 rounded-2xl bg-surface p-3 shadow-inner" data-testid="track-bench">
          <div className="pointer-events-none absolute bottom-2 left-3 top-2 border-l-[3px] border-dashed border-ink/40" aria-hidden="true" />
          <ThingOnTrack q={q} />
          <div className="relative">
            <BlockRow blocks={Array.from({ length: play.laid }, (_, i) => ({ at: i, len: 1 }))} tone="violet" motionOK={motionOK} testId="laid" />
            {rung >= 2 && play.laid < q.length && (
              <span className="absolute inset-y-0 rounded border-2 border-dashed border-violet-500" style={{ left: pct(play.laid), width: pct(1) }} data-testid="next-ghost" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" disabled={locked || play.laid === 0} onClick={() => lay(play.laid - 1)}
            className="min-h-11 rounded-2xl border-2 border-line bg-surface px-4 py-2 font-bold text-ink disabled:opacity-40">
            {tx("track.takeBlock")}
          </button>
          <button type="button" disabled={locked || play.laid >= TRACK} onClick={() => lay(play.laid + 1)}
            className="min-h-11 rounded-2xl border-2 border-violet-400 bg-violet-50 px-4 py-2 font-bold text-violet-800 disabled:opacity-40 dark:bg-violet-950/40 dark:text-violet-200">
            {tx("track.addBlock")}
          </button>
        </div>
        {numberChoices((n) =>
          play.laid < q.length
            ? refuse(tx("track.status.coverFirst", { thing }))
            : play.laid > q.length
              ? refuse(tx("track.status.past"))
              : submit(String(n), n === q.length, n === q.length ? tx("track.right.lay", { thing: cap(thing), count: String(n) }) : tx("track.wrong.lay")),
        )}
      </div>
    );
  } else if (q.mode === "spot") {
    const good = Number(q.answer);
    board = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3 shadow-inner" data-testid="track-bench">
          <ThingOnTrack q={q} indent="framed" />
          {q.rows!.map((row, i) => (
            <button
              key={i}
              type="button"
              disabled={locked || play.rowPicked}
              aria-label={tx("track.row", { n: String(i + 1) })}
              aria-pressed={play.rowPicked && i === good}
              onClick={() => {
                if (i === good) {
                  chime("pop");
                  update({ rowPicked: true, status: tx("track.status.rowRight") });
                } else {
                  submit(`row${i}`, false, tx("track.wrong.spot"));
                }
              }}
              className={`flex items-center gap-2 rounded-xl border-2 p-1 text-left ${play.rowPicked && i === good ? "border-emerald-500" : "border-line"}`}
            >
              <span className="w-14 shrink-0 text-xs font-black uppercase text-body">{tx("track.row", { n: String(i + 1) })}</span>
              <span className="flex-1">
                <BlockRow blocks={row} tone="violet" motionOK={false} flagFlaws={rung >= 2 && !isProper(row)} testId={`row-${i}`} />
              </span>
            </button>
          ))}
        </div>
        {play.rowPicked && (
          <>
            <p className="text-center font-bold text-ink">{tx("track.prompt.count")}</p>
            {numberChoices((n) =>
              submit(String(n), n === q.length, n === q.length ? tx("track.right.spot", { thing: cap(thing), count: String(n) }) : tx("track.wrong.count")),
            )}
          </>
        )}
      </div>
    );
  } else {
    const rods = q.length / q.rod!;
    board = (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3 shadow-inner" data-testid="track-bench">
          <ThingOnTrack q={q} indent="label" />
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs font-black uppercase text-body">{tx("track.cube")}</span>
            <span className="flex-1"><BlockRow blocks={Array.from({ length: q.length }, (_, i) => ({ at: i, len: 1 }))} tone="violet" motionOK={motionOK} testId="cubes" /></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs font-black uppercase text-body">{tx("track.rod")}</span>
            <span className="relative flex-1">
              <BlockRow blocks={Array.from({ length: rods }, (_, i) => ({ at: i * q.rod!, len: q.rod! }))} tone="emerald" motionOK={motionOK} testId="rods" />
              {rung >= 2 &&
                Array.from({ length: q.length }, (_, i) =>
                  i % q.rod! === 0 ? null : (
                    <span key={i} className="pointer-events-none absolute inset-y-1 border-l-2 border-dashed border-emerald-900/60" style={{ left: pct(i) }} data-testid="rod-split" />
                  ),
                )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {(["cube", "rod"] as const).map((u) => (
            <button key={u} type="button" disabled={locked} className={choiceClass}
              onClick={() => submit(u, u === q.answer, u === q.answer ? tx("track.right.unit") : tx("track.wrong.unit"))}>
              {tx(`track.${u}`)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const canStartOver = !locked && (play.laid > 0 || play.rowPicked);

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("track.addBlock")}
      round={round}
      totalQuestions={total}
      prompt={question.prompt ?? ""}
      onExit={() => koda.ui.exit()}
      hints={hints}
      iconName="boxes"
      iconTone="purple"
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
      onStartOver={canStartOver ? () => setStored(fresh()) : undefined}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3" data-motion={motionOK ? "on" : "off"}>
        {board}
        <p className="min-h-6 text-center text-base font-semibold text-body" aria-live="polite">{play.status}</p>
        {!practising && firstMode === "lay" && <HowToPlayButton onClick={demo.show} />}
      </div>
      {firstMode === "lay" && (
        <HowToPlay
          open={demo.open}
          steps={unitsDemoSteps()}
          scene={(step, phase) => <UnitsDemoScene step={step} phase={phase} motionOK={motionOK} />}
          onClose={demo.close}
          speak={sayCaption}
        />
      )}
    </SkillRound>
  );
};
