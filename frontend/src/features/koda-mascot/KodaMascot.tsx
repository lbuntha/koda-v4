import React, { useEffect } from "react";
import { motion, type TargetAndTransition, useReducedMotion } from "motion/react";
import { useOptionalSvgLibrary } from "../../assets/SvgLibraryContext";
import { MASCOT_ASSETS } from "./catalog";
import { KodaSvgRenderer } from "./KodaSvgRenderer";
import { applyMascotClipAtTime, resolveMascotClip } from "./clips";
import { getBuiltinKodaDocument } from "./fallbackKoda";
import { ONE_SHOT_STATE_DURATION_MS, type KodaMascotState } from "./stateMachine";
import type { MascotDocument } from "./types";
import type { MascotBehavior } from "./types";

export type KodaMotionLevel = "full" | "calm" | "none";
export type KodaPhysicsLevel = "none" | "secondary";

const STATE_MOTION: Record<KodaMascotState, TargetAndTransition> = {
  idle: { y: [0, -2, 0] },
  welcome: { rotate: [0, -7, 7, 0], y: [0, -5, 0] },
  talking: { y: [0, -4, 0], scaleY: [1, 0.96, 1] },
  listening: { rotate: [0, -4, 0] },
  waiting: { y: [0, -2, 0] },
  thinking: { rotate: [0, -5, 0] },
  hint: { x: [0, 3, 0] },
  happy: { y: [0, -8, 0] },
  excited: { y: [0, -10, 0], rotate: [0, -9, 9, 0] },
  oops: { x: [0, -3, 3, -2, 0] },
  sad: { y: [0, 2, 0], rotate: [0, -2, 0] },
  loading: { rotate: [0, 2, -2, 0] },
  goodbye: { rotate: [0, 8, -5, 0], x: [0, 3, 0] },
};

const STATE_SECONDS: Record<KodaMascotState, number> = {
  idle: 2.6,
  welcome: 1.5,
  talking: 0.65,
  listening: 2.2,
  waiting: 2.8,
  thinking: 2.3,
  hint: 1.5,
  happy: 1.3,
  excited: 1.8,
  oops: 0.55,
  sad: 2.8,
  loading: 1.4,
  goodbye: 1.4,
};

export const behaviorMotionTarget = (behavior: MascotBehavior): TargetAndTransition => {
  const amount = Math.max(0, behavior.intensity);
  if (behavior.animation === "bounce") return { y: [0, -amount, 0] };
  if (behavior.animation === "float") return { y: [-amount / 2, amount / 2, -amount / 2] };
  if (behavior.animation === "wiggle") return { rotate: [-amount, amount, -amount] };
  if (behavior.animation === "pulse") return { scale: [1, 1 + amount / 100, 1] };
  if (behavior.animation === "spin") return { rotate: [0, 360] };
  return { x: 0, y: 0, rotate: 0, scale: 1 };
};

export interface KodaMascotProps {
  state?: KodaMascotState;
  document?: MascotDocument;
  size?: number;
  motionLevel?: KodaMotionLevel;
  physics?: KodaPhysicsLevel;
  className?: string;
  onStateComplete?: (state: KodaMascotState) => void;
  /** Clip id or name. Defaults to the document's active clip. */
  clip?: string | null;
  onClipComplete?: (clipId: string) => void;
}

/** Global Koda renderer. It has no API, editor, or Mongo dependency. */
export const KodaMascot: React.FC<KodaMascotProps> = ({
  state = "idle",
  document,
  size = 64,
  motionLevel = "full",
  physics = "secondary",
  className = "",
  onStateComplete,
  clip,
  onClipComplete,
}) => {
  const reduceMotion = useReducedMotion();
  const svgLibrary = useOptionalSvgLibrary();
  const level = reduceMotion ? "none" : motionLevel;
  const resolvedDocument = document ?? getBuiltinKodaDocument(state);
  const resolvedAssets = React.useMemo(() => [
    ...MASCOT_ASSETS,
    ...(svgLibrary?.assets ?? [])
      .filter((asset) => asset.mascotCategory)
      .map((asset) => ({ id: asset.id, name: asset.label, category: asset.mascotCategory!, markup: asset.markup, markupScale: asset.scale })),
  ], [svgLibrary?.assets]);
  const oneShotDuration = ONE_SHOT_STATE_DURATION_MS[state];
  const behavior = resolvedDocument.behavior;
  const resolvedClip = React.useMemo(() => resolveMascotClip(resolvedDocument, clip), [clip, resolvedDocument]);
  const [clipTime, setClipTime] = React.useState(0);

  useEffect(() => {
    if (level !== "full" || !resolvedClip || resolvedClip.keyframes.length === 0) {
      setClipTime(0);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const duration = Math.max(.05, resolvedClip.duration);
    const tick = (now: number) => {
      const elapsed = (now - startedAt) / 1000;
      if (!resolvedClip.loop && elapsed >= duration) {
        setClipTime(duration);
        onClipComplete?.(resolvedClip.id);
        return;
      }
      setClipTime(resolvedClip.loop ? elapsed % duration : elapsed);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [level, onClipComplete, resolvedClip]);

  const framedDocument = React.useMemo(() => applyMascotClipAtTime(resolvedDocument, resolvedClip, clipTime), [clipTime, resolvedClip, resolvedDocument]);

  useEffect(() => {
    if (!oneShotDuration || !onStateComplete) return;
    const timer = window.setTimeout(() => onStateComplete(state), level === "none" ? 0 : oneShotDuration);
    return () => window.clearTimeout(timer);
  }, [level, onStateComplete, oneShotDuration, state]);

  const transition = level === "full"
    ? { duration: behavior?.duration ?? STATE_SECONDS[state], repeat: behavior ? (behavior.loop ? Infinity : 0) : oneShotDuration ? 0 : Infinity, ease: "easeInOut" as const }
    : physics === "secondary" && level === "calm"
      ? { type: "spring" as const, stiffness: behavior?.spring.stiffness ?? 240, damping: behavior?.spring.damping ?? 20, mass: behavior?.spring.mass ?? 0.7 }
      : { duration: 0 };

  return (
    <motion.span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      initial={physics === "secondary" && level !== "none" ? { scale: 0.94, y: 2 } : false}
      animate={level === "full" ? (behavior ? behaviorMotionTarget(behavior) : STATE_MOTION[state]) : { x: 0, y: 0, rotate: 0, scale: 1 }}
      transition={transition}
      data-koda-state={state}
    >
      <KodaSvgRenderer
        document={framedDocument}
        playing={level === "full"}
        size={size}
        className="block overflow-visible"
        title={`${resolvedDocument.name} mascot`}
        assets={resolvedAssets}
      />
    </motion.span>
  );
};
