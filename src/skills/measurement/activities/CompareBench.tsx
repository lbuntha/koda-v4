import React, { useCallback, useRef, useState } from "react";
import { readsAloud } from "../internal/readsAloud";
import { motion } from "motion/react";
import { Apple, Bath, Beaker, Bed, Book, Bus, Car, Carrot, CupSoda, Feather, Key, Ruler, Scale, type LucideIcon } from "lucide-react";
import type { ActivityProps } from "../../types";
import {
  HowToPlay,
  HowToPlayButton,
  SPRING,
  SkillRound,
  composeHints,
  isPractice,
  playCopy,
  useHowToPlay,
  useMotionOK,
  useSkillRound,
  type RoundQuestion,
} from "../../kit";
import { tx } from "../internal/i18n";
import {
  BENCH,
  buildCompare,
  compareModeAt,
  type Ask,
  type CompareMode,
  type CompareQuestion,
  type CompareSetup,
  type Everyday,
  type Item,
  type Tool,
} from "../internal/compare";
import { CompareDemoScene, compareDemoSteps, orderDemoSteps } from "./CompareDemo";
import { ThingArt } from "./things";

/**
 * CompareBench — comparing by looking: longer, taller, in order, lined up, or
 * carried across the room on a string; and which tool answers which question.
 *
 * Everything is tap-to-place (`ADDITION_BUILD_PLAN.md` §5.0): tap the thing,
 * then tap where it goes. Objects are drawn at their exact length on a bench
 * `BENCH` spaces wide, so what the child sees is what is being asked.
 */

interface CompareParams extends CompareSetup {
  question?: CompareSetup;
}

export interface CompareRoundQuestion extends RoundQuestion {
  q: CompareQuestion;
}

const cap = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);

/** "the purple pencil" in English, "ខ្មៅដៃពណ៌ស្វាយ" in Khmer. */
export const nameOf = (item: Item): string =>
  tx("the", { thing: tx("named", { colour: tx(`colour.${item.colour}`), thing: tx(`thing.${item.thing}`) }) });
/** A fixed or everyday thing has no colour in its name. */
const plainName = (thing: string): string => tx("the", { thing: tx(`thing.${thing}`) });

export function promptOf(q: CompareQuestion): string {
  switch (q.mode) {
    case "attribute":
      return tx("prompt.attribute", { ask: tx(`ask.${q.ask}`), a: plainName(q.pair![0]), b: plainName(q.pair![1]) });
    case "pick":
    case "pick_vertical":
      return tx("prompt.pick", { ask: tx(`ask.${q.ask}`) });
    case "align":
      return tx("prompt.align");
    case "order":
      return tx("prompt.order");
    case "indirect":
      return tx("prompt.indirect", { ask: tx(`ask.${q.ask}`), a: plainName(q.items[0].thing), b: plainName(q.items[1].thing) });
  }
}

export function buildCompareQuestion(params: CompareParams, index: number, seen: Set<string> = new Set()): CompareRoundQuestion {
  const setup = { ...params, ...params.question };
  const mode = compareModeAt(setup, index);
  const q = buildCompare(setup, mode, seen);
  return {
    id: `compare-${index}-${q.answer}-${q.items.map((i) => i.size).join("-")}`,
    taskKind: `compare_${mode}`,
    prompt: promptOf(q),
    expected: q.answer,
    itemCount: q.items.length,
    q,
  };
}

/** Rungs 2 and 3 for the question on screen (rung 1 is the lesson's `kidTip`). */
export function compareHints(q: CompareQuestion, kidTip?: string): string[] {
  const a = q.items[0] ? plainName(q.items[0].thing) : "";
  const b = q.items[1] ? plainName(q.items[1].thing) : "";
  switch (q.mode) {
    case "pick":
      return composeHints(kidTip, tx("hint.pick.look"), tx(`hint.pick.${q.ask === "shorter" ? "shorter" : "longer"}`));
    case "pick_vertical":
      return composeHints(kidTip, tx("hint.pickVertical.look"), tx(`hint.pickVertical.${q.ask === "lower" ? "lower" : "taller"}`));
    case "align":
      return composeHints(kidTip, tx("hint.align.look"), tx("hint.align.worked"));
    case "order":
      return composeHints(kidTip, tx("hint.order.look"), tx("hint.order.worked"));
    case "indirect":
      return composeHints(kidTip, tx("hint.indirect.look", { a, b }), tx(`hint.indirect.${q.ask === "lower" ? "lower" : "taller"}`, { a, b }));
    case "attribute":
      return composeHints(kidTip, tx("hint.attribute.look"), tx("hint.attribute.worked"));
  }
}

const TOOLS: Tool[] = ["ruler", "balance", "jug"];
const TOOL_ICON: Record<Tool, LucideIcon> = { ruler: Ruler, balance: Scale, jug: Beaker };
/* Each icon is the object itself, so the picture never disagrees with the word. */
const EVERYDAY_ICON: Record<Everyday, LucideIcon> = {
  apple: Apple,
  car: Car,
  cup: CupSoda,
  bath: Bath,
  key: Key,
  bus: Bus,
  carrot: Carrot,
  bed: Bed,
  book: Book,
  feather: Feather,
};

const pct = (spaces: number) => `${(spaces / BENCH) * 100}%`;

type StringState = "none" | "cut" | "carried";

interface Play {
  qid: string;
  /** Current start of each item, in spaces (only `align` moves them). */
  starts: number[];
  held: number | null;
  /** `order`: item index in each slot. */
  slots: (number | null)[];
  string: StringState;
  status: string | null;
}

export const CompareBench: React.FC<ActivityProps<CompareParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = { ...params, ...params.question };
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;
  const motionOK = useMotionOK();
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
    nextQuestion: useCallback((i: number) => buildCompareQuestion(params, i, seen.current), [params]),
    onComplete,
  });
  const question = round.question as CompareRoundQuestion;
  const q = question.q;
  const locked = Boolean(round.feedback);

  /* How to play: one demo per interaction, shown by itself the first time a learner meets it, never in practice. */
  const firstMode: CompareMode = setup.modes?.[0] ?? setup.mode ?? "pick";
  const demoKind = demoKindFor(firstMode);
  const demo = useHowToPlay(`${koda.skillId}/${demoKind ?? "none"}`, !practising && demoKind !== null);
  const sayCaption = useCallback((line: string) => {
    if (speechEnabled) void koda.speech.say(line, { rate: koda.config.get("speechRate", 1) });
  }, [speechEnabled, koda]);

  const fresh = (): Play => ({
    qid: question.id,
    starts: q.items.map((i) => i.start),
    held: null,
    slots: q.items.map(() => null),
    string: "none",
    status: q.mode === "align" ? tx("status.tapToMove") : q.mode === "indirect" ? tx("status.stringStart", { a: plainName(q.items[0].thing) }) : null,
  });
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
  const refuse = (message: string) => {
    chime("error");
    update({ status: message });
  };

  const submit = (given: string) => {
    if (locked) return;
    const correct = given === q.answer;
    chime(correct ? "success" : "error");
    buzz(correct);
    const winner = q.items.find((i) => i.key === q.answer);
    const message = correct
      ? q.mode === "order"
        ? tx("right.order")
        : q.mode === "attribute"
          ? tx("right.attribute", { tool: tx(`tool.${q.answer}`).toLocaleLowerCase() })
          : tx("right.pick", { name: cap(winner ? (q.mode === "indirect" ? plainName(winner.thing) : nameOf(winner)) : ""), ask: tx(`ask.${q.ask}`) })
      : tx(`wrong.${q.mode === "pick_vertical" ? "pickVertical" : q.mode}`);
    round.submit({ correct, given, expected: q.answer, title: tx(correct ? "title.right" : "title.wrong"), message });
  };

  const hints = practising ? [] : compareHints(q, copy.kidTip);
  const rung = round.hint.open ? round.hint.level : 0;
  const lined = play.starts.every((s) => s === 0);
  const filled = play.slots.every((s) => s !== null);

  /* ---------------------------------------------------------------- board */

  const nameFor = (item: Item) => (q.mode === "indirect" ? plainName(item.thing) : nameOf(item));

  const answerButtons = (onPick: (item: Item) => void) => (
    <div className="flex flex-wrap justify-center gap-3">
      {q.items.map((item) => (
        <button
          key={item.key}
          type="button"
          disabled={locked}
          onClick={() => onPick(item)}
          className="min-h-11 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-base font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          {cap(tx("label.answerIs", { name: nameFor(item) }))}
        </button>
      ))}
    </div>
  );

  let board: React.ReactNode = null;

  if (q.mode === "pick" || q.mode === "align") {
    board = (
      <div className="flex flex-col gap-4">
        <div className="relative w-full rounded-2xl bg-surface p-3 shadow-inner" data-testid="compare-bench">
          <div className="relative ml-12" style={{ height: q.items.length * 56 }}>
            {/* The start line: a real button in `align`, a plain mark otherwise. */}
            {q.mode === "align" ? (
              <button
                type="button"
                disabled={locked}
                aria-label={play.held === null ? tx("label.startLine") : tx("label.startLineHeld", { name: nameOf(q.items[play.held]) })}
                onClick={() => {
                  if (play.held === null) return;
                  const starts = [...play.starts];
                  starts[play.held] = 0;
                  chime("pop");
                  update({ starts, held: null, status: starts.every((s) => s === 0) ? tx("status.lined") : tx("status.tapToMove") });
                }}
                className={`absolute -left-11 top-0 bottom-0 w-10 rounded-xl border-2 border-dashed text-[10px] font-black uppercase leading-tight text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${play.held !== null ? "border-violet-600 bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200" : "border-line"}`}
              >
                <span className="block [writing-mode:vertical-rl] rotate-180 mx-auto">{tx("label.startLine")}</span>
              </button>
            ) : null}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 border-l-[3px] border-dashed border-ink/40" aria-hidden="true" />
            {q.items.map((item, i) => {
              const start = play.starts[i];
              const held = play.held === i;
              return (
                <React.Fragment key={item.key}>
                  <motion.button
                    type="button"
                    disabled={locked}
                    aria-label={q.mode === "align" ? cap(tx("label.onBench", { name: nameOf(item) })) : cap(nameOf(item))}
                    aria-pressed={q.mode === "align" ? held : undefined}
                    initial={motionOK ? { opacity: 0, x: -30 } : false}
                    animate={{ opacity: 1, x: 0, left: pct(start), y: held && motionOK ? -4 : 0 }}
                    transition={motionOK ? SPRING.settle : { duration: 0 }}
                    style={{ top: i * 56 + 8, width: pct(item.size), position: "absolute" }}
                    onClick={() => {
                      if (q.mode === "pick") return submit(item.key);
                      if (start === 0) return update({ held: null, status: tx("status.tapToMove") });
                      chime("pop");
                      update({ held: held ? null : i, status: held ? tx("status.tapToMove") : tx("status.held") });
                    }}
                    className={`h-10 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${held ? "ring-4 ring-violet-500 ring-offset-2 ring-offset-surface" : ""}`}
                  >
                    <ThingArt thing={item.thing} colour={item.colour} />
                  </motion.button>
                  {rung >= 2 && q.mode === "pick" && (
                    <span
                      className="pointer-events-none absolute border-l-[3px] border-dashed border-rose-500"
                      style={{ left: pct(start + item.size), top: 0, bottom: 0 }}
                      data-testid="end-mark"
                      aria-hidden="true"
                    />
                  )}
                  {rung >= 2 && q.mode === "align" && start !== 0 && (
                    <span
                      className="pointer-events-none absolute rounded-lg border-2 border-dashed border-violet-500"
                      style={{ left: 0, top: i * 56 + 6, width: pct(item.size), height: 44 }}
                      data-testid="ghost"
                      aria-hidden="true"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        {q.mode === "align" && answerButtons((item) => (lined ? submit(item.key) : refuse(tx("refuse.alignFirst"))))}
      </div>
    );
  }

  if (q.mode === "pick_vertical") {
    board = (
      <div className="relative mx-auto flex h-64 w-full max-w-md items-end justify-center gap-10 rounded-2xl bg-surface px-6 pt-4 shadow-inner" data-testid="compare-bench">
        <div className="pointer-events-none absolute inset-x-3 bottom-3 border-b-4 border-ink/50" aria-hidden="true" />
        {q.items.map((item, i) => (
          <motion.button
            key={item.key}
            type="button"
            disabled={locked}
            aria-label={cap(nameOf(item))}
            onClick={() => submit(item.key)}
            initial={motionOK ? { opacity: 0, y: 30 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={motionOK ? { ...SPRING.enter, delay: i * 0.12 } : { duration: 0 }}
            className="relative mb-3 flex w-16 justify-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            style={{ height: `${(item.size / BENCH) * 100}%` }}
          >
            <ThingArt thing={item.thing} colour={item.colour} vertical />
            {rung >= 2 && (
              <span className="pointer-events-none absolute -inset-x-6 top-0 border-t-[3px] border-dashed border-rose-500" data-testid="end-mark" aria-hidden="true" />
            )}
          </motion.button>
        ))}
      </div>
    );
  }

  if (q.mode === "order") {
    const slotNames = ["shortest", "middle", "longest"] as const;
    const shortest = [...q.items].sort((x, y) => x.size - y.size)[0];
    const piece = (i: number, label: string, onClick: () => void) => {
      const item = q.items[i];
      return (
        <motion.button
          key={item.key}
          layout={motionOK}
          type="button"
          disabled={locked}
          aria-label={label}
          onClick={onClick}
          transition={motionOK ? SPRING.settle : { duration: 0 }}
          className={`h-10 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${rung >= 2 && item.key === shortest.key ? "ring-4 ring-emerald-400" : ""}`}
          style={{ width: pct(item.size) }}
        >
          <ThingArt thing={item.thing} colour={item.colour} />
        </motion.button>
      );
    };
    board = (
      <div className="flex flex-col gap-3 rounded-2xl bg-surface p-3 shadow-inner" data-testid="compare-bench">
        {slotNames.map((slot, s) => {
          const at = play.slots[s];
          const label = tx(`label.slot.${slot}`);
          return (
            <div key={slot} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-black uppercase tracking-wide text-body">{label}</span>
              <div className="flex min-h-12 flex-1 items-center rounded-xl border-2 border-dashed border-line px-1" aria-label={at === null ? tx("label.slotEmpty", { slot: label }) : undefined}>
                {at !== null &&
                  piece(at, tx("label.slotFilled", { slot: label, name: cap(nameOf(q.items[at])) }), () => {
                    const slots = [...play.slots];
                    slots[s] = null;
                    update({ slots });
                  })}
              </div>
            </div>
          );
        })}
        <div className="flex min-h-12 flex-col gap-1 border-t border-line pt-3">
          {q.items.map((_, i) =>
            play.slots.includes(i)
              ? null
              : (
                  /* Same label gutter and padding as a slot, so a piece is drawn at one length wherever it sits. */
                  <div key={q.items[i].key} className="flex items-center gap-2">
                    <span className="w-20 shrink-0" aria-hidden="true" />
                    <div className="flex min-h-12 flex-1 items-center border-2 border-transparent px-1">
                      {piece(i, tx("label.inPool", { name: cap(nameOf(q.items[i])) }), () => {
                        const slots = [...play.slots];
                        const empty = slots.indexOf(null);
                        if (empty < 0) return;
                        slots[empty] = i;
                        chime("pop");
                        update({ slots });
                      })}
                    </div>
                  </div>
                ),
          )}
        </div>
        <button
          type="button"
          disabled={locked}
          onClick={() => (filled ? submit(play.slots.map((i) => q.items[i!].key).join(",")) : refuse(tx("refuse.fillFirst")))}
          className="mx-auto min-h-11 rounded-2xl bg-violet-600 px-6 py-2 font-bold text-white shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50"
        >
          {tx("label.check")}
        </button>
      </div>
    );
  }

  if (q.mode === "indirect") {
    const [a, b] = q.items;
    const aName = plainName(a.thing);
    const bName = plainName(b.thing);
    const stringAt = play.string === "cut" ? 0 : play.string === "carried" ? 1 : -1;
    board = (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3" data-testid="compare-bench">
          {[a, b].map((item, i) => (
            <div key={item.key} className="relative flex h-64 items-end justify-center gap-3 rounded-2xl bg-surface px-3 pb-3 shadow-inner">
              <div className="pointer-events-none absolute inset-x-2 bottom-3 border-b-4 border-ink/50" aria-hidden="true" />
              <div className="flex w-20 justify-center" style={{ height: `${(item.size / BENCH) * 100}%` }}>
                <ThingArt thing={item.thing} colour={item.colour} vertical />
              </div>
              <motion.div
                className="w-2 rounded-full bg-rose-500"
                initial={false}
                animate={{ height: stringAt === i ? `${(a.size / BENCH) * 100}%` : "0%", opacity: stringAt === i ? 1 : 0 }}
                transition={motionOK ? SPRING.settle : { duration: 0 }}
                aria-label={stringAt === i ? tx("label.string") : undefined}
                data-testid={stringAt === i ? "string" : undefined}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            disabled={locked}
            onClick={() => { chime("pop"); update({ string: "cut", status: tx("status.stringCut", { a: aName, b: bName }) }); }}
            className="min-h-11 rounded-2xl border-2 border-rose-400 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {cap(tx("label.measureWith", { a: aName }))}
          </button>
          <button
            type="button"
            disabled={locked || play.string === "none"}
            onClick={() => { chime("pop"); update({ string: "carried", status: tx("status.stringCarried", { b: bName }) }); }}
            className="min-h-11 rounded-2xl border-2 border-rose-400 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800 disabled:opacity-40 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {cap(tx("label.carryTo", { b: bName }))}
          </button>
        </div>
        {answerButtons((item) => (play.string === "carried" ? submit(item.key) : refuse(tx("refuse.stringFirst"))))}
      </div>
    );
  }

  if (q.mode === "attribute") {
    const [x, y] = q.pair!;
    board = (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-center gap-8 rounded-2xl bg-surface p-4 shadow-inner" data-testid="compare-bench">
          {[x, y].map((thing) => {
            const Icon = EVERYDAY_ICON[thing];
            return (
              <div key={thing} className="flex flex-col items-center gap-1">
                <Icon className="h-14 w-14 text-violet-600 dark:text-violet-300" aria-hidden="true" />
                <span className="text-sm font-bold text-ink">{tx(`thing.${thing}`)}</span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {TOOLS.map((tool) => {
            const Icon = TOOL_ICON[tool];
            return (
              <button
                key={tool}
                type="button"
                disabled={locked}
                onClick={() => submit(tool)}
                className="flex min-h-11 flex-col items-center gap-1 rounded-2xl border-2 border-line bg-surface p-3 text-sm font-bold text-ink shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                <Icon className="h-8 w-8 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                {tx(`tool.${tool}`)}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const canStartOver =
    !locked &&
    ((q.mode === "align" && play.starts.some((s, i) => s !== q.items[i].start)) ||
      (q.mode === "order" && play.slots.some((s) => s !== null)) ||
      (q.mode === "indirect" && play.string !== "none"));

  return (
    <SkillRound
      koda={koda}
      lesson={lesson}
      fallbackTitle={tx("prompt.order")}
      round={round}
      totalQuestions={total}
      prompt={question.prompt ?? ""}
      onExit={() => koda.ui.exit()}
      hints={hints}
      iconName="ruler"
      iconTone="cyan"
      onReadAloud={practising || !speechEnabled ? undefined : () => {
        round.useSupport("audio_replay");
        void koda.speech.say(question.prompt ?? "", { rate: koda.config.get("speechRate", 1) });
      }}
      onStartOver={canStartOver ? () => setStored(fresh()) : undefined}
    >
      <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
        {board}
        <p className="min-h-6 text-center text-base font-semibold text-body" aria-live="polite">{play.status}</p>
        {!practising && demoKind && <HowToPlayButton onClick={demo.show} />}
      </div>
      {demoKind && (
        <HowToPlay
          open={demo.open}
          steps={demoKind === "order" ? orderDemoSteps() : compareDemoSteps()}
          scene={(step, phase) => <CompareDemoScene kind={demoKind} step={step} phase={phase} motionOK={motionOK} />}
          onClose={demo.close}
          speak={sayCaption}
        />
      )}
    </SkillRound>
  );
};

/** Which How to play a lesson gets: the comparing demo, the ordering demo, or none (choosing a tool and the string explain themselves on screen). */
export function demoKindFor(mode: CompareMode): "compare" | "order" | null {
  if (mode === "order") return "order";
  if (mode === "pick" || mode === "pick_vertical" || mode === "align") return "compare";
  return null;
}

/** Asks, for tests and the voice script. */
export const ASKS: Ask[] = ["longer", "shorter", "taller", "lower", "heavier", "lighter", "holdsMore"];
