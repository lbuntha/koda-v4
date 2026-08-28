import React, { useMemo, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import { getSkill, resolveActivity } from "../registry";
import { createKodaSDK, type KodaHost } from "../sdk/createKodaSDK";
import type { ActivityLesson, LearnerSnapshot, SkillResult } from "../types";
import type { LearningContext, LessonEntry } from "../../lib/learning/events";
import { getLessonByLevel } from "../../curriculum";
import { buildCatalog } from "../catalog";
import { recommendNext } from "../../lib/learning/recommend";
import { useAudienceViewer } from "../viewer";
import { ActivityErrorBoundary } from "../kit/chrome/ActivityErrorBoundary";

export interface SkillHostProps {
  /** Activity reference, "skillId/activityId". */
  activityRef: string;
  /** Lesson-supplied configuration, merged over the activity's defaults. */
  params?: Record<string, unknown>;
  level?: number;
  snapshot: LearnerSnapshot;
  onAwardXp(amount: number): void;
  onComplete(result: SkillResult): void;
  onExit(): void;
  /**
   * Which lesson is being run, for the learning log.
   *
   * Supplied by the host rather than the skill: a skill naming its own lesson
   * could mislabel the concept its data lands under, and mastery is shared
   * across skills. Omit it and telemetry is off for this mount — which is how
   * the teacher preview stays out of a child's record.
   */
  lesson?: {
    lessonId: string;
    conceptKey: string;
    standards?: string[];
    ageBand?: [number, number];
    /** Display only — passed through to the activity for its chrome. */
    title?: string;
    concept?: string;
  };
  /** How the learner got here. `"preview"` also disables telemetry. */
  entry?: LessonEntry;
}

/**
 * Mounts one activity with its SDK bound.
 *
 * This is the piece the skill system was missing: `InstalledSkill` could
 * describe a skill but nothing could run one, so counting had to be hardwired
 * into App.tsx.
 */
export const SkillHost: React.FC<SkillHostProps> = ({
  activityRef,
  params,
  level = 1,
  snapshot,
  onAwardXp,
  onComplete,
  onExit,
  lesson,
  entry = "path",
}) => {
  const { theme } = useTheme();
  const viewer = useAudienceViewer();
  const activity = resolveActivity(activityRef);

  /**
   * The host's callbacks, read through a ref.
   *
   * Callers write these as inline arrows, so their identity changes on every
   * render of the parent. Depending on them directly rebuilt the SDK — and with
   * it the lesson tracker — mid-round, which silently dropped the round's
   * `lesson_completed`. Reading through a ref means the SDK is bound once per
   * activity and always calls the current handlers.
   */
  const hostRef = useRef({ onAwardXp, onComplete, onExit, snapshot, viewer });
  hostRef.current = { onAwardXp, onComplete, onExit, snapshot, viewer };

  const koda = useMemo(() => {
    const skillId = activityRef.split("/")[0] ?? "unknown";
    const host: KodaHost = {
      awardXp: (amount) => hostRef.current.onAwardXp(amount),
      completeSkill: (result) => hostRef.current.onComplete(result),
      getSnapshot: () => hostRef.current.snapshot,
      theme,
      exit: () => hostRef.current.onExit(),
      // The course, not the skill, decides what a level means. Telemetry is off
      // for previews, so this resolver is not consulted there either.
      // Built fresh per call so a skill enabled or a lesson unlocked between
      // rounds is reflected immediately.
      recommendNext: (finished) =>
        recommendNext(
          { ...finished, ref: `${finished.skillId}/${finished.lessonId}` },
          buildCatalog(hostRef.current.viewer),
        ),
      lessonForLevel: (n: number) => {
        const found = getLessonByLevel(n, hostRef.current.viewer);
        if (!found?.conceptKey) return undefined;
        return {
          lessonId: found.id,
          conceptKey: found.conceptKey,
          levelNumber: n,
          standards: found.standards,
          ageBand: found.ageBand,
        };
      },
    };
    const owner = getSkill(skillId);

    const learningContext: LearningContext | undefined =
      lesson && entry !== "preview"
        ? {
            skillId,
            activityId: activityRef.split("/")[1] ?? "unknown",
            lessonId: lesson.lessonId,
            conceptKey: lesson.conceptKey,
            levelNumber: level,
            standards: lesson.standards,
            ageBand: lesson.ageBand,
          }
        : undefined;

    return createKodaSDK(
      skillId,
      host,
      { features: owner?.features ?? [], settings: owner?.settings ?? {} },
      learningContext,
    );
    // `snapshot` is read through a getter, so it does not need to re-bind the SDK.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Deliberately keyed on values, not object identity: everything mutable is
    // read through `hostRef`, so this must rebind only when the activity or the
    // lesson it is running actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityRef, theme, entry, level, lesson?.lessonId, lesson?.conceptKey]);

  if (!activity) {
    // Visible rather than silent: a bad reference is a config bug worth seeing.
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <p className="font-mono font-black text-slate-900 dark:text-white">Activity not found</p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Nothing is registered for <code className="font-mono">{activityRef}</code>. Check the
            skill registry.
          </p>
        </div>
      </div>
    );
  }

  const Component = activity.component as React.ComponentType<{
    params: unknown;
    level: number;
    koda: typeof koda;
    onComplete(result: SkillResult): void;
    lesson?: ActivityLesson;
  }>;

  /*
   * Every activity runs inside a boundary.
   *
   * Here rather than in each activity, for the same reason the round loop lives
   * in the kit: a skill that forgot would take the whole app down with it, and
   * the failure would look like the app breaking rather than one lesson doing
   * so. Keyed on the activity so leaving a crashed lesson and opening another
   * starts clean instead of inheriting the last one's error.
   */
  return (
    <ActivityErrorBoundary key={activityRef} activityRef={activityRef} onExit={onExit}>
      <Component
        params={{ ...(activity.defaultParams as object), ...(params ?? {}) }}
        level={level}
        koda={koda}
        onComplete={onComplete}
        lesson={
          lesson && {
            id: lesson.lessonId,
            // The id is a poor title, but a visibly wrong one beats a blank bar.
            title: lesson.title ?? lesson.lessonId,
            concept: lesson.concept,
            levelNumber: level,
          }
        }
      />
    </ActivityErrorBoundary>
  );
};
