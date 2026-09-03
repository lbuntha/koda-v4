import React, { useMemo, useState } from "react";
import { Printer, RefreshCw } from "lucide-react";

import type { ResolvedLesson } from "../curriculum";
import {
  DEFAULT_WORKSHEET_SIZE,
  WORKSHEET_SIZES,
  buildWorksheet,
  canPrint,
  type Worksheet,
} from "../lib/worksheet";
import { themeSystem } from "../lib/themeSystem";
import { PrintPreview, UIPaper, UIPaperBreak, UIPaperNote, printPaper } from "./print/UIPaper";
import { UIButton, UIModal } from "./ui";

/**
 * A lesson, printed.
 *
 * A parent asks for this when the tablet is not the answer: a car journey, a
 * grandparent's house, a teacher who wants the class working on paper. It is the
 * same questions the round would have asked — see `lib/worksheet.ts` — laid out
 * for a pencil, with the answers on a page of their own that the grown-up can
 * keep back.
 *
 * The paper itself is `components/print/UIPaper` — shared, because a worksheet
 * is the first thing this app prints and will not be the last. This file owns
 * only what is particular to a worksheet: the picker above the sheet, and the
 * numbered questions and key on it.
 */

export interface WorksheetDialogProps {
  /** The lessons to offer, in course order. Unprintable ones are filtered out. */
  lessons: ResolvedLesson[];
  /** Where to start — usually the lesson the learner is on. */
  initial?: ResolvedLesson;
  onClose(): void;
}

/**
 * A worksheet, on the shared paper.
 *
 * Everything that is *paper* — the heading, the name and date rules, the page
 * break before the key, the fact that it is black on white in both themes —
 * belongs to `UIPaper` and is reused by whatever prints next. What is left here
 * is the only part that is a worksheet: numbered questions with a line to
 * answer on, and a key laid out to be read at a glance rather than worked
 * through.
 */
const Sheet: React.FC<{ sheet: Worksheet; withKey: boolean; withMethod: boolean }> = ({
  sheet,
  withKey,
  withMethod,
}) => (
  <UIPaper
    eyebrow={sheet.skillName}
    title={sheet.lessonTitle}
    subtitle={sheet.instruction}
    blanks={["Name", "Date"]}
  >
    {/*
      * What the sheet teaches, before it asks anything.
      *
      * A worksheet that opens with question 1 is a test. This one opens with
      * the method and one problem already worked, so a child who has not met
      * the technique — or has met it and forgotten — has somewhere to look
      * other than the person sitting next to them.
      */}
    {withMethod && (sheet.method.length > 0 || sheet.example) && (
      <UIPaperNote title="How it works" className="mb-5">
        {sheet.method.length > 0 && (
          <ol className="list-decimal space-y-0.5 pl-4">
            {sheet.method.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        )}
        {sheet.example && (
          <div className={sheet.method.length > 0 ? "mt-2" : ""}>
            <span className="font-black">Example: </span>
            {sheet.example.prompt}{" "}
            <span className="font-black">
              {sheet.example.answer.split(",").join(", ")}
            </span>
            {sheet.example.figure && <div className="mt-1.5">{sheet.example.figure}</div>}
          </div>
        )}
      </UIPaperNote>
    )}

    {/* A sheet whose questions carry a frame or a number line needs more air
        between them than a column of sums does — without it the figure of one
        question reads as belonging to the next. */}
    <ol className={sheet.items.some((i) => i.figure) ? "space-y-6" : "space-y-3.5"}>
      {sheet.items.map((item) => (
        <li key={item.number} className="flex items-start gap-3">
          <span className="w-6 shrink-0 pt-1.5 text-right text-sm font-bold tabular-nums text-slate-500">
            {item.number}.
          </span>
          <span className="min-w-0 flex-1 pt-1.5 text-[15px] leading-snug">
            {item.prompt}
            {/* The apparatus, where the technique has one. Under the question
                rather than beside it: a frame or a number line needs the width,
                and a child works down the page. */}
            {item.figure && <span className="mt-2 block">{item.figure}</span>}
          </span>
          {/* Ruled, not a box: an answer here can be a number, a pair of them,
              or a sentence, and a 40px square would be a lie about which. */}
          <span className="h-8 w-24 shrink-0 self-start rounded border-b-2 border-slate-400" />
        </li>
      ))}
    </ol>

    {withKey && (
      <UIPaperBreak className="mt-8 border-t-2 border-dashed border-slate-300 pt-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">Answers</h2>
        <ol className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
          {sheet.items.map((item) => (
            <li key={item.number} className="text-sm tabular-nums">
              <span className="font-bold text-slate-500">{item.number}.</span>{" "}
              {/* A question with several answers stores them comma-joined —
                  a fact family is four numbers. Spaced here rather than in the
                  builder, which keeps `answer` exactly what the round marks
                  against. */}
              {item.answer ? item.answer.split(",").join(", ") : "—"}
            </li>
          ))}
        </ol>
      </UIPaperBreak>
    )}
  </UIPaper>
);

export const WorksheetDialog: React.FC<WorksheetDialogProps> = ({ lessons, initial, onClose }) => {
  const printable = useMemo(() => lessons.filter(canPrint), [lessons]);
  const [ref, setRef] = useState<string>(
    () => (initial && canPrint(initial) ? initial.ref : printable[0]?.ref) ?? "",
  );
  const [count, setCount] = useState<number>(DEFAULT_WORKSHEET_SIZE);
  const [withKey, setWithKey] = useState(true);
  const [withMethod, setWithMethod] = useState(true);
  /* Bumped by "New questions". The generator is random, so the seed is simply
     "how many times have you asked" — there is nothing to seed but a re-run. */
  const [draw, setDraw] = useState(0);

  const lesson = printable.find((l) => l.ref === ref);
  const sheet = useMemo(
    () => (lesson ? buildWorksheet(lesson, count) : undefined),
    // `draw` is the point of the dependency, not an accident of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson?.ref, count, draw],
  );

  return (
    <UIModal
      isOpen
      onClose={onClose}
      title="Print a worksheet"
      maxWidth="max-w-3xl"
      footer={
        <>
          <UIButton variant="secondary" onClick={onClose}>
            Close
          </UIButton>
          <UIButton
            variant="secondary"
            icon={<RefreshCw />}
            disabled={!sheet?.items.length}
            onClick={() => setDraw((n) => n + 1)}
          >
            New questions
          </UIButton>
          <UIButton
            variant="primary"
            icon={<Printer />}
            disabled={!sheet?.items.length}
            onClick={printPaper}
          >
            Print
          </UIButton>
        </>
      }
    >
      {printable.length === 0 ? (
        <p className="text-sm text-muted">
          None of this skill&rsquo;s lessons can be printed yet. Its questions are things to
          touch, drag and count on screen — on paper they would be a caption and an empty box.
        </p>
      ) : (
        <div className="space-y-4">
          {/* Everything above the sheet is the app, not the paper, so it is
              marked for the print stylesheet to drop. */}
          <div data-print-hide className="space-y-3">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-widest text-muted">Lesson</span>
              <select
                value={ref}
                onChange={(e) => setRef(e.target.value)}
                className={themeSystem.field("sm", "mt-1 w-full")}
              >
                {printable.map((l) => (
                  <option key={l.ref} value={l.ref}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Questions
                </span>
                {WORKSHEET_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setCount(size)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black border-2 transition ${
                      count === size
                        ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/40"
                        : "bg-surface text-muted border-line"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={withMethod}
                  onChange={(e) => setWithMethod(e.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                How it works
              </label>

              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={withKey}
                  onChange={(e) => setWithKey(e.target.checked)}
                  className="h-4 w-4 accent-indigo-600"
                />
                Answer key
              </label>
            </div>

            {sheet && sheet.items.length < count && (
              /* Honest rather than silent: some lessons have fewer distinct
                 questions than a long sheet asks for — "add zero" over ten
                 numbers cannot fill thirty rows without repeating. */
              <p className={themeSystem.flash("info", "text-sm")}>
                This lesson has {sheet.items.length}{" "}
                {sheet.items.length === 1 ? "question" : "different questions"} to give. The
                sheet has {sheet.items.length === 1 ? "it" : "all of them"}.
              </p>
            )}
          </div>

          {sheet && (
            <PrintPreview>
              <Sheet sheet={sheet} withKey={withKey} withMethod={withMethod} />
            </PrintPreview>
          )}
        </div>
      )}
    </UIModal>
  );
};
