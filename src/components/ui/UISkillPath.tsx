import React from "react";
import { Check, Lock, Star } from "lucide-react";
import { type PathNodeState, themeSystem } from "../../lib/themeSystem";

export interface UISkillPathItem {
  id: string;
  title: string;
  /** Emoji or icon for the lesson. Shown on every node that is not locked. */
  icon?: React.ReactNode;
  state: PathNodeState;
  /** Star count on a completed node. Omitted or 0 falls back to a tick. */
  stars?: number;
  /** The course tier is separate from whether this account can open it. */
  tier?: "free" | "premium";
}

export interface UISkillPathProps {
  items: UISkillPathItem[];
  /** Labels the current node. Defaults to "Start". */
  startLabel?: string;
  onSelect(id: string): void;
  className?: string;
}

/**
 * The learning path as a winding column of stepping stones, centred on its
 * container — the shape a child already recognises from Duolingo.
 *
 * There is deliberately no connecting line. A line has to be drawn straight
 * while the nodes wander off-axis, so it never lines up with them; the wave
 * itself carries the sense of a route, which is how the apps that do this well
 * handle it.
 *
 * Each node keeps its lesson's emoji at every state, and names itself
 * underneath. An earlier version dropped both once a lesson was finished, which
 * turned a completed unit into a column of identical purple discs: nothing on
 * screen said which one was the dice game and which one was the ten-frame, and
 * the only way to find out was to hover — a gesture that does not exist on the
 * tablet this is mostly read on. The label is clamped to two lines and the
 * column is narrow, so the wave still reads as a path rather than a list.
 */

/*
 * One full wave of horizontal offset, as utilities so the amplitude can shrink
 * on a phone — 32px off-centre either way there, 48px from `sm` up.
 *
 * The period is four, and that matters more than it looks. An eight-step sine
 * spends its first half on the left, so a unit of three or four lessons never
 * reaches the right-hand half at all and the whole path sits visibly off to one
 * side. Centre-left-centre-right balances at every length a unit actually has.
 */
const WAVE = [
  "translate-x-0",
  "-translate-x-8 sm:-translate-x-12",
  "translate-x-0",
  "translate-x-8 sm:translate-x-12",
];

export const UISkillPath: React.FC<UISkillPathProps> = ({
  items,
  startLabel = "Start",
  onSelect,
  className = "",
}) => {
  const s = themeSystem.pathNode;
  /*
   * `pt-16` is not decoration: the Start bubble floats above the current node,
   * and without the reserved room it collides with whatever sits over the path.
   * It travels with this component so no caller has to know — but only a path
   * that *has* a current node needs it. Reserving it unconditionally left a
   * band of dead space above every other unit in a list of them.
   */
  const hasStart = items.some((item) => item.state === "current");

  return (
    <div
      className={`flex flex-col items-center gap-4 sm:gap-5 ${
        hasStart ? "pt-16" : "pt-6"
      } ${className}`}
      role="list"
      aria-label="Lesson path"
    >
      {items.map((item, index) => {
        const locked = item.state === "locked";
        /* Locked by a plan rather than by the path. It still presses — the tap
           is what explains it — so only the prerequisite lock is `disabled`. */
        const premium = item.state === "premium";
        const stars = item.stars ?? 0;
        const tierLabel =
          item.tier === "premium" ? "Premium" : item.tier === "free" ? "Free" : null;
        return (
          <div
            key={item.id}
            role="listitem"
            className={`flex flex-col items-center gap-1.5 ${WAVE[index % WAVE.length]}`}
          >
            <button
              type="button"
              disabled={locked}
              onClick={() => onSelect(item.id)}
              title={item.title}
              aria-label={`${item.title}${tierLabel ? ` (${tierLabel})` : ""}${locked ? " (locked)" : premium ? " (subscription required)" : ""}`}
              className={s.circle(item.state)}
            >
              {locked || premium ? (
                <Lock className="w-6 h-6" />
              ) : item.icon ? (
                <span className="text-2xl sm:text-3xl">{item.icon}</span>
              ) : item.state === "completed" ? (
                <Star className="w-8 h-8 sm:w-9 sm:h-9 fill-current" />
              ) : (
                <Check className="w-7 h-7" />
              )}

              {/* A finished lesson always says so, whether or not it earned a
                  star: the fill alone is the only other difference between
                  "done" and "open", and colour on its own is not a signal. */}
              {item.state === "completed" && (
                <span className={s.starBadge}>
                  {stars > 0 ? <>&#9733;{stars}</> : <>&#10003;</>}
                </span>
              )}

              {item.state === "current" && (
                <span className={s.startBadge}>
                  {startLabel}
                  <span className={s.startTail} aria-hidden="true" />
                </span>
              )}
            </button>

            <span className={s.pathLabel(item.state)}>{item.title}</span>
            {tierLabel && (
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wide ${
                  item.tier === "premium"
                    ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                }`}
              >
                {tierLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
