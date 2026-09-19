import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { themeSystem } from "../../lib/themeSystem";

/**
 * Koda, saying what to do next.
 *
 * The standard panel for help that *arrives* — offered because the app noticed
 * something, rather than opened because the learner pressed a button. That is
 * the whole distinction it exists to carry: `UIKidMessage` is how the app
 * answers, and every tone it has is a verdict on something already done. This
 * is how the app speaks while the question is still open and nothing has been
 * judged, so it is drawn as somebody speaking — an avatar, a bubble, and a tail
 * pointing at the work the words are about.
 *
 * Three rules it enforces, the way `UIKidMessage` enforces its own:
 *
 *  1. **One instruction at a time.** The message is the hero of the panel, and
 *     it is one thing to do next — not a list to be read and held in the head.
 *     Longer help pages rather than stacks; see `message` below.
 *  2. **A way out that is not a cross.** Putting help away is a thing a learner
 *     does on purpose. "Got it" is telling Koda they are fine; a cross in the
 *     corner is furniture, and a young child reads it as an error to clear.
 *  3. **Announced, not just drawn.** It appears without being asked for, so a
 *     screen reader has to hear about it — hence `role="status"`, and hence the
 *     page position being spoken rather than left to the counter.
 */

export interface UIGuideBubbleProps {
  /** Who is talking, in two or three words. */
  title?: string;
  /**
   * The instruction — or several, to page through with Back and Next.
   *
   * An array is not a list to render; it is pages. Help that runs past a
   * sentence or two is help a child stops reading, and the answer to that is
   * not a smaller font: it is one step on screen at a time, with a way back to
   * the one before. A single string, or an array of one, draws no pager at all.
   */
  message: string | string[];
  /** Which page is showing, 0-based, when the caller owns the position. */
  index?: number;
  /** Told when Back or Next is pressed. Required to control `index`. */
  onIndexChange?(index: number): void;
  /**
   * Change this to send the pager back to the first page.
   *
   * For help that follows what the learner is doing, the first page is a live
   * sentence — "touch the glowing one and say four" becomes "…and say five" as
   * they work — while the pages behind it are a fixed explanation. Resetting on
   * the words would then snap a child back to page one every time they tapped,
   * mid-read. So a caller in that position hands over the thing that really
   * means *this is different help now* — usually which rung of a ladder it is —
   * and the words stop being consulted.
   */
  resetKey?: string | number;
  /** The single way out. Omit `onAction` to draw no button. */
  actionLabel?: string;
  onAction?(): void;
  /** Koda's mark by default; a skill may lend its own. */
  icon?: React.ReactNode;
  /** Which way the tail points — at the work above, or the work below. */
  tail?: "down" | "up" | "none";
  /** Ties the panel to whatever opened it, for a screen reader. */
  id?: string;
}

export const UIGuideBubble: React.FC<UIGuideBubbleProps> = ({
  title = "Koda is helping",
  message,
  index,
  onIndexChange,
  resetKey,
  actionLabel = "Got it",
  onAction,
  icon,
  tail = "down",
  id,
}) => {
  const s = themeSystem.guideBubble;
  const pages = (Array.isArray(message) ? message : [message]).filter(Boolean);

  /*
   * The position, owned here unless the caller wants it.
   *
   * Uncontrolled is the common case by far — a panel that pages through three
   * sentences should not make every caller hold a number on its behalf. A
   * caller that does pass `index` gets every press reported and this steps
   * aside.
   */
  const [ownIndex, setOwnIndex] = useState(0);
  const controlled = typeof index === "number";
  const at = Math.min(Math.max(controlled ? index : ownIndex, 0), Math.max(pages.length - 1, 0));

  /*
   * New help starts at the first page.
   *
   * Without this, a panel paged to step three and then handed a different
   * instruction shows page three of the new one — which, for help that appears
   * by itself, means a child who asked for nothing is looking at the middle of
   * an explanation.
   *
   * The words are what "different help" means by default, compared rather than
   * identity-checked because callers build these arrays inline and a fresh
   * array of the same sentences is the same help. `resetKey` overrides that for
   * the live case described above.
   */
  const key = resetKey === undefined ? JSON.stringify(pages) : String(resetKey);
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    if (!controlled) setOwnIndex(0);
  }, [key, controlled]);

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), pages.length - 1);
    if (!controlled) setOwnIndex(clamped);
    onIndexChange?.(clamped);
  };

  if (pages.length === 0) return null;
  const paged = pages.length > 1;

  return (
    <div id={id} role="status" aria-live="polite" className={s.wrap}>
      <span className={s.avatar} aria-hidden="true">
        {icon ?? <Sparkles />}
      </span>

      <div className={s.body}>
        <span className={s.title}>{title}</span>
        <p className={s.message}>{pages[at]}</p>

        {(paged || (actionLabel && onAction)) && (
          <div className={s.footer}>
            {paged && (
              <>
                <button
                  type="button"
                  onClick={() => goTo(at - 1)}
                  disabled={at === 0}
                  className={s.page}
                >
                  <ChevronLeft aria-hidden="true" />
                  Back
                </button>
                {/*
                 * Disabled rather than hidden at the ends.
                 *
                 * A control that disappears moves the one beside it under a
                 * finger already on its way down — which on the last page would
                 * put "Got it" exactly where "Next" had been.
                 */}
                <button
                  type="button"
                  onClick={() => goTo(at + 1)}
                  disabled={at === pages.length - 1}
                  className={s.page}
                >
                  Next
                  <ChevronRight aria-hidden="true" />
                </button>
                <span className={s.count} aria-hidden="true">
                  {at + 1}/{pages.length}
                </span>
                {/* In words, because "2/3" is not what a screen reader should
                    read out and the counter beside it says nothing at all. */}
                <span className="sr-only">{`Step ${at + 1} of ${pages.length}`}</span>
              </>
            )}

            {actionLabel && onAction && (
              <button type="button" onClick={onAction} className={s.action}>
                {actionLabel}
              </button>
            )}
          </div>
        )}
      </div>

      {tail !== "none" && <span aria-hidden="true" className={s.tail(tail)} />}
    </div>
  );
};
