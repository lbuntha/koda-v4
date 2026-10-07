/**
 * Writing and drawing, in the learning log.
 *
 * The same `LessonTracker` every skill and every book uses, so a tracing day
 * counts as a day practised, the server's per-concept totals and the parent
 * summary include writing, and nothing downstream needs to know Trace exists.
 * `TraceProgress` stays the ladder's own state (which step, check-ups due);
 * this is the history of how the child got there.
 *
 * The mapping:
 *
 * - **A lesson is one item, played until it ends** — "can write", a check-up
 *   passed, or "learned". Opened on the first counted attempt, so opening an
 *   item and closing it again records nothing.
 * - **A question is one try at a step**, closed when the try is scored.
 *   `correct` is whether it passed the step's bar; `given` names the mistake
 *   the child was shown (or the score when there was none), so error analysis
 *   reads "direction" rather than a number. The arithmetic error kinds do not
 *   fit strokes, so the kind is left to the tracker, which calls it `unknown`,
 *   as the Library does.
 * - **A stroke the guided steps turned away is a wrong answer on that try.**
 *   Those steps fade a wrong stroke and let the child redo it, so the try only
 *   ever finishes right; without this every guided try would read "right first
 *   time". The finished try follows as the next attempt at the same question.
 * - **Help** is taking the coach's suggestion: practising one stroke on its
 *   own, or watching it again.
 *
 * Not recorded: the Watch step (nothing to get right), Just draw (no scoring),
 * and the Studio's test runs. An item opened from no published collection — an
 * author trying their own draft — is recorded as `preview`, which advice ignores.
 */

import { LessonTracker, type SupportKind } from "../lib/learning";
import type { AgeRange } from "../lib/ages";
import { modeOf, type StepId, type TraceItem } from "./geometry/types";
import type { LadderEvent } from "./progress/ladder";

export const TRACE_SKILL_ID = "koda-trace";

/** Writing is mastered per script; drawing is one skill whatever is drawn. */
export const conceptFor = (item: Pick<TraceItem, "kind" | "script">): string =>
  modeOf(item.kind) === "drawing" ? "trace-draw" : item.script === "latin" ? "trace-write-latin" : "trace-write-khmer";

/**
 * What a parent reads for each trace concept — as `LIBRARY_CONCEPT_NAMES` does
 * for books, since Trace is a module and not a skill with lessons to name them.
 */
export const TRACE_CONCEPT_NAMES: Readonly<Record<string, { lesson: string; skill: string }>> = {
  "trace-write-khmer": { lesson: "Writing Khmer letters and numbers", skill: "Koda Trace" },
  "trace-write-latin": { lesson: "Writing English letters and numbers", skill: "Koda Trace" },
  "trace-draw": { lesson: "Drawing lines and pictures", skill: "Koda Trace" },
};

/**
 * Whether a concept is writing, measured letter by letter on the trace ladder.
 * As one concept it is too coarse for "mastered"; the server keeps the same
 * rule (`mastery.is_ladder_concept`), so the report and the messages agree.
 */
export const isLadderConcept = (conceptKey: string): boolean => conceptKey.startsWith("trace-");

/** The ladder moments that end an item — what a parent hears about. */
export type TraceMilestone = Extract<LadderEvent, "canDo" | "rechecked" | "learned">;

export class TraceRecorder {
  private tracker: LessonTracker;
  private open = false;
  private n = 0;
  /** The try in progress: its id, and the step it is at. */
  private question: { id: string; step: StepId } | null = null;

  constructor(
    private item: TraceItem,
    private options: { collectionId?: string; ages?: AgeRange | null } = {},
  ) {
    this.tracker = new LessonTracker({
      skillId: TRACE_SKILL_ID,
      activityId: modeOf(item.kind),
      lessonId: item.id,
      conceptKey: conceptFor(item),
      ageBand: options.ages ? [options.ages[0], options.ages[1]] : undefined,
      practice: false,
    });
  }

  private ensureOpen() {
    if (this.open) return;
    this.open = true;
    this.n = 0;
    this.question = null;
    this.tracker.startLesson(this.options.collectionId ? "picker" : "preview");
  }

  /** The try at `step`, put on screen if it is not already. */
  private questionAt(step: StepId): string {
    this.ensureOpen();
    if (this.question?.step === step) return this.question.id;
    const id = `${this.item.id}:${step}:${this.n}`;
    this.tracker.present({ questionId: id, index: this.n++, taskKind: `trace_${step}`, prompt: this.item.title });
    this.question = { id, step };
    return id;
  }

  /** A stroke turned away mid-try in a guided step — the child redoes it. */
  strokeMissed(step: StepId, fault: string) {
    if (step === "watch") return;
    this.tracker.answered({ questionId: this.questionAt(step), correct: false, given: fault });
  }

  /** A try at `step` scored: passed its bar or not, and the mistake shown, if any. Closes the try. */
  attempt(step: StepId, a: { passed: boolean; score: number; fault?: string }) {
    if (step === "watch") return;
    const questionId = this.questionAt(step);
    this.tracker.answered({ questionId, correct: a.passed, given: a.passed ? String(a.score) : (a.fault ?? String(a.score)) });
    this.question = null;
  }

  /** The coach's suggestion was taken: one stroke on its own, or a stroke watched again. */
  support(kind: Extract<SupportKind, "walkthrough" | "reveal">) {
    if (this.open) this.tracker.supportUsed(kind);
  }

  /** The item ended on a milestone. A child who carries on afterwards starts a new lesson. */
  complete(milestone: TraceMilestone, stars: number, xpEarned: number) {
    if (!this.open) return;
    this.tracker.completeLesson({ stars, xpEarned, milestone });
    this.open = false;
    this.question = null;
  }

  /** Left before a milestone. A no-op when nothing was attempted. */
  abandon() {
    if (!this.open) return;
    this.tracker.abandonLesson();
    this.open = false;
    this.question = null;
  }
}
