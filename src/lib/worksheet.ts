import type React from "react";

import type { ResolvedLesson } from "../curriculum";
import { getSkill } from "../skills/registry";
import type { WorksheetSource } from "../skills/types";

/**
 * A lesson, on paper.
 *
 * The questions are the round's own: a worksheet asks an activity for the same
 * questions it would have asked on screen, at the lesson's own number ranges and
 * in the lesson's own words. Nothing here writes maths. That matters more than it
 * looks — a printer with its own generator would drift from the lesson the week
 * after somebody changed a range, and the sheet would quietly stop being practice
 * for the thing it is named after.
 *
 * What it cannot do is print the *screen*. An engine whose question is a picture
 * — objects to touch, a line to hop along, a frame to fill — has nothing to put
 * on paper but the caption, and "Touch every fish" beside an empty box is not a
 * worksheet. So printing is opt-in per activity (`WorksheetSource`), and a lesson
 * whose activity has not opted in reports that it cannot be printed rather than
 * printing something useless. Addition's twelve engines are written questions
 * already and all opt in; counting's five are pictures and do not, until somebody
 * draws them for paper.
 */

export interface WorksheetItem {
  /** 1-based, as printed. */
  number: number;
  /** The question, in the lesson's own wording. */
  prompt: string;
  /** What goes in the box. Empty when the engine could not say. */
  answer: string;
  /**
   * The technique's apparatus for this question, drawn for paper.
   *
   * A frame with its counters, a number line, a column with a carry box. Absent
   * where the question is complete in words. See `figure` on `WorksheetSource`.
   */
  figure?: React.ReactNode;
}

export interface Worksheet {
  skillName: string;
  lessonTitle: string;
  /** The lesson's own instruction, as the round says it when a question opens. */
  instruction?: string;
  /**
   * How the technique goes, in the lesson's own words.
   *
   * The lesson already carries this — every one declares a `stepByStep` for the
   * help panel — so a teaching sheet needs no new writing, only the steps that
   * survive leaving the screen. See `methodFor`.
   */
  method: string[];
  /**
   * One question with its answer shown, before the child is asked any.
   *
   * A method in the abstract teaches nobody: "add the ones column first" means
   * something once it has been done to 38 + 24 in front of you. Drawn from the
   * same generator as the questions, so the example is the same kind of problem
   * and not a simpler one chosen to look good.
   */
  example?: WorksheetItem;
  items: WorksheetItem[];
}

/** How many questions a sheet offers, and what it starts on. */
export const WORKSHEET_SIZES = [10, 15, 20, 30] as const;
export const DEFAULT_WORKSHEET_SIZE = 15;

/**
 * The fewest distinct questions worth printing.
 *
 * A lesson whose printed line does not change is a lesson whose question is not
 * in the line. "Count them all. How many altogether?" is the same sentence every
 * time because the question is the objects beside it, and those are on the
 * screen — so a sheet of it is one instruction repeated fifteen times with
 * nothing to count. Six addition lessons are like that, and the engine cannot
 * know: it declares that it *can* print, and this decides whether this
 * particular lesson is worth printing.
 */
export const MIN_WORKSHEET_ITEMS = 5;

/**
 * The steps a lesson teaches, as paper can say them.
 *
 * `stepByStep` is written for the help panel inside a round, so some of it is
 * instructions to a pair of hands on a screen — "Tap empty spaces to add
 * counters", "Read the story, or tap the speaker to hear it". Those steps
 * describe the app rather than the technique, and on paper they are at best
 * confusing and at worst impossible to follow. Fourteen lessons have one.
 *
 * Dropped rather than rewritten: what is left is still the method, and a step
 * that only existed to explain a control loses nothing by going. Rewriting them
 * would mean a second copy of every lesson's teaching, which is the thing that
 * drifts.
 */
const SCREEN_STEP = /\b(tap|tapping|drag|dragging|touch|press|swipe|screen|speaker|button)\b/i;

export const methodFor = (lesson: ResolvedLesson): string[] => {
  const steps = ((lesson.params?.play as { stepByStep?: string[] } | undefined)?.stepByStep) ?? [];
  return steps.filter((step) => !SCREEN_STEP.test(step));
};

/**
 * A question by its content, so two draws that produced the same one are one.
 *
 * `id` is dropped because it is a timestamp: every question has a different one
 * and keying on it would find no repeats at all, which is precisely the bug
 * this is here to fix.
 */
const contentKey = (question: unknown): string => {
  const { id: _id, ...rest } = (question ?? {}) as Record<string, unknown>;
  try {
    return JSON.stringify(rest);
  } catch {
    /* A question holding something circular. Treated as unique, which errs
       towards a repeated question rather than a short page. */
    return String(Math.random());
  }
};

/** The activity behind a lesson, if the registry still has it. */
const sourceFor = (lesson: ResolvedLesson): WorksheetSource | undefined => {
  const [skillId, activityId] = (lesson.activity ?? "").split("/");
  return getSkill(skillId)?.activities[activityId]?.worksheet;
};

/**
 * Whether this lesson is worth printing. What the Print button asks.
 *
 * Two questions in one: can the activity print at all, and does *this* lesson
 * give distinguishable questions when it does. The second is answered by
 * building a short sheet and counting what came back, because there is no way
 * to know from the lesson's own JSON — the prompt template looks perfectly
 * healthy right up until every filled copy of it is identical.
 */
export const canPrint = (lesson: ResolvedLesson): boolean =>
  sourceFor(lesson) !== undefined &&
  buildWorksheet(lesson, MIN_WORKSHEET_ITEMS).items.length >= MIN_WORKSHEET_ITEMS;

/**
 * Build a sheet of `count` questions from a lesson.
 *
 * The `seen` set and the memory ref are the round's own de-duplication, handed
 * the whole sheet rather than one round: twenty questions asked five at a time
 * would repeat across the groups, and a page with 6 + 7 on it three times is
 * the thing that makes a child put the pencil down.
 *
 * That is not enough on its own, and the second guard is the one that matters
 * here. An engine asked for more questions than its lesson can distinguish
 * gives up and repeats — `withoutRepeat` tries a fixed number of times and then
 * hands back whatever it has, which is right in a round of five and wrong on a
 * page of thirty. "Adding zero" over ten numbers has twenty questions in it; a
 * sheet asking for thirty got ten of them twice. So the sheet also de-duplicates
 * on the printed line, which is the thing a child actually sees repeated, and
 * stops when the lesson runs out rather than padding.
 *
 * A generator that throws is skipped rather than fatal. Every engine refuses a
 * draw it cannot satisfy — that is how a lesson's constraints are enforced — and
 * a page one question short is a better answer than a dialog with an error in it.
 */
export function buildWorksheet(lesson: ResolvedLesson, count: number): Worksheet {
  const source = sourceFor(lesson);
  const [skillId] = (lesson.activity ?? "").split("/");
  const play = (lesson.params?.play ?? {}) as { audioPrompt?: string; prompts?: { default?: string } };

  const items: WorksheetItem[] = [];
  /* The technique's own method, taken from the first question drawn — every
     question in a sheet is the same technique, so any of them answers for the
     lesson. Falls back to whatever of the lesson's own steps do not describe
     the screen. */
  let method: string[] | null = null;
  if (source) {
    const params = (lesson.params?.question ?? {}) as Record<string, unknown>;
    const seen = new Set<string>();
    const seenText = new Set<string>();
    const memory: { current: unknown } = { current: null };

    /* Several times the asked-for count, because both guards reject draws: the
       budget is what turns "this lesson has run out" into a short page instead
       of a hung loop. Generous enough that a lesson with the questions to fill
       a sheet always does. */
    /* One more than asked for. The first is spent on the worked example, so
       the sheet still offers `count` questions and never asks the one it has
       already answered in front of them. */
    const wanted = count + 1;
    for (let i = 0; items.length < wanted && i < wanted * 8; i += 1) {
      try {
        const question = source.build(params, i, seen, memory);

        /*
         * The engine's paper form where it has one, the round's prompt where it
         * has not.
         *
         * `null` from `printed` means this question cannot be written down —
         * its subject is a picture — so it is skipped rather than printed as a
         * caption. A lesson made entirely of those runs out immediately, which
         * is what keeps it out of the printer.
         */
        const paper = source.printed?.(question) ?? null;
        if (source.printed && !paper) continue;
        method ??= source.method?.(question) ?? null;

        const prompt = paper?.text ?? source.prompt(question, play.prompts?.default);
        const figure = source.figure?.(question) ?? undefined;

        /*
         * The wording is only the question where there is no picture.
         *
         * "How many fish are there?" reads the same above five fish and above
         * eight, and "Count both groups. Which has more?" is the same sentence
         * every time — the difference is the drawing beside it. De-duplicating
         * on the text threw those away and left counting looking unprintable,
         * when in fact it was producing perfectly good questions that happened
         * to share a caption. So where a figure carries the question, what is
         * compared is the question itself.
         *
         * Not the engine's own `seen` set, which would be the obvious answer:
         * counting's generators take `(setup, index)` and ignore it entirely,
         * so they de-duplicate nothing and a sheet came out asking "the frame
         * holds 2" twice.
         */
        const key = figure ? contentKey(question) : prompt;
        if (seenText.has(key)) continue;
        seenText.add(key);
        items.push({
          number: items.length + 1,
          prompt,
          answer: paper?.answer ?? question.expected ?? "",
          figure,
        });
      } catch {
        /* A draw the lesson's own constraints refused. Try the next one. */
      }
    }
  }

  const [example, ...questions] = items;

  return {
    skillName: getSkill(skillId)?.manifest.name ?? skillId,
    lessonTitle: lesson.title,
    instruction: play.audioPrompt,
    method: method ?? methodFor(lesson),
    /* Only where the lesson had one to spare. A lesson with exactly enough
       questions to fill the page keeps them all and simply shows no example —
       spending a question on teaching is not worth printing a shorter sheet. */
    example: questions.length > 0 ? example : undefined,
    items: (questions.length > 0 ? questions : items).map((item, i) => ({
      ...item,
      number: i + 1,
    })),
  };
}
