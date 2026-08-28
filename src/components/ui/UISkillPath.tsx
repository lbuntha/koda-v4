import React from "react";
import { Check, Lock, Star } from "lucide-react";
import { type PathNodeState, themeSystem } from "../../lib/themeSystem";

export interface UISkillPathItem {
  id: string;
  title: string;
  /** Emoji or icon shown on a node that is neither completed nor locked. */
  icon?: React.ReactNode;
  state: PathNodeState;
  /** Star count on a completed node. Omitted or 0 hides the badge. */
  stars?: number;
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
 * Nodes carry no visible label. At this size a title either wraps to three
 * lines or truncates to nothing useful, so the name travels as the accessible
 * name and the hover tooltip instead. Use `UIPathNode` where the lesson names
 * matter — that is the labelled version, for a full page.
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
      className={`flex flex-col items-center gap-5 sm:gap-6 ${
        hasStart ? "pt-16" : "pt-6"
      } ${className}`}
      role="list"
      aria-label="Lesson path"
    >
      {items.map((item, index) => {
        const locked = item.state === "locked";
        return (
          <div key={item.id} role="listitem" className={WAVE[index % WAVE.length]}>
            <button
              type="button"
              disabled={locked}
              onClick={() => onSelect(item.id)}
              title={item.title}
              aria-label={`${item.title}${locked ? " (locked)" : ""}`}
              className={s.circle(item.state)}
            >
              {item.state === "completed" ? (
                <Star className="w-8 h-8 sm:w-9 sm:h-9 fill-current" />
              ) : locked ? (
                <Lock className="w-6 h-6" />
              ) : item.icon ? (
                <span className="text-2xl sm:text-3xl">{item.icon}</span>
              ) : (
                <Check className="w-7 h-7" />
              )}

              {item.state === "completed" && (item.stars ?? 0) > 0 && (
                <span className={s.starBadge}>&#9733;{item.stars}</span>
              )}

              {item.state === "current" && (
                <span className={s.startBadge}>
                  {startLabel}
                  <span className={s.startTail} aria-hidden="true" />
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};
