import React from "react";
import { resolveLessonIcon, resolveLessonIconTone } from "./lessonIcons";

export interface UILessonIconProps {
  /** `iconName` from the lesson's metadata. */
  name?: string;
  /** `iconTone` from the lesson's metadata. */
  tone?: string;
  /** `framed` is the tinted tile used in lists and pickers; `bare` is inline. */
  variant?: "framed" | "bare";
  size?: "sm" | "md";
}

/**
 * A lesson's icon, rendered the same way everywhere it appears.
 *
 * Both the level picker and the Skill Manager show the same lessons, so they
 * must show the same icon — this component and the lesson's own metadata are
 * what make that true.
 */
export const UILessonIcon: React.FC<UILessonIconProps> = ({
  name,
  tone,
  variant = "framed",
  size = "md",
}) => {
  const Icon = resolveLessonIcon(name);
  const glyph = size === "sm" ? "w-4 h-4" : "w-5 h-5";
  const icon = <Icon className={`${glyph} ${resolveLessonIconTone(tone)} shrink-0`} />;

  if (variant === "bare") return icon;

  return (
    <span
      className={`${
        size === "sm" ? "w-8 h-8 rounded-xl" : "w-10 h-10 rounded-2xl"
      } bg-surface-muted border border-line/80 flex items-center justify-center shrink-0`}
    >
      {icon}
    </span>
  );
};
