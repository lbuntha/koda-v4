/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Clock — read an analog face at the hour or the half-hour (1.MD.B.3).
 *
 * The hands are drawn from the time rather than posed by hand, which is what makes the
 * half-hour honest: at half past two the hour hand sits *between* two and three, not on the
 * two. A clock that cheats there teaches a child to read the wrong thing, and it is the single
 * most common mistake in half-hour worksheets.
 *
 * CPA: concrete moving hands, pictorial numbered face, abstract digital time in the banner.
 */

import React, { useEffect, useMemo, useState } from "react";
import { sounds } from "../../sound";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { guidePropsFor } from "../../features/koda-mascot";
import { CanvasChip, CanvasAccent } from "./canvasTheme";
import type { CanvasProps } from "./types";
import { balancedChoiceOrder } from "./choiceOrder";

export interface ClockConfig {
  hour: number;   // 1-12
  minute: 0 | 30;
}

export function normalizeClockConfig(input: Partial<ClockConfig>): ClockConfig {
  const raw = Math.round(Number(input.hour));
  const hour = Number.isFinite(raw) ? ((((raw - 1) % 12) + 12) % 12) + 1 : 3;
  return { hour, minute: Number(input.minute) === 30 ? 30 : 0 };
}

export const clockLabel = (config: ClockConfig): string =>
  `${config.hour}:${config.minute === 30 ? "30" : "00"}`;

/** Four plausible times: the answer, the hour either side, and the same hour's other half. */
export function clockChoices(config: ClockConfig): string[] {
  const shift = (hour: number, by: number) => ((((hour - 1 + by) % 12) + 12) % 12) + 1;
  const options = new Set<string>([
    clockLabel(config),
    clockLabel({ hour: config.hour, minute: config.minute === 30 ? 0 : 30 }),
    clockLabel({ hour: shift(config.hour, 1), minute: config.minute }),
    clockLabel({ hour: shift(config.hour, -1), minute: config.minute }),
  ]);
  return [...options].sort((a, b) => {
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    return ah - bh || am - bm;
  });
}

export const ClockCanvas: React.FC<CanvasProps> = ({
  question,
  isPlayMode,
  isDark = false,
  showGrid,
  onSuccess,
  onAttempt,
}) => {
  const config = useMemo(() => normalizeClockConfig({
    hour: question.config.clockHour,
    minute: question.config.clockMinute as 0 | 30,
  }), [question.config.clockHour, question.config.clockMinute]);

  const answer = clockLabel(config);
  const choices = useMemo(
    () => balancedChoiceOrder(clockChoices(config), answer, question.config.answerChoiceSlot),
    [answer, config, question.config.answerChoiceSlot],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    setPicked(null);
    setSolved(false);
  }, [question.id, config.hour, config.minute]);

  const choose = (value: string) => {
    if (!isPlayMode || solved) return;
    setPicked(value);
    if (value !== answer) {
      sounds.playFail();
      onAttempt?.("incorrect", { expected: answer, selected: value, details: { ...config } });
      return;
    }
    sounds.playWin();
    setSolved(true);
    onAttempt?.("correct", { expected: answer, selected: value, details: { ...config } });
    onSuccess?.();
  };

  // The hour hand advances with the minutes — half past two is genuinely half way to three.
  const hourAngle = ((config.hour % 12) + config.minute / 60) * 30;
  const minuteAngle = config.minute * 6;

  const hand = (angle: number, length: number, width: number, colour: string) => (
    <line
      x1="100" y1="100"
      x2={100 + length * Math.sin((angle * Math.PI) / 180)}
      y2={100 - length * Math.cos((angle * Math.PI) / 180)}
      stroke={colour} strokeWidth={width} strokeLinecap="round"
    />
  );

  const accent: CanvasAccent = "violet";

  return (
    <SharedCanvasLayout
      isPlayMode={isPlayMode}
      playHint={"What time is it? The short hand is the hour."}
      showGrid={showGrid}
      isDark={isDark}
      accent={accent}
      headerTitle="Clock"
      /*
        The question leads — and the old prominent line was the answer.

        `headerSubtitle` printed "half past 3" above a board asking a child what
        time it is. The one thing they were there to work out was written across
        the top of it, larger than anything else on the card, before they had
        looked at the hands. The chip below already reports the time once it is
        solved, which is where an answer belongs.
      */
      questionText={question.instruction?.trim() || "What time is it?"}
      readAloudText={"What time is it? The short hand is the hour."}
      /*
        The four moments. `picked !== null` without `solved` is a wrong guess —
        the same condition the footer uses to say "not quite".
      */
      guideRole={solved ? "celebrating" : picked !== null ? "oops" : "waiting"}
      {...guidePropsFor(question)}
      headerActions={
        <CanvasChip accent={solved ? "emerald" : accent} isDark={isDark}>
          {solved ? answer : config.minute === 30 ? "Half hour" : "O\u2019clock"}
        </CanvasChip>
      }
      footerStatus={solved ? `Spot on! It is ${answer}.` : picked !== null ? "Not quite \u2014 the short hand tells the hour, the long hand the minutes." : undefined}
      footerSolved={solved}
    >
      {/* Open stage — each element brings its own outline, and a frame around a frame
          misrepresents what a child sees. */}
      <div className="relative flex w-full flex-1 flex-col items-center justify-center gap-5 py-2">
        <svg viewBox="0 0 200 200" className="h-40 w-40 md:h-48 md:w-48" role="img" aria-label={`Clock showing ${answer}`}>
          <circle cx="100" cy="100" r="92" fill={isDark ? "#0f172a" : "#ffffff"}
                  stroke={isDark ? "#8b5cf6" : "#a78bfa"} strokeWidth="5" />
          {Array.from({ length: 12 }).map((_, index) => {
            const angle = (index + 1) * 30;
            const radians = (angle * Math.PI) / 180;
            return (
              <text
                key={index}
                x={100 + 72 * Math.sin(radians)}
                y={100 - 72 * Math.cos(radians) + 6}
                textAnchor="middle"
                className="font-mono"
                fontSize="16"
                fontWeight="800"
                fill={isDark ? "#cbd5e1" : "#475569"}
              >
                {index + 1}
              </text>
            );
          })}
          {hand(hourAngle, 44, 7, isDark ? "#c4b5fd" : "#6d28d9")}
          {hand(minuteAngle, 68, 5, isDark ? "#fca5a5" : "#dc2626")}
          <circle cx="100" cy="100" r="6" fill={isDark ? "#e2e8f0" : "#1e293b"} />
        </svg>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {choices.map(choice => {
            const isPicked = picked === choice;
            const isRight = solved && choice === answer;
            return (
              <button
                key={choice}
                type="button"
                disabled={!isPlayMode || solved}
                onClick={() => choose(choice)}
                className={`h-12 min-w-[74px] rounded-2xl border px-3 font-mono text-base font-black transition-all duration-200 disabled:cursor-default ${
                  isRight
                    ? "border-emerald-400 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                    : isPicked
                      ? "border-rose-400 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                      : isDark
                        ? "border-white/10 bg-white/5 text-slate-200 hover:scale-105 hover:border-violet-400/60"
                        : "border-slate-200/80 bg-white text-slate-700 shadow-sm hover:scale-105 hover:border-violet-400/60"
                }`}
              >
                {choice}
              </button>
            );
          })}
        </div>
      </div>
    </SharedCanvasLayout>
  );
};
