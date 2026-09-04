import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { motion } from "motion/react";
import { SvgAsset } from "../../../assets/svg";
import type { ActivityProps } from "../../types";
import { SkillRound, SPRING, composeHints, isPractice, playCopy, stagger, useMotionOK, useSkillRound, type RoundQuestion } from "../../kit";
import { OBJECT_BY_ID } from "../internal/data";
import { SCENE_BY_ID } from "../internal/scenes";
import type { ObjectHuntSetup, ObservationMode, ObservationRegion, ObservationScene, SceneObject } from "../internal/types";
import { MatchFlight, type MatchFlightState } from "../internal/ui/MatchFlight";

export interface ObjectHuntParams extends ObjectHuntSetup {
  question?: ObjectHuntSetup;
}

export interface ObjectHuntQuestion extends RoundQuestion {
  mode: ObservationMode;
  scene: ObservationScene;
  objects: SceneObject[];
  targets: string[];
  targetScale: number;
  camouflageStrength: number;
}

const FUTURE_MODES: ObservationMode[] = ["exact", "silhouette", "near_decoys", "rotation", "scale", "occluded", "clutter"];
const PREMIUM_ART_CLASS = "[&_path]:[stroke-width:2px] [&_rect]:[stroke-width:2px] [&_circle]:[stroke-width:2px] [&_ellipse]:[stroke-width:2px]";

export function visibilityProfile(level = 1, overrides: Pick<ObjectHuntSetup, "targetScale" | "camouflageStrength"> = {}) {
  const step = Math.max(1, Math.min(3, level));
  return {
    targetScale: overrides.targetScale ?? [0.82, 0.74, 0.66][step - 1],
    camouflageStrength: overrides.camouflageStrength ?? [0.08, 0.16, 0.24][step - 1],
  };
}

function hash(value: string): number {
  let out = 2166136261;
  for (let i = 0; i < value.length; i += 1) out = Math.imul(out ^ value.charCodeAt(i), 16777619);
  return out >>> 0;
}

function shuffled<T>(items: readonly T[], seed: string): T[] {
  return [...items].sort((a, b) => hash(`${seed}:${JSON.stringify(a)}`) - hash(`${seed}:${JSON.stringify(b)}`));
}

/**
 * Moves objects between authored, collision-safe slots in the same scene
 * region. Keeping slot geometry intact avoids overlap and out-of-bounds art;
 * the seed makes the result reproducible for tests and saved rounds.
 */
export function randomizeObjectLocations(scene: ObservationScene, objects: readonly SceneObject[], seed: string): SceneObject[] {
  const slotsByRegion = new Map<ObservationRegion, SceneObject[]>();
  scene.objects.forEach((slot) => slotsByRegion.set(slot.region, [...(slotsByRegion.get(slot.region) ?? []), slot]));

  return objects.map((object) => {
    const slots = slotsByRegion.get(object.region) ?? [object];
    if (slots.length < 2) return { ...object };
    const sourceIndex = slots.findIndex((slot) => slot.id === object.id);
    const direction = hash(`${seed}:${object.region}:direction`) % 2 === 0 ? 1 : -1;
    const distance = 1 + (hash(`${seed}:${object.region}:distance`) % (slots.length - 1));
    const slotIndex = (sourceIndex + direction * distance + slots.length * 2) % slots.length;
    const slot = slots[slotIndex];
    return {
      ...object,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      rotation: slot.rotation,
      z: slot.z,
      hitPadding: slot.hitPadding,
      region: slot.region,
    };
  });
}

function amount(value: number | [number, number] | undefined, fallback: number, seed: string): number {
  if (typeof value === "number") return value;
  const [lo, hi] = value ?? [fallback, fallback];
  return lo + (hash(seed) % (hi - lo + 1));
}

function selectedMode(setup: ObjectHuntSetup, index: number): ObservationMode {
  const choices = setup.modes?.length ? setup.modes : [setup.mode ?? "exact"];
  const mode = choices[(index - 1) % choices.length];
  return mode === "mixed" ? FUTURE_MODES[(index - 1) % FUTURE_MODES.length] : mode;
}

let roundSequence = 0;
export function createRoundSeed(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  roundSequence += 1;
  return `observation-${Date.now().toString(36)}-${roundSequence.toString(36)}`;
}

export function buildQuestion(setup: ObjectHuntSetup, index: number): ObjectHuntQuestion {
  const scene = SCENE_BY_ID.get(setup.sceneId ?? "beach-sandcastle-shore") ?? [...SCENE_BY_ID.values()][0];
  const roundSeed = `${setup.seed ?? "observation"}:${scene.id}`;
  const seed = `${roundSeed}:${index}`;
  const objectCount = Math.max(1, Math.min(scene.objects.length, amount(setup.objectCount, 8, `${seed}:objects`)));
  const targetCount = Math.max(1, Math.min(objectCount, amount(setup.targetCount, 1, `${seed}:targets`)));
  const targetOrder = shuffled(scene.objects, `${roundSeed}:answers`);
  // Deal from one shuffled round deck so every scene object is considered
  // before any target repeats, including multi-target questions.
  const targetStart = (index - 1) * targetCount;
  const targetObjects = Array.from({ length: targetCount }, (_, offset) => targetOrder[(targetStart + offset) % targetOrder.length]);
  const targetIds = new Set(targetObjects.map((object) => object.id));
  const distractors = shuffled(scene.objects.filter((object) => !targetIds.has(object.id)), `${seed}:pool`).slice(0, objectCount - targetCount);
  const objects = randomizeObjectLocations(scene, shuffled([...targetObjects, ...distractors], `${seed}:display`), `${seed}:locations`);
  const targets = targetObjects.map((object) => object.id);
  const names = targets.map((id) => OBJECT_BY_ID.get(id)?.name ?? id);
  const visibility = visibilityProfile(setup.level, setup);
  return {
    id: `object-hunt-${hash(seed).toString(36)}`,
    taskKind: `find_${selectedMode(setup, index)}_${scene.id}`,
    prompt: targetCount === 1 ? `Find the ${names[0]}.` : `Find ${targetCount} hidden objects.`,
    expected: targets.join(","),
    itemCount: objects.length,
    mode: selectedMode(setup, index),
    scene,
    objects,
    targets,
    ...visibility,
  };
}

export function objectHuntHints(question: ObjectHuntQuestion, found: ReadonlySet<string>): string[] {
  const next = question.targets.find((id) => !found.has(id));
  const placement = question.objects.find((object) => object.id === next);
  const name = next ? OBJECT_BY_ID.get(next)?.name : undefined;
  const region = placement?.region.replace("-", " ");
  return composeHints(
    "Scan one small part at a time. Move your eyes from left to right.",
    region && name ? `Look for the ${name} near the ${region} part of the scene.` : undefined,
    region ? `Focus on the ${region} area. Check around objects that could partly hide it.` : undefined,
  );
}

export const promptFor = (question: ObjectHuntQuestion): string => question.prompt ?? "Find the hidden objects.";
export const printedFor = (): null => null;

const TargetPreview: React.FC<{ object: SceneObject; mode: ObservationMode; found: boolean }> = ({ object, mode, found }) => {
  const transform = mode === "rotation" ? "rotate(28deg)" : mode === "scale" ? "scale(.72)" : undefined;
  return (
    <span data-preview-opacity={found ? "found" : "searching"} className={`relative grid h-14 w-14 place-items-center transition-opacity duration-200 ${found ? "opacity-100" : "opacity-[.85]"}`}>
      <span style={{ transform, filter: mode === "silhouette" ? "brightness(0)" : undefined }}>
        <SvgAsset id={object.asset} size={42} className={PREMIUM_ART_CLASS} />
      </span>
    </span>
  );
};

const MatchBurst: React.FC = () => (
  <span aria-hidden className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
    {Array.from({ length: 8 }, (_, index) => {
      const angle = (Math.PI * 2 * index) / 8;
      return <motion.span key={index} className="absolute h-2 w-2 rounded-full bg-amber-300 shadow-sm"
        initial={{ x: 0, y: 0, opacity: 1, scale: .4 }}
        animate={{ x: Math.cos(angle) * 34, y: Math.sin(angle) * 34, opacity: 0, scale: 1.15 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, mass: .55 }} />;
    })}
  </span>
);

export const ObjectHunt: React.FC<ActivityProps<ObjectHuntParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = useMemo<ObjectHuntSetup>(() => ({ ...params, ...params.question }), [params]);
  const [roundSeed] = useState(() => setup.seed ?? createRoundSeed());
  const roundSetup = useMemo<ObjectHuntSetup>(() => ({ ...setup, seed: roundSeed }), [setup, roundSeed]);
  const copy = playCopy(params);
  const practising = isPractice(setup);
  const total = setup.questionsPerRound ?? 5;
  const showPreviews = koda.config.isEnabled("target_preview", true);
  const regionHintsEnabled = koda.config.isEnabled("search_region_hints", true);
  const speechRate = koda.config.get("speechRate", 0.95);
  const motionOK = useMotionOK();
  const [found, setFound] = useState<Set<string>>(new Set());
  const [celebratingId, setCelebratingId] = useState<string | null>(null);
  const celebrationTimer = useRef<number | null>(null);
  const sceneObjectRefs = useRef(new Map<string, HTMLButtonElement>());
  const targetRefs = useRef(new Map<string, HTMLDivElement>());
  const [flight, setFlight] = useState<MatchFlightState | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const [regionHint, setRegionHint] = useState<ObservationRegion | null>(null);

  const round = useSkillRound({
    koda,
    totalQuestions: total,
    levelNumber: lesson?.levelNumber ?? 1,
    intro: practising ? undefined : copy.audioPrompt,
    resumable: practising,
    // The Web Audio chimes are 0.2s (wrong) and about 0.5s (final). Let each
    // finish before the recorded reaction takes the same speaker.
    answerSoundDelayMs: (correct) => correct ? 560 : 240,
    nextQuestion: useCallback((index: number) => buildQuestion(roundSetup, index), [roundSetup]),
    onComplete,
  });
  const question = round.question as ObjectHuntQuestion;

  useEffect(() => {
    setFound(new Set());
    setCelebratingId(null);
    setFlight(null);
    if (celebrationTimer.current !== null) window.clearTimeout(celebrationTimer.current);
    setNudge(null);
    setRegionHint(null);
  }, [question.id]);

  useEffect(() => () => {
    if (celebrationTimer.current !== null) window.clearTimeout(celebrationTimer.current);
    koda.speech.stop();
  }, [koda]);

  useEffect(() => {
    if (!round.feedback) setNudge(null);
  }, [round.feedback]);

  const chime = (type: "pop" | "success" | "error") => {
    if (koda.config.isEnabled("sound_chimes", true) && koda.sound.isEnabled()) koda.sound.play(type);
  };
  const pulse = (type: "tap" | "success" | "error") => {
    if (!koda.config.isEnabled("haptic_feedback", true)) return;
    if (type === "tap") koda.haptics.tap();
    else if (type === "success") koda.haptics.success();
    else koda.haptics.pulse("error");
  };

  const choose = (object: SceneObject) => {
    if (round.feedback) return;
    if (!question.targets.includes(object.id)) {
      // One voice at a time: stop unfinished speech, play the short error
      // chime, then let `round.submit` start its delayed recorded reaction.
      koda.speech.stop(); chime("error"); pulse("error"); setNudge("Not a match. Look carefully and try again!");
      round.submit({ correct: false, given: object.id, expected: question.expected, errorKind: "miscounted_items", title: "Not a match", message: "Look carefully and try again!" });
      return;
    }
    if (found.has(object.id)) { setNudge(`You already found the ${OBJECT_BY_ID.get(object.id)?.name}.`); return; }
    const next = new Set(found); next.add(object.id); setFound(next); setNudge(null);
    if (celebrationTimer.current !== null) window.clearTimeout(celebrationTimer.current);
    setCelebratingId(object.id);
    celebrationTimer.current = window.setTimeout(() => setCelebratingId(null), 1100);
    const source = sceneObjectRefs.current.get(object.id)?.getBoundingClientRect();
    const destination = targetRefs.current.get(object.id)?.getBoundingClientRect();
    if (source && destination && motionOK) {
      setFlight({
        key: Date.now(),
        asset: object.asset,
        from: {
          left: source.left + source.width * (1 - question.targetScale) / 2,
          top: source.top + source.height * (1 - question.targetScale) / 2,
          width: source.width * question.targetScale,
          height: source.height * question.targetScale,
        },
        to: { left: destination.left, top: destination.top, width: destination.width, height: destination.height },
      });
    }
    const complete = question.targets.every((id) => next.has(id));
    koda.speech.stop();
    // Partial finds use only a short pop. On the final find, the success chime
    // finishes before `round.submit` starts its delayed recorded reaction.
    chime(complete ? "success" : "pop");
    pulse(complete ? "success" : "tap");
    if (!complete) {
      return;
    }
    round.submit({ correct: true, given: [...next].join(","), expected: question.expected, title: "Congratulations!", message: "You found every hidden object!" });
  };

  const hints = practising || !regionHintsEnabled ? [] : objectHuntHints(question, found);
  useEffect(() => {
    if (round.hint.level < 3) { setRegionHint(null); return; }
    const next = question.targets.find((id) => !found.has(id));
    setRegionHint(question.objects.find((object) => object.id === next)?.region ?? null);
  }, [round.hint.level, question, found]);

  return (
    <SkillRound koda={koda} lesson={lesson} fallbackTitle="Hidden Object Hunt" round={round} totalQuestions={total}
      prompt={promptFor(question)} onExit={() => koda.ui.exit()} hints={hints} nudge={nudge}
      iconName="Search" iconTone="amber"
      onReadAloud={() => { round.useSupport("audio_replay"); void koda.speech.say(promptFor(question), { rate: speechRate }); }}>
      <section aria-label={`${question.scene.name} hidden object game`} className="space-y-3">
        <motion.div initial={motionOK ? { scale: .975, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={SPRING.settle}
          className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] border-[6px] border-white bg-sky-100 shadow-[0_22px_55px_rgba(30,70,100,0.22)] ring-1 ring-sky-200/60">
          <motion.div className="absolute inset-0" animate={motionOK ? { scale: [1, 1.008, 1] } : { scale: 1 }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}>
            <SvgAsset id={question.scene.backdrop} size="100%" cover className="h-full w-full" />
          </motion.div>
          {motionOK && <>
            <motion.div aria-hidden className="pointer-events-none absolute left-[-18%] top-[41%] z-[1] h-2 w-[42%] rounded-full bg-white/50 blur-[1px]" animate={{ x: [0, 560, 0], opacity: [.35, .75, .35] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div aria-hidden className="pointer-events-none absolute right-[-12%] top-[49%] z-[1] h-1.5 w-[32%] rounded-full bg-cyan-50/60" animate={{ x: [0, -440, 0], opacity: [.25, .65, .25] }} transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }} />
            <motion.div aria-hidden className="pointer-events-none absolute left-[10%] top-[12%] z-[1] h-2 w-2 rounded-full bg-white shadow-[18px_8px_0_2px_rgba(255,255,255,.8),42px_-4px_0_1px_rgba(255,255,255,.65)]" animate={{ x: [0, 35, 0], y: [0, -4, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
          </>}
          {question.objects.map((object, index) => {
            const isFound = found.has(object.id);
            const isTarget = question.targets.includes(object.id);
            const isCelebrating = celebratingId === object.id;
            const baseRotation = object.rotation ?? 0;
            return (
              <motion.button key={object.id} type="button" aria-label={`Search item ${index + 1}`}
                ref={(node) => { if (node) sceneObjectRefs.current.set(object.id, node); else sceneObjectRefs.current.delete(object.id); }}
                data-object-id={object.id} data-match-state={isCelebrating ? "celebrating" : isFound ? "found" : "searching"}
                onClick={() => choose(object)} initial={motionOK ? { opacity: 0, y: 8, rotate: baseRotation } : false} whileTap={{ scale: .88 }} whileHover={motionOK && !isFound ? { scale: 1.05 } : undefined}
                animate={isCelebrating && motionOK ? { opacity: .38, y: 2, scale: .88, rotate: baseRotation } : { opacity: 1, y: 0, scale: 1, rotate: baseRotation }}
                transition={isCelebrating && motionOK ? { type: "spring", stiffness: 520, damping: 22, mass: .65 } : { ...SPRING.enter, delay: stagger(index, .045, .35) }}
                className="absolute grid cursor-pointer place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                style={{ left: `${object.x - object.hitPadding}%`, top: `${object.y - object.hitPadding}%`, width: `${object.width + object.hitPadding * 2}%`, height: `${object.height + object.hitPadding * 2}%`, zIndex: object.z }}>
                <span data-visual-scale={isTarget ? "target" : "ordinary"} className="pointer-events-none grid h-full w-full place-items-center transition-transform duration-200"
                  style={isTarget ? {
                    transform: `scale(${question.targetScale})`,
                    opacity: isFound ? 1 : .85,
                    filter: `saturate(${1 - question.camouflageStrength * .55}) contrast(${1 - question.camouflageStrength * .18})`,
                    mixBlendMode: question.camouflageStrength >= .16 ? "multiply" : "normal",
                  } : undefined}><SvgAsset id={object.asset} size="100%" className={PREMIUM_ART_CLASS} /></span>
                {isCelebrating && motionOK && <MatchBurst />}
                {question.mode === "occluded" && <span aria-hidden className="absolute bottom-0 h-1/3 w-4/5 rounded-t-full bg-amber-200/90" />}
              </motion.button>
            );
          })}
          {regionHint && <div aria-label={`Highlighted ${regionHint} search region`} className={`pointer-events-none absolute h-1/2 w-1/2 animate-pulse border-4 border-amber-400 bg-amber-200/20 ${regionHint.includes("bottom") ? "bottom-0" : "top-0"} ${regionHint.includes("right") ? "right-0" : "left-0"}`} />}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-slate-700"><MapPin aria-hidden className="h-4 w-4 text-rose-500" />{question.scene.place}</div>
        </motion.div>
        <motion.div initial={motionOK ? { y: 10, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} transition={SPRING.enter}
          className="flex items-center justify-center gap-5 overflow-x-auto px-3 py-2" aria-label="Objects to find">
          {question.targets.map((id) => {
            const object = question.objects.find((item) => item.id === id)!;
            const name = OBJECT_BY_ID.get(id)?.name ?? id;
            const isCelebrating = celebratingId === id;
            return <motion.div key={id} ref={(node) => { if (node) targetRefs.current.set(id, node); else targetRefs.current.delete(id); }} data-target-id={id} data-match-state={isCelebrating ? "celebrating" : found.has(id) ? "found" : "searching"}
              initial={motionOK ? { scale: .8, opacity: 0 } : false}
              animate={isCelebrating && motionOK ? { opacity: 1, y: [0, -9, 2, 0], scale: [1, 1.18, .97, 1], rotate: [0, 4, -2, 0] } : { opacity: 1, y: 0, scale: 1, rotate: 0 }}
              transition={isCelebrating && motionOK ? { duration: .66, delay: .34, times: [0, .34, .68, 1], ease: ["easeOut", "easeInOut", "easeOut"] } : { ...SPRING.enter, delay: stagger(question.targets.indexOf(id), .08, .3) }}
              className="relative flex w-16 shrink-0 flex-col items-center gap-0.5">
              {showPreviews ? <TargetPreview object={object} mode={question.mode} found={found.has(id)} /> : <span className="grid h-14 w-14 place-items-center text-2xl font-medium text-slate-500">?</span>}
              <span className="w-16 text-center text-xs font-normal capitalize leading-tight text-slate-600 dark:text-slate-300">{name}</span>
            </motion.div>;
          })}
        </motion.div>
        <MatchFlight flight={flight} motionOK={motionOK} artClassName={PREMIUM_ART_CLASS} onComplete={() => setFlight(null)} />
      </section>
    </SkillRound>
  );
};
