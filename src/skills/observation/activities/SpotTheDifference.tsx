import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { SvgAsset } from "../../../assets/svg";
import type { ActivityProps } from "../../types";
import { SkillRound, SPRING, composeHints, isPractice, playCopy, useMotionOK, useSkillRound, type RoundQuestion } from "../../kit";
import { OBJECT_BY_ID } from "../internal/data";
import { SCENE_BY_ID } from "../internal/scenes";
import { buildDifferencePair, type DifferenceKind, type SceneDifference } from "../internal/differences";
import { seedHash, seededShuffle } from "../internal/placement";
import { keyOf, type ObjectHuntSetup, type ObservationRegion, type ObservationScene, type SceneObject } from "../internal/types";

export interface SpotTheDifferenceParams extends ObjectHuntSetup {
  question?: ObjectHuntSetup & { differenceCount?: number; kinds?: DifferenceKind[] };
  differenceCount?: number;
  kinds?: DifferenceKind[];
}

export interface DifferenceQuestion extends RoundQuestion {
  scene: ObservationScene;
  left: SceneObject[];
  right: SceneObject[];
  differences: SceneDifference[];
  targets: string[];
  targetScale: number;
  camouflageStrength: number;
}

/**
 * Each pane shows only the band of the scene its slots occupy.
 *
 * Measured across every scene, no padded slot sits outside 11%–89% of the art's
 * height, so cropping to that band loses nothing findable and buys the vertical
 * room two stacked pictures need on a phone. The crop is done by oversizing an
 * inner layer rather than by remapping coordinates, so every object keeps the
 * position the rest of the skill authored for it.
 */
const BAND_TOP = 11;
const BAND_HEIGHT = 78;
const INNER_HEIGHT = `${(100 / (BAND_HEIGHT / 100)).toFixed(3)}%`;
const INNER_TOP = `${(-(BAND_TOP / BAND_HEIGHT) * 100).toFixed(3)}%`;

const PREMIUM_ART_CLASS = "[&_path]:[stroke-width:2px] [&_rect]:[stroke-width:2px] [&_circle]:[stroke-width:2px] [&_ellipse]:[stroke-width:2px]";

export function buildQuestion(setup: SpotTheDifferenceParams, index: number): DifferenceQuestion {
  const merged = { ...setup, ...setup.question };
  const baseSeed = merged.seed ?? "observation-difference";
  const scenes = merged.sceneIds?.length ? merged.sceneIds : [merged.sceneId ?? "beach-sandcastle-shore"];
  const order = seededShuffle(scenes, `${baseSeed}:scenes`);
  const scene = SCENE_BY_ID.get(order[(index - 1) % order.length]) ?? [...SCENE_BY_ID.values()][0];
  const seed = `${baseSeed}:${scene.id}:${index}`;

  const objectCount = Math.max(4, Math.min(scene.objects.length, (merged.objectCount as number | undefined) ?? 8));
  const shown = seededShuffle(scene.objects, `${seed}:cast`).slice(0, objectCount);
  const wanted = merged.differenceCount ?? 3;
  const kinds = merged.kinds ?? ["missing", "moved"];
  const { left, right, differences } = buildDifferencePair(scene, shown, wanted, kinds, seed);
  const targets = differences.map((difference) => difference.key);

  return {
    id: `spot-difference-${seedHash(seed).toString(36)}`,
    taskKind: `spot_difference_${scene.id}`,
    prompt: targets.length === 1 ? "Find the one difference." : `Find ${targets.length} differences.`,
    expected: [...targets].sort().join(","),
    itemCount: left.length,
    scene,
    left,
    right,
    differences,
    targets,
    targetScale: merged.targetScale ?? 0.78,
    camouflageStrength: merged.camouflageStrength ?? 0.2,
  };
}

export function differenceHints(question: DifferenceQuestion, found: ReadonlySet<string>): string[] {
  const next = question.targets.find((key) => !found.has(key));
  const placement = question.left.find((object) => keyOf(object) === next);
  const region = placement?.region.replace("-", " ");
  return composeHints(
    "Compare one small part of both pictures at a time.",
    region ? `Look near the ${region} part of the scene.` : undefined,
    region ? `Focus on the ${region} area. Check around objects that could partly hide it.` : undefined,
  );
}

export const promptFor = (question: DifferenceQuestion): string => question.prompt ?? "Find the differences.";
export const printedFor = (): null => null;

/** One picture of the pair. Both panes share a tappable grid, so nothing leaks. */
const Pane: React.FC<{
  label: string;
  scene: ObservationScene;
  objects: SceneObject[];
  grid: SceneObject[];
  question: DifferenceQuestion;
  found: ReadonlySet<string>;
  regionHint: ObservationRegion | null;
  motionOK: boolean;
  onChoose(key: string): void;
}> = ({ label, scene, objects, grid, question, found, regionHint, motionOK, onChoose }) => {
  const byKey = new Map(objects.map((object) => [keyOf(object), object]));
  return (
    <div aria-label={label} className="relative aspect-[1000/585] w-full overflow-hidden rounded-2xl border-4 border-white bg-sky-100 shadow-[0_10px_28px_rgba(30,70,100,0.18)] ring-1 ring-sky-200/60">
      <div className="absolute inset-x-0" style={{ height: INNER_HEIGHT, top: INNER_TOP }}>
        <SvgAsset id={scene.backdrop} size="100%" cover className="h-full w-full" />
        {grid.map((slot, index) => {
          const key = keyOf(slot);
          // Every object key gets a button in both panes, positioned where that
          // pane puts it and falling back to the other pane's spot when the
          // object is missing here. A grid that only covered the differences
          // would give the answer away.
          const object = byKey.get(key) ?? slot;
          const isFound = found.has(key);
          const isDifference = question.targets.includes(key);
          const drawn = byKey.has(key);
          return (
            <button key={key} type="button" aria-label={`${label} item ${index + 1}`}
              data-difference-key={key} data-pane={label}
              data-match-state={isFound ? "found" : "searching"}
              onClick={() => onChoose(key)}
              className="absolute grid cursor-pointer place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              style={{ left: `${object.x - object.hitPadding}%`, top: `${object.y - object.hitPadding}%`, width: `${object.width + object.hitPadding * 2}%`, height: `${object.height + object.hitPadding * 2}%`, zIndex: object.z }}>
              {drawn && (
                <span className="pointer-events-none grid h-full w-full place-items-center"
                  style={{
                    transform: `scale(${question.targetScale * (object.visualScale ?? 1)})${object.mirrored ? " scaleX(-1)" : ""}`,
                    opacity: .92,
                    filter: `saturate(${1 - question.camouflageStrength * .5}) brightness(${1 - question.camouflageStrength * .1})`,
                    transformOrigin: "center",
                    rotate: `${object.rotation ?? 0}deg`,
                  }}><SvgAsset id={object.asset} size="100%" className={PREMIUM_ART_CLASS} /></span>
              )}
              {isFound && isDifference && (
                <motion.span aria-hidden initial={motionOK ? { scale: .6, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={SPRING.enter}
                  className="pointer-events-none absolute inset-0 rounded-full border-[3px] border-emerald-500 bg-emerald-300/25" />
              )}
            </button>
          );
        })}
      </div>
      {regionHint && (
        <div aria-label={`Highlighted ${regionHint} search region`} className={`pointer-events-none absolute h-1/2 w-1/2 border-4 border-indigo-400 bg-indigo-300/20 motion-safe:animate-pulse ${regionHint.includes("bottom") ? "bottom-0" : "top-0"} ${regionHint.includes("right") ? "right-0" : "left-0"}`} />
      )}
      <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-bold text-slate-700">{label}</span>
    </div>
  );
};

export const SpotTheDifference: React.FC<ActivityProps<SpotTheDifferenceParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = useMemo<SpotTheDifferenceParams>(() => ({ ...params, ...params.question }), [params]);
  const [roundSeed] = useState(() => setup.seed ?? `spot-${Date.now().toString(36)}`);
  const roundSetup = useMemo(() => ({ ...setup, seed: roundSeed }), [setup, roundSeed]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const regionHintsEnabled = koda.config.isEnabled("search_region_hints", true);
  const speechRate = koda.config.get("speechRate", 0.95);
  const motionOK = useMotionOK();

  const [found, setFound] = useState<Set<string>>(new Set());
  const [nudge, setNudge] = useState<string | null>(null);
  const [regionHint, setRegionHint] = useState<ObservationRegion | null>(null);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    answerSoundDelayMs: (correct) => correct ? 560 : 240,
    nextQuestion: useCallback((index: number) => buildQuestion(roundSetup, index), [roundSetup]),
    onComplete,
  });
  const question = round.question as DifferenceQuestion;

  useEffect(() => { setFound(new Set()); setNudge(null); setRegionHint(null); }, [question.id]);
  useEffect(() => () => koda.speech.stop(), [koda]);
  useEffect(() => { if (!round.feedback) setNudge(null); }, [round.feedback]);

  const chime = (type: "pop" | "success" | "error") => {
    if (koda.config.isEnabled("sound_chimes", true) && koda.sound.isEnabled()) koda.sound.play(type);
  };
  const pulse = (type: "tap" | "success" | "error") => {
    if (!koda.config.isEnabled("haptic_feedback", true)) return;
    if (type === "tap") koda.haptics.tap();
    else if (type === "success") koda.haptics.success();
    else koda.haptics.pulse("error");
  };

  // Tapping either picture at a difference finds it, and it is marked in both.
  const choose = (key: string) => {
    if (round.feedback) return;
    if (!question.targets.includes(key)) {
      koda.speech.stop(); chime("error"); pulse("error");
      setNudge("These two look the same. Keep comparing!");
      round.submit({ correct: false, given: key, expected: question.expected, errorKind: "miscounted_items", title: "Not a difference", message: "These two look the same. Keep comparing!" });
      return;
    }
    if (found.has(key)) {
      setNudge("You already found that difference.");
      if (speechEnabled) { koda.speech.stop(); void koda.speech.say("You already found that one.", { rate: speechRate }).catch(() => {}); }
      return;
    }
    const next = new Set(found); next.add(key); setFound(next); setNudge(null);
    const complete = question.targets.every((id) => next.has(id));
    koda.speech.stop();
    chime(complete ? "success" : "pop");
    pulse(complete ? "success" : "tap");
    if (!complete) return;
    round.submit({ correct: true, given: [...next].sort().join(","), expected: question.expected, title: "Congratulations!", message: "You found every difference!" });
  };

  const hints = practising || !regionHintsEnabled ? [] : differenceHints(question, found);
  useEffect(() => {
    if (round.hint.level < 3) { setRegionHint(null); return; }
    const next = question.targets.find((key) => !found.has(key));
    setRegionHint(question.left.find((object) => keyOf(object) === next)?.region ?? null);
  }, [round.hint.level, question, found]);

  // The grid is the union of both casts, so a missing object is still tappable.
  const grid = useMemo(() => {
    const all = new Map<string, SceneObject>();
    question.left.forEach((object) => all.set(keyOf(object), object));
    question.right.forEach((object) => { if (!all.has(keyOf(object))) all.set(keyOf(object), object); });
    return [...all.values()];
  }, [question]);

  return (
    <SkillRound koda={koda} lesson={lesson} fallbackTitle="Spot the Difference" round={round} totalQuestions={total}
      prompt={promptFor(question)} onExit={() => koda.ui.exit()} hints={hints} nudge={nudge}
      iconName="Search" iconTone="cyan"
      onReadAloud={practising || !speechEnabled ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(promptFor(question), { rate: speechRate }); }}>
      <section aria-label={`${question.scene.name} spot the difference`} className="mx-auto w-full max-w-[760px] space-y-2">
        <p className="sr-only" aria-live="polite">{found.size} of {question.targets.length} differences found.</p>
        <div className="grid gap-2 md:grid-cols-2">
          <Pane label="Top picture" scene={question.scene} objects={question.left} grid={grid} question={question}
            found={found} regionHint={regionHint} motionOK={motionOK} onChoose={choose} />
          <Pane label="Bottom picture" scene={question.scene} objects={question.right} grid={grid} question={question}
            found={found} regionHint={regionHint} motionOK={motionOK} onChoose={choose} />
        </div>
        <div className="flex items-center justify-center py-1" aria-label="Differences to find">
          <div data-difference-progress={`${found.size}/${question.targets.length}`}
            className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-2 dark:bg-slate-800">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Differences</span>
            <span className="text-lg font-bold tabular-nums text-cyan-600 dark:text-cyan-400">{found.size} / {question.targets.length}</span>
          </div>
        </div>
      </section>
    </SkillRound>
  );
};
