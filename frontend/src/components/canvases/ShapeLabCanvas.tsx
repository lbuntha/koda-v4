/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shape Lab — the three Grade 1 geometry standards on one mat.
 *
 *   sides / corners   count a shape's defining attributes (1.G.A.1)
 *   compose           which two shapes join to make this one (1.G.A.2)
 *   shares            split a circle or rectangle into equal parts and name them (1.G.A.3)
 *
 * The shapes are drawn as SVG polygons from their vertex counts rather than picked from a
 * picture set, so a hexagon really has six sides to count and a partitioned circle really is
 * divided into equal wedges. `1.G.A.1` is explicitly about *defining* attributes — a shape
 * that only looks approximately right teaches the opposite of the standard.
 *
 * Chrome comes from `SharedCanvasLayout`, the same as Move & Count: the shape sits on the open
 * stage with no frame of its own. A box around a shape is actively confusing here — a rectangle
 * drawn inside a rounded rectangle reads as two shapes, and "how many corners" becomes
 * ambiguous.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Shapes } from "lucide-react";
import { sounds } from "../../sound";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { guidePropsFor } from "../../features/koda-mascot";
import { CanvasChip, CanvasAccent, captionClass } from "./canvasTheme";
import type { CanvasProps } from "./types";
import { balancedChoiceOrder } from "./choiceOrder";

export type ShapeTask = "sides" | "corners" | "compose" | "shares";
export type ShapeName = "triangle" | "square" | "rectangle" | "pentagon" | "hexagon" | "circle";

export interface ShapeLabConfig {
  task: ShapeTask;
  shape: ShapeName;
  /** For `shares`: how many equal parts the shape is cut into (2 or 4). */
  shares: number;
}

export const SHAPE_SIDES: Record<ShapeName, number> = {
  triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6, circle: 0,
};

/**
 * Which identical shape the target is built from — the answer to `compose` — and how many
 * of them it takes. The count is not decoration: two triangles do make a square, but two
 * triangles do *not* make a hexagon (six do), and a prompt that says "which two shapes"
 * for every case teaches a falsehood in the one case it is wrong.
 */
const COMPOSED_FROM: Partial<Record<ShapeName, { part: ShapeName; pieces: number }>> = {
  square: { part: "triangle", pieces: 2 },
  rectangle: { part: "square", pieces: 2 },
  hexagon: { part: "triangle", pieces: 6 },
};

export function normalizeShapeConfig(input: Partial<ShapeLabConfig>): ShapeLabConfig {
  const task: ShapeTask =
    input.task === "corners" || input.task === "compose" || input.task === "shares"
      ? input.task
      : "sides";
  const shape: ShapeName = (Object.keys(SHAPE_SIDES) as ShapeName[]).includes(input.shape as ShapeName)
    ? (input.shape as ShapeName)
    : task === "shares" ? "circle" : "triangle";
  const shares = Number(input.shares) === 4 ? 4 : 2;
  return { task, shape, shares };
}

/** How the target shape is built, with a safe default for shapes nothing composes. */
export const composition = (shape: ShapeName): { part: ShapeName; pieces: number } =>
  COMPOSED_FROM[shape] ?? { part: "triangle", pieces: 2 };

/** Sides and corners are numbers; compose and shares are answered from a named list. */
export function shapeAnswer(config: ShapeLabConfig): number {
  if (config.task === "shares") return config.shares;
  if (config.task === "compose") {
    const parts = Object.keys(SHAPE_SIDES) as ShapeName[];
    return parts.indexOf(composition(config.shape).part) + 1;
  }
  // A polygon has as many corners as sides; a circle has neither.
  return SHAPE_SIDES[config.shape];
}

export function shapePrompt(config: ShapeLabConfig): string {
  if (config.task === "sides") return `How many sides does the ${config.shape} have?`;
  if (config.task === "corners") return `How many corners does the ${config.shape} have?`;
  if (config.task === "compose") {
    // The dashed cuts on the shape show the pieces; the prompt says how many there are, so
    // the child is choosing *which shape* rather than guessing the count as well.
    return `This ${config.shape} is cut into ${composition(config.shape).pieces} equal pieces. What shape is each piece?`;
  }
  // Naming the parts is the standard (1.G.A.3); counting them off the picture is not.
  return `The ${config.shape} is cut into ${config.shares} equal parts. What is each part called?`;
}

const SHARE_WORD: Record<number, string> = { 2: "halves", 3: "thirds", 4: "fourths" };

/** Regular polygon points on a 100×100 viewBox. */
const points = (sides: number, rotation = -90): string =>
  Array.from({ length: sides })
    .map((_, index) => {
      const angle = ((360 / sides) * index + rotation) * (Math.PI / 180);
      return `${50 + 40 * Math.cos(angle)},${50 + 40 * Math.sin(angle)}`;
    })
    .join(" ");

export const ShapeLabCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  showGrid,
  onSuccess,
  onAttempt,
}) => {
  const config = useMemo(() => normalizeShapeConfig({
    task: question.config.shapeTask as ShapeTask,
    shape: question.config.shapeName as ShapeName,
    shares: question.config.shapeShares as number,
  }), [question.config.shapeTask, question.config.shapeName, question.config.shapeShares]);

  const answer = shapeAnswer(config);
  const [picked, setPicked] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    setPicked(null);
    setSolved(false);
  }, [question.id, config.task, config.shape, config.shares]);

  const choose = (value: number) => {
    if (!isPlayMode || solved) return;
    setPicked(value);
    if (value !== answer) {
      sounds.playFail();
      onAttempt?.("incorrect", { expected: answer, selected: value, details: { task: config.task, shape: config.shape } });
      return;
    }
    sounds.playWin();
    setSolved(true);
    onAttempt?.("correct", { expected: answer, selected: value, details: { task: config.task, shape: config.shape } });
    onSuccess?.();
  };

  const shapeNames = Object.keys(SHAPE_SIDES) as ShapeName[];
  const choices = useMemo(() => {
    if (config.task === "compose") return balancedChoiceOrder([1, 2, 3], answer, question.config.answerChoiceSlot);
    if (config.task === "shares") return balancedChoiceOrder([2, 3, 4], answer, question.config.answerChoiceSlot);
    const options = new Set<number>([answer]);
    for (const delta of [1, -1, 2]) {
      if (options.size >= 4) break;
      const candidate = answer + delta;
      if (candidate >= 0 && candidate <= 8) options.add(candidate);
    }
    return balancedChoiceOrder([...options].sort((a, b) => a - b), answer, question.config.answerChoiceSlot);
  }, [answer, config.task, question.config.answerChoiceSlot]);

  const accent: CanvasAccent = "purple";
  const stroke = isDark ? "#f0abfc" : "#a21caf";
  const fill = isDark ? "rgba(240,171,252,0.16)" : "rgba(217,70,239,0.14)";

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={shapePrompt(config)}
      showGrid={showGrid}
      isDark={isDark}
      accent={accent}
      headerTitle="Shape Lab"
      /*
        The question leads — see `CountCanvas` for the standard. The activity's
        own name and its meta line move out of the prominent slot; what a child
        has to do takes it, and does not change while they work.
      */
      questionText={question.instruction?.trim() || shapePrompt(config)}
      /* The four moments, cast from Mascot Studio — see `casting.ts`. */
      guideRole={solved ? "celebrating" : picked !== null ? "oops" : "waiting"}
      {...guidePropsFor(question)}
      readAloudText={shapePrompt(config)}
      headerActions={
        <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>
          {solved
            ? config.task === "shares"
              ? SHARE_WORD[answer] ?? `${answer} parts`
              : config.task === "compose"
                ? shapeNames[answer - 1]
                : `${answer}`
            : "Find it"}
        </CanvasChip>
      }
      footerStatus={
        solved
          ? config.task === "shares"
            ? `Spot on! ${config.shares} equal parts are called ${SHARE_WORD[config.shares]}.`
            : config.task === "compose"
              ? `Spot on! ${composition(config.shape).pieces} ${composition(config.shape).part}s make a ${config.shape}.`
              : "Spot on!"
          : picked !== null
            ? "Not quite — look at the shape again and count carefully."
            : undefined
      }
      footerSolved={solved}
    >
      {/* Open stage, no frame — the only outline on screen belongs to the shape itself. */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-5 py-2">
        <svg viewBox="0 0 100 100" className="h-40 w-40 md:h-52 md:w-52" role="img" aria-label={config.shape}>
          {config.shape === "circle" ? (
            <circle cx="50" cy="50" r="40" fill={fill} stroke={stroke} strokeWidth="3" />
          ) : config.shape === "rectangle" ? (
            <rect x="12" y="26" width="76" height="48" rx="3" fill={fill} stroke={stroke} strokeWidth="3" />
          ) : config.shape === "square" ? (
            <rect x="18" y="18" width="64" height="64" rx="3" fill={fill} stroke={stroke} strokeWidth="3" />
          ) : (
            <polygon points={points(SHAPE_SIDES[config.shape])} fill={fill} stroke={stroke} strokeWidth="3" />
          )}

          {/* Composition cuts. Without them "what shape is each piece?" is a memory question
              rather than something a child can see and answer. */}
          {config.task === "compose" && config.shape === "square" && (
            <line x1="18" y1="82" x2="82" y2="18" stroke={stroke} strokeWidth="2.5" strokeDasharray="4 3" />
          )}
          {config.task === "compose" && config.shape === "rectangle" && (
            <line x1="50" y1="26" x2="50" y2="74" stroke={stroke} strokeWidth="2.5" strokeDasharray="4 3" />
          )}
          {config.task === "compose" && config.shape === "hexagon" && (
            points(6).split(" ").map((pair, index) => {
              const [x, y] = pair.split(",");
              return <line key={index} x1="50" y1="50" x2={x} y2={y} stroke={stroke} strokeWidth="2.5" strokeDasharray="4 3" />;
            })
          )}

          {/* Equal shares, cut through the middle so the parts really are equal. */}
          {config.task === "shares" && (
            <>
              <line x1="50" y1="6" x2="50" y2="94" stroke={stroke} strokeWidth="2.5" strokeDasharray="4 3" />
              {config.shares === 4 && (
                <line x1="6" y1="50" x2="94" y2="50" stroke={stroke} strokeWidth="2.5" strokeDasharray="4 3" />
              )}
            </>
          )}

          {/* Corner dots make "how many corners" countable rather than remembered. */}
          {config.task === "corners" && config.shape !== "circle" && (
            points(SHAPE_SIDES[config.shape]).split(" ").map((pair, index) => {
              const [x, y] = pair.split(",");
              return <circle key={index} cx={x} cy={y} r="4" fill={stroke} />;
            })
          )}
        </svg>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {choices.map(choice => {
            const isPicked = picked === choice;
            const isRight = solved && choice === answer;
            const label = config.task === "compose"
              ? shapeNames[choice - 1]
              : config.task === "shares"
                ? SHARE_WORD[choice] ?? `${choice} parts`
                : choice;
            return (
              <button
                key={choice}
                type="button"
                disabled={!isPlayMode || solved}
                onClick={() => choose(choice)}
                className={`h-12 min-w-[64px] rounded-2xl border px-3 font-mono text-base font-black capitalize transition-all duration-200 disabled:cursor-default ${
                  isRight
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : isPicked
                      ? "border-rose-400 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                      : isDark
                        ? "border-white/10 bg-white/5 text-slate-200 hover:scale-105 hover:border-fuchsia-400/60"
                        : "border-slate-200/80 bg-white text-slate-700 shadow-sm hover:scale-105 hover:border-fuchsia-400/60"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <span className={`font-mono text-[9px] font-bold uppercase tracking-[0.18em] ${captionClass(isDark)}`}>
          {config.task === "shares" ? "equal shares" : config.task}
        </span>
      </div>
    </SharedCanvasLayout>
  );
};
