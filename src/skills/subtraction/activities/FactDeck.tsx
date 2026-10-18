import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import type { ActivityProps, PrintedQuestion } from "../../types";
import {
  SkillRound, composeHints, isPractice, modeAt, playCopy,
  useSkillRound, guideSetup, useGuide, type PracticeSetup, type RoundQuestion,
  answerChoices,
} from "../../kit";
import { themeSystem } from "../../../lib/themeSystem";
import { COMPARISON, DIFFERENCE, REMOVED_PART, WHOLE } from "../internal/data/subtractionPalette";
import { SCENE, TOUCH_TARGET } from "../internal/data/subtractionLayout";
import { speechRate, tagLabelsFrom } from "../internal/data/subtractionChrome";
import { useNudge } from "../internal/ui/useNudge";
import { chime } from "../internal/data/subtractionSound";
import {
  differenceKey, drawDifference, randInt, shuffle, withoutRepeat,
  type Difference, type DifferenceSpec,
} from "../internal/data/subtractionNumbers";
import { ts } from "../internal/i18n";
import { useT } from "../../../lib/i18n";

export type FactMode = "family" | "missing_addend" | "doubles" | "known_fact";

export interface FactSetup extends PracticeSetup {
  mode?: FactMode;
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  differenceRange?: [number, number];
  nRange?: [number, number];
  questionsPerRound?: number;
}

export interface FactDeckParams extends FactSetup { question?: FactSetup }

export interface SubtractionFact extends Difference {}

export interface FactMember { text: string; answer: number }

export interface FactQuestion extends RoundQuestion {
  mode: FactMode;
  minuend: number;
  subtrahend: number;
  difference: number;
  helper?: SubtractionFact;
  helpers?: SubtractionFact[];
  relations?: string[];
  correctRelation?: string;
  members?: FactMember[];
}

const DEFAULT_SPEC: Record<Exclude<FactMode, "doubles">, DifferenceSpec> = {
  family: { minuendRange: [3, 18], subtrahendRange: [1, 9], differenceRange: [1, 9], excludeEqual: true, distinctParts: true },
  missing_addend: { minuendRange: [3, 20], subtrahendRange: [1, 19], differenceRange: [1, 19], excludeEqual: true },
  known_fact: { minuendRange: [5, 20], subtrahendRange: [2, 18], differenceRange: [1, 18], excludeEqual: true },
};

const declared = (setup: FactSetup): DifferenceSpec => {
  const out: DifferenceSpec = {};
  if (setup.minuendRange) out.minuendRange = setup.minuendRange;
  if (setup.subtrahendRange) out.subtrahendRange = setup.subtrahendRange;
  if (setup.differenceRange) out.differenceRange = setup.differenceRange;
  return out;
};

export const specFor = (mode: Exclude<FactMode, "doubles">, setup: FactSetup): DifferenceSpec => ({
  ...DEFAULT_SPEC[mode], ...declared(setup), excludeEqual: true,
});

const fact = (minuend: number, subtrahend: number): SubtractionFact => ({
  minuend, subtrahend, difference: minuend - subtrahend,
});
const sameFact = (a: SubtractionFact, b: SubtractionFact) => a.minuend === b.minuend && a.subtrahend === b.subtrahend;

/** A helper is the same whole with one more or one fewer removed. */
export const isOneStepHelper = (candidate: SubtractionFact, target: Difference): boolean =>
  candidate.minuend === target.minuend && Math.abs(candidate.subtrahend - target.subtrahend) === 1;

const oneStepHelpers = (target: Difference): SubtractionFact[] =>
  [target.subtrahend - 1, target.subtrahend + 1]
    .filter((subtrahend) => subtrahend >= 1 && subtrahend <= target.minuend)
    .map((subtrahend) => fact(target.minuend, subtrahend));

/**
 * Shifts applied to the target to make wrong choices. Every distractor is a
 * true subtraction fact that is neither a one-step helper nor the target
 * itself, so no button can print the answer the child is about to give.
 */
const DISTRACTOR_SHIFTS: Array<[number, number]> = [
  [0, 2], [0, -2], [-1, 0], [1, 0], [-2, 0], [2, 0], [3, 0], [4, 0],
];

export const distractorFacts = (target: Difference, count: number): SubtractionFact[] => {
  const out: SubtractionFact[] = [];
  for (const [byMinuend, bySubtrahend] of DISTRACTOR_SHIFTS) {
    if (out.length === count) break;
    const candidate = fact(target.minuend + byMinuend, target.subtrahend + bySubtrahend);
    if (candidate.subtrahend < 1 || candidate.difference < 0) continue;
    if (candidate.difference === target.difference) continue;
    if (isOneStepHelper(candidate, target)) continue;
    if (out.some((other) => sameFact(other, candidate))) continue;
    out.push(candidate);
  }
  return out;
};

export const buildQuestion = (setup: FactSetup, index: number, seen: Set<string>): FactQuestion => {
  const mode = modeAt<FactMode>(setup, index, "family");
  const base = { id: `q${index}-${Date.now().toString(36)}`, taskKind: `subtract_fact_${mode}`, mode };
  if (mode === "doubles") {
    const [lo, hi] = setup.nRange ?? [2, 10];
    const drawn = withoutRepeat<Difference>(() => {
      const n = randInt(lo, hi);
      return { minuend: n * 2, subtrahend: n, difference: n };
    }, differenceKey, seen);
    return { ...base, ...drawn, helper: drawn, expected: String(drawn.difference), itemCount: drawn.minuend };
  }

  const drawn = withoutRepeat<Difference>(() => drawDifference(specFor(mode, setup)), differenceKey, seen);
  if (mode === "family") {
    return {
      ...base, ...drawn,
      members: [
        { text: `${drawn.subtrahend} + ${drawn.difference} =`, answer: drawn.minuend },
        { text: `${drawn.difference} + ${drawn.subtrahend} =`, answer: drawn.minuend },
        { text: `${drawn.minuend} − ${drawn.subtrahend} =`, answer: drawn.difference },
        { text: `${drawn.minuend} − ${drawn.difference} =`, answer: drawn.subtrahend },
      ],
      expected: [drawn.minuend, drawn.minuend, drawn.difference, drawn.subtrahend].join(","),
      itemCount: drawn.minuend,
    };
  }

  if (mode === "missing_addend") {
    const correctRelation = `${drawn.subtrahend} + ? = ${drawn.minuend}`;
    return {
      ...base, ...drawn, correctRelation,
      relations: shuffle([
        correctRelation,
        `${drawn.minuend} + ? = ${drawn.subtrahend}`,
        `${drawn.subtrahend} + ${drawn.minuend} = ?`,
      ]),
      expected: String(drawn.difference), itemCount: drawn.minuend,
    };
  }

  const neighbours = oneStepHelpers(drawn);
  const helper = neighbours[randInt(0, neighbours.length - 1)];
  const helpers = shuffle([helper, ...distractorFacts(drawn, 3)]);
  return { ...base, ...drawn, helper, helpers, expected: String(drawn.difference), itemCount: drawn.minuend };
};

export const promptFor = (q: FactQuestion, template?: string): string => {
  const filled = template?.replaceAll("{a}", String(q.minuend)).replaceAll("{b}", String(q.subtrahend)).replaceAll("{difference}", String(q.difference));
  if (filled) return filled;
  if (q.mode === "family") return ts("fact.promptFamily", { b: q.subtrahend, difference: q.difference, a: q.minuend });
  if (q.mode === "missing_addend") return ts("fact.promptAddend", { a: q.minuend, b: q.subtrahend });
  if (q.mode === "doubles") return ts("fact.promptDouble", { a: q.minuend, b: q.subtrahend });
  return ts("fact.prompt", { a: q.minuend, b: q.subtrahend });
};

export const printedFor = (q: FactQuestion): PrintedQuestion => {
  if (q.mode === "family") return { text: ts("fact.printedFamily", { b: q.subtrahend, difference: q.difference, a: q.minuend }), answer: q.members!.map((m) => `${m.text}${m.answer}`).join("; ") };
  if (q.mode === "missing_addend") return { text: ts("fact.printedAddend", { a: q.minuend, b: q.subtrahend }), answer: String(q.difference) };
  if (q.mode === "doubles") return { text: ts("fact.printedDouble", { a: q.minuend, b: q.subtrahend }), answer: String(q.difference) };
  return { text: ts("fact.printed", { a: q.minuend, b: q.subtrahend, helper: factText(q.helper!) }), answer: String(q.difference) };
};

export const methodFor = (q: FactQuestion): string[] => {
  if (q.mode === "family") return [ts("fact.methodFamily1"), ts("fact.methodFamily2"), ts("fact.methodFamily3")];
  if (q.mode === "missing_addend") return [ts("fact.methodAddend1"), ts("fact.methodAddend2"), ts("fact.methodAddend3")];
  if (q.mode === "doubles") return [ts("fact.methodDouble1"), ts("fact.methodDouble2")];
  return [ts("fact.method1"), ts("fact.method2")];
};

export function factHints(q: FactQuestion, state: { helperChosen: boolean; filled: number; kidTip?: string }): string[] {
  if (q.mode === "family") return composeHints(
    state.kidTip ?? ts("fact.hintFamilyTip"),
    ts("fact.hintFilled", { filled: state.filled, a: q.minuend }),
    ts("fact.hintParts", { b: q.subtrahend, difference: q.difference, a: q.minuend }),
  );
  if (q.mode === "missing_addend") return composeHints(
    state.kidTip ?? ts("fact.hintAddendTip"),
    state.helperChosen
      ? ts("fact.hintUse", { b: q.subtrahend, a: q.minuend })
      : ts("fact.hintPick", { b: q.subtrahend, a: q.minuend }),
    ts("fact.hintSame", { a: q.minuend, b: q.subtrahend }),
  );
  if (q.mode === "doubles") return composeHints(
    state.kidTip ?? ts("fact.hintDoubleTip"),
    ts("fact.hintDouble", { b: q.subtrahend, a: q.minuend }),
    ts("fact.hintEqual", { b: q.subtrahend }),
  );
  return composeHints(
    state.kidTip ?? ts("fact.hintTip"),
    state.helperChosen
      ? ts("fact.hintCompare", { ha: q.helper!.minuend, hb: q.helper!.subtrahend, hd: q.helper!.difference, b: q.subtrahend })
      : ts("fact.hintChoose", { b: q.subtrahend }),
    ts("fact.hintAdjust"),
  );
}

/** Four near misses, ordered by the question so they cannot be learned by position. */
export const choicesFor = (answer: number, seed: string): number[] => answerChoices(answer, seed);

const NumberPad: React.FC<{ onDigit: (digit: string) => void; onDelete: () => void; disabled: boolean }> = ({ onDigit, onDelete, disabled }) => (
  <div className="grid grid-cols-6 gap-1.5 max-w-md mx-auto">
    {Array.from({ length: 10 }, (_, n) => <button key={n} type="button" onClick={() => onDigit(String(n))} disabled={disabled} aria-label={ts("pad.digit", { digit: n })} className={`${TOUCH_TARGET} ${themeSystem.button("secondary", "sm")}`}>{n}</button>)}
    <button type="button" onClick={onDelete} disabled={disabled} aria-label={ts("pad.deleteDigit")} className={`col-span-2 ${TOUCH_TARGET} ${themeSystem.button("ghost", "sm")}`}>{ts("pad.delete")}</button>
  </div>
);

const factText = (value: SubtractionFact) => `${value.minuend} − ${value.subtrahend} = ${value.difference}`;

export const FactDeck: React.FC<ActivityProps<FactDeckParams>> = ({ params, koda, onComplete, lesson }) => {
  // Re-render when the language changes: every line below reads the catalog.
  useT();
  const setup: FactSetup = { ...params, ...params.question };
  const totalQuestions = setup.questionsPerRound ?? 5;
  const practising = isPractice(setup);
  const copy = playCopy(params);
  const seen = useRef(new Set<string>());
  const [helperChosen, setHelperChosen] = useState(false);
  const [entry, setEntry] = useState("");
  const [members, setMembers] = useState<Record<number, string>>({});
  const [nextStep, setNextStep] = useState<{ kind: string; kidMessage: string }>();
  const nudge = useNudge(koda);
  const round = useSkillRound({
    koda, resumable: practising, totalQuestions, levelNumber: lesson?.levelNumber ?? 17,
    intro: practising ? undefined : copy.audioPrompt,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nextQuestion: useCallback((index) => buildQuestion(setup, index, seen.current), [params]),
    onComplete: (result) => { void koda.progress.nextStep().then((value) => setNextStep(value)); onComplete(result); },
  });
  const q = round.question as FactQuestion;
  useEffect(() => { setHelperChosen(false); setEntry(""); setMembers({}); nudge.clear(); }, [q.id, nudge.clear]);

  /*
   * Put the work back the way this question started.
   *
   * The same lines the effect above runs when a new question arrives, called
   * from a button instead. A wrong answer keeps the child on the same question,
   * and without this the board they got wrong is still in front of them with no
   * way back except undoing every move by hand.
   */
  const restart = (): void => {
    setHelperChosen(false);
    setEntry("");
    setMembers({});
    nudge.clear();
  };

  const scaffold = koda.config.isEnabled("strategy_scaffold", true);
  const answerInput = koda.config.get<string>("answerInput", "choices");
  const prompt = promptFor(q, copy.prompts?.default);

  const chooseRoute = (correct: boolean, message: string) => {
    if (!correct) { nudge.refuse(message); return; }
    setHelperChosen(true);
    round.useSupport("walkthrough");
    chime(koda, "changed");
    koda.haptics.tap();
  };
  const submitNumber = (value: number) => {
    const correct = value === q.difference;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({ correct, given: String(value), expected: q.expected, errorKind: correct ? undefined : Math.abs(value - q.difference) === 1 ? "off_by_one" : "off_by_more",
      title: correct ? ts("fact.rightTitle") : ts("fact.wrongTitle"),
      message: practising ? undefined : ts("aMinusBIs", { a: q.minuend, b: q.subtrahend, difference: q.difference }) });
  };
  const checkMembers = () => {
    const values = q.members!.map((_, i) => members[i] ?? "");
    if (values.some((value) => value === "")) { nudge.refuse(ts("fact.refuseEmpty", { count: values.filter((value) => value === "").length })); return; }
    const correct = values.join(",") === q.expected;
    chime(koda, correct ? "right" : "wrong");
    if (correct) koda.haptics.success(); else koda.haptics.tap();
    round.submit({ correct, given: values.join(","), expected: q.expected, errorKind: correct ? undefined : "off_by_more",
      title: correct ? ts("fact.familyTitle") : ts("fact.checkFour"), message: practising ? undefined : ts("fact.familyMessage", { b: q.subtrahend, difference: q.difference, a: q.minuend }) });
  };
  const readyForAnswer = q.mode === "family" || q.mode === "doubles" || helperChosen;

  /*
   * The coach: the same ladder, offered rather than waited for.
   *
   * `hints` is built once and handed to both — the Hint button shows it and
   * the coach raises it — so a child meets one set of words however the help
   * arrived. The switch decides whether it steps in by itself, never what the
   * help looks like.
   */
  const hints = practising ? [] : factHints(q, { helperChosen, filled: Object.values(members).filter(Boolean).length, kidTip: copy.kidTip });
  const guideCfg = guideSetup(params);
  const guided =
    !practising && (guideCfg.enabled ?? false) && koda.config.isEnabled("guide_coach", true);
  const guide = useGuide({
    koda,
    enabled: guided,
    setup: guideCfg,
    questionId: q.id,
    rungs: hints,
    target: -1,
    progress: (helperChosen ? 1 : 0) + Object.values(members).filter(Boolean).length,
    done: false,
    paused: Boolean(round.feedback) || Boolean(round.score),
    useSupport: round.useSupport,
  });

  return <SkillRound koda={koda} lesson={lesson} fallbackTitle={ts("fact.title")} round={round}
    totalQuestions={totalQuestions} prompt={prompt} iconName={q.mode === "family" ? "gem" : "zap"} iconTone="pink"
    tagLabels={tagLabelsFrom(koda)} nudge={nudge.message}
    hints={hints}
    guide={practising ? undefined : guide}
    guideMethod={copy.stepByStep}
    onStartOver={
      !round.feedback && (helperChosen || entry !== "" || Object.values(members).some((v) => v !== "")) ? restart : undefined
    }
    onExit={koda.ui.exit} recommendation={nextStep}
    onReadAloud={practising ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(prompt, speechRate(koda)); }}>
    <div className="space-y-4">
      <div className={`${SCENE} p-4 sm:p-7 min-h-[230px] flex flex-col items-center justify-center gap-4`}>
        <div className="text-4xl sm:text-5xl font-black tabular-nums text-ink"><span className={WHOLE.text}>{q.minuend}</span><span className="text-ink/30"> − </span><span className={REMOVED_PART.text}>{q.subtrahend}</span><span className="text-ink/30"> = ?</span></div>

        {q.mode === "family" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
          {q.members!.map((member, i) => <label key={`${i}-${member.text}`} className="flex items-center justify-end gap-2 text-lg sm:text-xl font-black tabular-nums text-ink">
            {/* The equation is one token: at 360px an unpinned "13 − 4 =" drops
                its equals sign onto a second line, under the number it belongs to. */}
            <span className="whitespace-nowrap">{member.text}</span>
            {/* The width lives on the wrapper because `field()` sizes itself
                `w-full`, which beats a `w-16` passed after it. */}
            <span className="w-16 shrink-0"><input inputMode="numeric" pattern="[0-9]*" value={members[i] ?? ""} disabled={Boolean(round.feedback)}
              onChange={(event) => setMembers((current) => ({ ...current, [i]: event.target.value.replace(/[^0-9]/g, "").slice(0, 2) }))}
              aria-label={ts("fact.answerFor", { n: i + 1 })} className={themeSystem.field("md", "w-full text-center text-xl font-black tabular-nums")} /></span>
          </label>)}
        </div>}

        {q.mode === "missing_addend" && !helperChosen && <div className="flex flex-wrap justify-center gap-2.5">{q.relations!.map((relation) => <button key={relation} type="button"
          onClick={() => chooseRoute(relation === q.correctRelation, ts("fact.refuseRoles"))}
          className={themeSystem.button("secondary", "md")}>{relation}</button>)}</div>}

        {q.mode === "missing_addend" && helperChosen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-2xl font-black ${COMPARISON.text}`}>{q.correctRelation}</motion.div>}

        {q.mode === "doubles" && <div className={`${DIFFERENCE.soft} ${DIFFERENCE.border} border-2 rounded-2xl px-5 py-3 text-xl sm:text-2xl font-black tabular-nums ${DIFFERENCE.text}`}>{q.subtrahend} + {q.subtrahend} = {q.minuend}</div>}

        {q.mode === "known_fact" && !helperChosen && <div className="flex flex-wrap justify-center gap-2.5">{q.helpers!.map((helper) => <button key={`${helper.minuend}-${helper.subtrahend}`} type="button"
          onClick={() => chooseRoute(isOneStepHelper(helper, q), ts("fact.refuseHelper", { fact: factText(helper) }))}
          aria-label={ts("fact.helperLabel", { fact: factText(helper) })} className={themeSystem.button("secondary", "md")}>{factText(helper)}</button>)}</div>}

        {q.mode === "known_fact" && helperChosen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-xl sm:text-2xl font-black tabular-nums ${DIFFERENCE.text}`}>{factText(q.helper!)}</motion.div>}

        {scaffold && !practising && q.mode !== "family" && <div className="text-center text-sm font-bold text-ink/60">{q.mode === "doubles" ? ts("fact.helpDouble") : helperChosen ? ts("fact.helpUse") : ts("fact.helpChoose")}</div>}
      </div>

      {q.mode === "family" && <div className="flex justify-center"><button type="button" onClick={checkMembers} className={themeSystem.button("primary", "lg")}>{ts("fact.checkAllFour")}</button></div>}

      {q.mode !== "family" && readyForAnswer && (answerInput === "pad" ? <div className="space-y-3">
        <div className="mx-auto w-20 h-14 rounded-2xl border-2 border-dashed border-violet-400 flex items-center justify-center text-3xl font-black">{entry || "?"}</div>
        <NumberPad disabled={Boolean(round.feedback)} onDigit={(digit) => setEntry((value) => `${value}${digit}`.slice(0, 2))} onDelete={() => setEntry((value) => value.slice(0, -1))} />
        <div className="flex justify-center"><button type="button" onClick={() => entry ? submitNumber(Number(entry)) : nudge.refuse(ts("typeFirst"))} className={themeSystem.button("primary", "lg")}>{ts("check")}</button></div>
      </div> : <div className="flex flex-wrap justify-center gap-2.5">{choicesFor(q.difference, q.id).map((value) => <button key={value} type="button" onClick={() => submitNumber(value)} disabled={Boolean(round.feedback)} className={themeSystem.button("secondary", "choice")}>{value}</button>)}</div>)}
    </div>
  </SkillRound>;
};
