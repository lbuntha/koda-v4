import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, List, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { SvgAsset } from "../../../assets/svg";
import type { ActivityProps } from "../../types";
import { SkillRound, SPRING, composeHints, isPractice, playCopy, stagger, useMotionOK, useSkillRound, type RoundQuestion } from "../../kit";
import { CATEGORY_LABELS, OBJECT_BY_ID, SWARM_OBJECT_ID } from "../internal/data";
import { SCENE_BY_ID } from "../internal/scenes";
import { placeObjects, seedHash, seededShuffle } from "../internal/placement";
import { keyOf, type ObjectHuntSetup, type ObservationMode, type ObservationRegion, type ObservationScene, type SceneObject } from "../internal/types";
import { MatchFlight, type MatchFlightState } from "../internal/ui/MatchFlight";

export interface ObjectHuntParams extends ObjectHuntSetup {
  question?: ObjectHuntSetup;
}

export interface ObjectHuntQuestion extends RoundQuestion {
  mode: ObservationMode;
  scene: ObservationScene;
  objects: SceneObject[];
  /** Instance keys, so a swarm round can name each copy separately. */
  targets: string[];
  targetScale: number;
  camouflageStrength: number;
  /** Swarm rounds only: the catalog id every target shares. */
  swarmObjectId?: string;
  /** Category rounds only: what the round is asking for. */
  category?: string;
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

// Randomness, ordering, and placement all live in `internal/placement.ts` so
// one seed produces one reproducible layout. `hash` is kept as a thin alias
// because question ids are built from it.
const hash = seedHash;
const shuffled = seededShuffle;

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

/**
 * Swarm question: one character hidden many times in a single scene.
 *
 * Every copy is its own target, so the shared round contract is untouched —
 * `expected` is still a sorted key list and the last find is still the one
 * scored submission. Only the tray changes, to a card with a running count.
 */
function buildSwarmQuestion(setup: ObjectHuntSetup, scene: ObservationScene, seed: string): ObjectHuntQuestion {
  const swarmObjectId = scene.swarmObjectId ?? SWARM_OBJECT_ID;
  const copies = scene.objects.filter((object) => object.id === swarmObjectId);
  const others = scene.objects.filter((object) => object.id !== swarmObjectId);
  const wanted = Math.max(1, Math.min(copies.length, amount(setup.swarmCount, copies.length, `${seed}:swarm`)));
  // Shuffling which copies are live keeps the count honest without ever
  // showing the same frog twice, and stops the layout becoming memorisable.
  const live = shuffled(copies, `${seed}:swarm-pick`).slice(0, wanted);
  const decoyCount = Math.max(0, Math.min(others.length, (setup.objectCount as number | undefined ?? live.length + 4) - live.length));
  const decoys = shuffled(others, `${seed}:swarm-decoys`).slice(0, decoyCount);
  // Fourteen identical stamps read as a row of stickers, not as something
  // hidden. Turning, resizing, and half-tucking each copy makes the child
  // check a shape rather than scan for one repeated blob — and the decoys get
  // the same treatment so none of it marks out an answer.
  const varied = placeObjects(scene, shuffled([...live, ...decoys], `${seed}:display`), `${seed}:locations`);
  const swarmRotations = [0, 14, -12, 26, -22, 8, -30, 18];
  const objects = varied.map((object) => {
    const key = keyOf(object);
    const tuck = hash(`${seed}:${key}:tuck`) % 5;
    return {
      ...object,
      rotation: (object.rotation ?? 0) + swarmRotations[hash(`${seed}:${key}:spin`) % swarmRotations.length],
      visualScale: 0.82 + (hash(`${seed}:${key}:size`) % 30) / 100,
      visibleFraction: tuck < 2 ? 0.74 : object.visibleFraction,
    };
  });
  const targets = live.map(keyOf);
  const name = OBJECT_BY_ID.get(swarmObjectId)?.name ?? "frog";
  const visibility = visibilityProfile(setup.level, setup);
  return {
    id: `object-hunt-${hash(seed).toString(36)}`,
    taskKind: `find_swarm_${scene.id}`,
    prompt: `Find all ${targets.length} ${name}s.`,
    expected: [...targets].sort().join(","),
    itemCount: objects.length,
    mode: "swarm",
    scene,
    objects,
    targets,
    swarmObjectId,
    ...visibility,
  };
}

/**
 * Category question: "find three things you can eat".
 *
 * The tray shows no picture, so there is nothing to template-match against —
 * the child has to recognise each object and decide whether it belongs. Every
 * scene object of the chosen category is a target, which keeps the count
 * honest and stops a partial answer from scoring.
 */
function buildCategoryQuestion(setup: ObjectHuntSetup, scene: ObservationScene, seed: string): ObjectHuntQuestion {
  const available = new Map<string, SceneObject[]>();
  scene.objects.forEach((object) => {
    const category = OBJECT_BY_ID.get(object.id)?.category;
    if (category) available.set(category, [...(available.get(category) ?? []), object]);
  });
  const allowed = (setup.categories ?? [...available.keys()])
    .filter((category) => (available.get(category)?.length ?? 0) >= 2);
  const pool = allowed.length ? allowed : [...available.keys()];
  const category = shuffled(pool, `${seed}:category`)[0];
  const members = available.get(category) ?? [];
  const targetObjects = shuffled(members, `${seed}:members`).slice(0, Math.min(members.length, 4));
  const targetKeys = new Set(targetObjects.map(keyOf));
  // Every remaining member of the group leaves the scene as well. A capped
  // round that still showed the leftovers would call a correct answer wrong:
  // the child taps a thing you can eat and is told it is not a match.
  const others = scene.objects.filter((object) => {
    if (targetKeys.has(keyOf(object))) return false;
    return OBJECT_BY_ID.get(object.id)?.category !== category;
  });
  const wanted = Math.max(targetObjects.length + 2, amount(setup.objectCount, 10, `${seed}:count`));
  const decoys = shuffled(others, `${seed}:decoys`).slice(0, Math.max(0, wanted - targetObjects.length));
  const objects = placeObjects(scene, shuffled([...targetObjects, ...decoys], `${seed}:display`), `${seed}:locations`);
  const targets = targetObjects.map(keyOf);
  const visibility = visibilityProfile(setup.level, setup);
  return {
    id: `object-hunt-${hash(seed).toString(36)}`,
    taskKind: `find_category_${category}_${scene.id}`,
    prompt: `Find ${targets.length} ${CATEGORY_LABELS[category] ?? category}.`,
    expected: [...targets].sort().join(","),
    itemCount: objects.length,
    mode: "category",
    scene,
    objects,
    targets,
    category,
    ...visibility,
  };
}

export function buildQuestion(setup: ObjectHuntSetup, index: number): ObjectHuntQuestion {
  const baseSeed = setup.seed ?? "observation";
  const requestedScenes = setup.sceneIds?.length ? setup.sceneIds : [setup.sceneId ?? "beach-sandcastle-shore"];
  const sceneOrder = shuffled(requestedScenes, `${baseSeed}:scenes`);
  const scene = SCENE_BY_ID.get(sceneOrder[(index - 1) % sceneOrder.length]) ?? [...SCENE_BY_ID.values()][0];
  const roundSeed = `${baseSeed}:${scene.id}`;
  const seed = `${roundSeed}:${index}`;
  const mode = selectedMode(setup, index);
  if (mode === "swarm") return buildSwarmQuestion(setup, scene, seed);
  if (mode === "category") return buildCategoryQuestion(setup, scene, seed);
  const objectCount = Math.max(1, Math.min(scene.objects.length, amount(setup.objectCount, 8, `${seed}:objects`)));
  const targetCount = Math.max(1, Math.min(objectCount, amount(setup.targetCount, 1, `${seed}:targets`)));
  // Scene variants in one lesson share a target deck, so moving from one
  // backdrop to another does not reset the no-repeat promise.
  const targetDeckSeed = `${baseSeed}:${requestedScenes.join("|")}:answers`;
  // A mirror round can only ask about objects whose reflection looks different.
  const eligible = mode === "mirror"
    ? scene.objects.filter((object) => OBJECT_BY_ID.get(object.id)?.mirrorSafe)
    : scene.objects;
  const deck = eligible.length >= 2 ? eligible : scene.objects;
  const targetOrder = [...deck].sort((a, b) => hash(`${targetDeckSeed}:${a.id}`) - hash(`${targetDeckSeed}:${b.id}`));
  // Deal from one shuffled round deck so every scene object is considered
  // before any target repeats, including multi-target questions.
  const plannedTargetDraws = targetCount * (setup.questionsPerRound ?? 5);
  const targetStride = plannedTargetDraws <= targetOrder.length ? targetCount : 1;
  const targetStart = (index - 1) * targetStride;
  const targetObjects = Array.from({ length: targetCount }, (_, offset) => targetOrder[(targetStart + offset) % targetOrder.length]);
  const targetIds = new Set(targetObjects.map(keyOf));
  const distractorPool = shuffled(scene.objects.filter((object) => !targetIds.has(keyOf(object))), `${seed}:pool`);
  const targetDecoyGroups = new Set(targetObjects.map((object) => OBJECT_BY_ID.get(object.id)?.decoyGroup).filter(Boolean));
  const rankedDistractors = mode === "near_decoys"
    ? [...distractorPool.filter((object) => targetDecoyGroups.has(OBJECT_BY_ID.get(object.id)?.decoyGroup)), ...distractorPool.filter((object) => !targetDecoyGroups.has(OBJECT_BY_ID.get(object.id)?.decoyGroup))]
    : distractorPool;
  const distractors = rankedDistractors.slice(0, objectCount - targetCount);
  const placedObjects = placeObjects(scene, shuffled([...targetObjects, ...distractors], `${seed}:display`), `${seed}:locations`);
  const rotationSteps = [45, -60, 90, -120, 135, 180];
  const scaleSteps = [0.72, 0.84, 0.96, 1.08, 1.2];
  // The transform a level teaches has to reach the distractors too. Rotating
  // only the answers turns "find the turned object" into "find the one that
  // looks different", which needs no shape matching at all — and is the
  // shrinking-targets anti-pattern the build plan opens its risk list with.
  const objects = placedObjects.map((object) => {
    const key = keyOf(object);
    if (mode === "rotation") return { ...object, rotation: rotationSteps[hash(`${seed}:${key}:rotation`) % rotationSteps.length] };
    if (mode === "scale") return { ...object, visualScale: scaleSteps[hash(`${seed}:${key}:scale`) % scaleSteps.length] };
    // Targets are always partly hidden; enough distractors join them that being
    // occluded is not itself the clue.
    if (mode === "occluded" && (targetIds.has(key) || hash(`${seed}:${key}:occlude`) % 3 > 0)) {
      return { ...object, visibleFraction: 0.72 };
    }
    // Overlap: art is drawn larger than its hit box, so shapes cross over one
    // another the way a real pile does. The boxes stay apart, so a tap is still
    // unambiguous — only the picture is tangled, never the scoring.
    // Slots sit ~19% of the scene apart, so art has to pass that to cross.
    if (mode === "overlap") return { ...object, visualScale: 3.3 + (hash(`${seed}:${key}:spill`) % 50) / 100 };
    // Mirror: about half the scene is flipped, targets included, so handedness
    // is a real feature to check rather than a marker for the answer.
    if (mode === "mirror") {
      const canFlip = OBJECT_BY_ID.get(object.id)?.mirrorSafe;
      return { ...object, mirrored: !!canFlip && hash(`${seed}:${key}:flip`) % 2 === 0 };
    }
    return object;
  });
  const targets = targetObjects.map(keyOf);
  const names = targetObjects.map((object) => OBJECT_BY_ID.get(object.id)?.name ?? object.id);
  const visibility = visibilityProfile(setup.level, setup);
  return {
    id: `object-hunt-${hash(seed).toString(36)}`,
    taskKind: `find_${mode}_${scene.id}`,
    prompt: targetCount === 1 ? `Find the ${names[0]}.` : `Find ${targetCount} hidden objects.`,
    expected: targets.join(","),
    itemCount: objects.length,
    mode,
    scene,
    objects,
    targets,
    ...visibility,
  };
}

export function objectHuntHints(question: ObjectHuntQuestion, found: ReadonlySet<string>): string[] {
  const next = question.targets.find((key) => !found.has(key));
  const placement = question.objects.find((object) => keyOf(object) === next);
  const name = placement ? OBJECT_BY_ID.get(placement.id)?.name : undefined;
  const region = placement?.region.replace("-", " ");
  return composeHints(
    "Scan one small part at a time. Move your eyes from left to right.",
    region && name ? `Look near the ${region} part of the scene.` : undefined,
    region ? `Focus on the ${region} area. Check around objects that could partly hide it.` : undefined,
  );
}

export const promptFor = (question: ObjectHuntQuestion): string => question.prompt ?? "Find the hidden objects.";
export const printedFor = (): null => null;

const TargetPreview: React.FC<{ object: SceneObject; mode: ObservationMode; found: boolean }> = ({ object, mode, found }) => {
  const transform = mode === "scale" ? "scale(.72)" : undefined;
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
      return <motion.span key={index} className="absolute h-2 w-2 rounded-full bg-emerald-400 shadow-sm"
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
  // The kit already gates the lesson intro, the hint line, and the recorded
  // reactions. The "Find the {object}" replay is the skill's own speech, so
  // this switch has to reach it here or it would keep talking on its own.
  const speechEnabled = koda.config.isEnabled("audio_speech", true);
  const listViewEnabled = koda.config.isEnabled("accessible_list_view", true);
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
  const [viewMode, setViewMode] = useState<"scene" | "list">("scene");
  const view = listViewEnabled ? viewMode : "scene";

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
    const key = keyOf(object);
    if (!question.targets.includes(key)) {
      // One voice at a time: stop unfinished speech, play the short error
      // chime, then let `round.submit` start its delayed recorded reaction.
      koda.speech.stop(); chime("error"); pulse("error"); setNudge("Not a match. Look carefully and try again!");
      round.submit({ correct: false, given: object.id, expected: question.expected, errorKind: "miscounted_items", title: "Not a match", message: "Look carefully and try again!" });
      return;
    }
    if (found.has(key)) {
      // A re-tap is not an answer, so it gets no chime and no reaction — just
      // the spoken reminder the audio plan lists as a required fixed phrase.
      // The line stays generic because a swarm scene has fourteen frogs and
      // recording "you already found the frog" per copy would say no more.
      setNudge(`You already found the ${OBJECT_BY_ID.get(object.id)?.name}.`);
      if (speechEnabled) {
        koda.speech.stop();
        void koda.speech.say("You already found that one.", { rate: speechRate }).catch(() => {});
      }
      return;
    }
    const next = new Set(found); next.add(key); setFound(next); setNudge(null);
    if (celebrationTimer.current !== null) window.clearTimeout(celebrationTimer.current);
    setCelebratingId(key);
    celebrationTimer.current = window.setTimeout(() => setCelebratingId(null), 1100);
    const source = sceneObjectRefs.current.get(key)?.getBoundingClientRect();
    // A swarm tray has one card for every copy, so all finds fly to it.
    const destination = targetRefs.current.get(question.swarmObjectId ?? key)?.getBoundingClientRect();
    if (source && destination && motionOK) {
      const sceneVisualScale = question.targetScale * (object.visualScale ?? 1);
      setFlight({
        key: Date.now(),
        asset: object.asset,
        from: {
          left: source.left + source.width * (1 - sceneVisualScale) / 2,
          top: source.top + source.height * (1 - sceneVisualScale) / 2,
          width: source.width * sceneVisualScale,
          height: source.height * sceneVisualScale,
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
    const next = question.targets.find((key) => !found.has(key));
    setRegionHint(question.objects.find((object) => keyOf(object) === next)?.region ?? null);
  }, [round.hint.level, question, found]);

  return (
    <SkillRound koda={koda} lesson={lesson} fallbackTitle="Hidden Object Hunt" round={round} totalQuestions={total}
      prompt={promptFor(question)} onExit={() => koda.ui.exit()} hints={hints} nudge={nudge}
      iconName="Search" iconTone="indigo"
      onReadAloud={practising || !speechEnabled ? undefined : () => { round.useSupport("audio_replay"); void koda.speech.say(promptFor(question), { rate: speechRate }); }}>
      <section aria-label={`${question.scene.name} hidden object game`} className="mx-auto w-full max-w-[760px] space-y-3 md:space-y-2">
        {listViewEnabled && (
        <div className="flex items-center justify-end gap-1" role="group" aria-label="Search view">
          <button type="button" aria-pressed={view === "scene"} onClick={() => setViewMode("scene")}
            className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${view === "scene" ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            <ImageIcon aria-hidden className="h-4 w-4" />Scene
          </button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setViewMode("list")}
            className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${view === "list" ? "bg-slate-800 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            <List aria-hidden className="h-4 w-4" />List
          </button>
        </div>
        )}
        <p className="sr-only" aria-live="polite">{found.size} of {question.targets.length} target objects found.</p>
        {view === "scene" ? (
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
            const key = keyOf(object);
            const isFound = found.has(key);
            const isTarget = question.targets.includes(key);
            const isCelebrating = celebratingId === key;
            const baseRotation = object.rotation ?? 0;
            return (
              <motion.button key={key} type="button" aria-label={`Search item ${index + 1}`}
                ref={(node) => { if (node) sceneObjectRefs.current.set(key, node); else sceneObjectRefs.current.delete(key); }}
                data-object-id={key} data-match-state={isCelebrating ? "celebrating" : isFound ? "found" : "searching"}
                onClick={() => choose(object)} initial={motionOK ? { opacity: 0, y: 8, rotate: baseRotation } : false} whileTap={motionOK ? { scale: .88 } : undefined} whileHover={motionOK && !isFound ? { scale: 1.05 } : undefined}
                animate={isCelebrating && motionOK ? { opacity: .38, y: 2, scale: .88, rotate: baseRotation } : { opacity: 1, y: 0, scale: 1, rotate: baseRotation }}
                transition={isCelebrating && motionOK ? { type: "spring", stiffness: 520, damping: 22, mass: .65 } : { ...SPRING.enter, delay: stagger(index, .045, .35) }}
                className="absolute grid cursor-pointer place-items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
                style={{ left: `${object.x - object.hitPadding}%`, top: `${object.y - object.hitPadding}%`, width: `${object.width + object.hitPadding * 2}%`, height: `${object.height + object.hitPadding * 2}%`, zIndex: object.z }}>
                {/* Size, fade, and camouflage are scene-wide. Applying them to
                    the answers alone made every target the one small washed-out
                    thing on screen, which a child solves without looking at a
                    shape. Found objects return to full opacity as the reward. */}
                <span data-visual-scale={isTarget ? "target" : "ordinary"} className="pointer-events-none grid h-full w-full place-items-center transition-transform duration-200"
                  style={{
                    transform: `scale(${question.targetScale * (object.visualScale ?? 1)})${object.mirrored ? " scaleX(-1)" : ""}`,
                    opacity: isFound ? 1 : .85,
                    // Shadow rounds flatten every object to its outline, so only
                    // contour is left to match. Camouflage rounds drain colour
                    // and let the backdrop's own hue come through instead.
                    filter: question.mode === "shadow"
                      ? "brightness(0)"
                      : `saturate(${(question.mode === "camouflage" ? .34 : 1) * (1 - question.camouflageStrength * .55)}) contrast(${1 - question.camouflageStrength * .18})`,
                    mixBlendMode: question.mode === "camouflage" ? "luminosity" : question.camouflageStrength >= .16 ? "multiply" : "normal",
                    clipPath: object.visibleFraction < 1 ? `inset(0 0 ${(1 - object.visibleFraction) * 100}% 0)` : undefined,
                  }}><SvgAsset id={object.asset} size="100%" className={PREMIUM_ART_CLASS} /></span>
                {isCelebrating && motionOK && <MatchBurst />}
              </motion.button>
            );
          })}
          {regionHint && <div aria-label={`Highlighted ${regionHint} search region`} className={`pointer-events-none absolute h-1/2 w-1/2 motion-safe:animate-pulse border-4 border-indigo-400 bg-indigo-300/20 ${regionHint.includes("bottom") ? "bottom-0" : "top-0"} ${regionHint.includes("right") ? "right-0" : "left-0"}`} />}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-slate-700"><MapPin aria-hidden className="h-4 w-4 text-rose-500" />{question.scene.place}</div>
        </motion.div>
        ) : (
          <motion.div initial={motionOK ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={SPRING.settle}
            className="grid min-h-[320px] grid-cols-2 content-center gap-2 rounded-[2rem] bg-slate-50 p-4 shadow-inner sm:grid-cols-5 dark:bg-slate-900/60"
            aria-label="Labelled search candidates">
            {question.objects.map((object, index) => {
              const key = keyOf(object);
              const base = OBJECT_BY_ID.get(object.id)?.name ?? object.id;
              // Swarm copies share a name, so number them: a screen-reader user
              // has to be able to tell "frog 3" from "frog 7" to find them all.
              const name = object.instanceId ? `${base} ${index + 1}` : base;
              const isFound = found.has(key);
              return <button key={key} type="button" aria-label={`Choose ${name}`} onClick={() => choose(object)}
                ref={(node) => { if (node) sceneObjectRefs.current.set(key, node); else sceneObjectRefs.current.delete(key); }}
                data-object-id={key} data-match-state={isFound ? "found" : "searching"}
                className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-transparent px-2 py-2 text-slate-600 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-300 dark:hover:bg-slate-800">
                <span className={`grid h-12 w-12 place-items-center transition-opacity ${isFound ? "opacity-100" : "opacity-90"}`}><SvgAsset id={object.asset} size={40} className={PREMIUM_ART_CLASS} /></span>
                <span className="text-center text-[11px] font-normal capitalize leading-tight">{name}</span>
              </button>;
            })}
          </motion.div>
        )}
        <motion.div initial={motionOK ? { y: 10, opacity: 0 } : false} animate={{ y: 0, opacity: 1 }} transition={SPRING.enter}
          className="flex items-center justify-center gap-5 overflow-x-auto px-3 py-2" aria-label="Objects to find">
          {question.category ? (
            // No preview art: showing pictures would hand back the template the
            // level exists to remove. The card names the group and counts down.
            <div data-target-id={`category-${question.category}`} data-category-progress={`${found.size}/${question.targets.length}`}
              className="flex shrink-0 items-center gap-3 rounded-2xl bg-slate-100 px-4 py-2 dark:bg-slate-800">
              <span aria-hidden className="grid h-14 w-14 place-items-center rounded-xl bg-white text-2xl dark:bg-slate-900">?</span>
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{CATEGORY_LABELS[question.category] ?? question.category}</span>
                <span className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{found.size} / {question.targets.length}</span>
              </span>
            </div>
          ) : question.swarmObjectId ? (() => {
            // One card for the whole swarm. A tray of fourteen identical frog
            // previews would say nothing the counter does not say better.
            const swarmId = question.swarmObjectId;
            const name = OBJECT_BY_ID.get(swarmId)?.name ?? "frog";
            const sample = question.objects.find((object) => object.id === swarmId);
            const remaining = question.targets.length - found.size;
            return <motion.div ref={(node) => { if (node) targetRefs.current.set(swarmId, node); else targetRefs.current.delete(swarmId); }}
              data-target-id={swarmId} data-swarm-progress={`${found.size}/${question.targets.length}`}
              data-match-state={celebratingId ? "celebrating" : remaining === 0 ? "found" : "searching"}
              initial={motionOK ? { scale: .8, opacity: 0 } : false} animate={{ opacity: 1, scale: 1 }} transition={SPRING.enter}
              className="flex shrink-0 items-center gap-3 rounded-2xl bg-slate-100 px-4 py-2 dark:bg-slate-800">
              {showPreviews && sample
                ? <TargetPreview object={sample} mode="exact" found={remaining === 0} />
                : <span className="grid h-14 w-14 place-items-center text-2xl font-medium text-slate-500">?</span>}
              <span className="flex flex-col leading-tight">
                <span className="text-sm font-semibold capitalize text-slate-700 dark:text-slate-200">{name}s</span>
                <span className="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{found.size} / {question.targets.length}</span>
              </span>
            </motion.div>;
          })() : question.targets.map((id) => {
            const object = question.objects.find((item) => keyOf(item) === id)!;
            const name = OBJECT_BY_ID.get(object.id)?.name ?? id;
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
