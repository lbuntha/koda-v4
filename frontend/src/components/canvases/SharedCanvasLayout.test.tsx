/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * The header, at the width it actually got.
 *
 * `compact` is a prop, and no host ever passed one — so every canvas ran the
 * wide header at every width, and on a phone the one line telling a child what
 * to do was squeezed to "0 coun…" between the read-aloud button and the status
 * chip. The layout measures itself now, which is also the more truthful signal:
 * the same canvas is full-bleed in a launcher and in a narrow studio column on
 * the very same screen, so the window's width was never the constraint.
 *
 * jsdom lays nothing out, so `ResizeObserver` is driven by hand here. That is
 * the whole mechanism under test — a real browser supplies the numbers, and
 * these check what the layout does with them.
 */

import React from "react";
import { render, act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { SharedCanvasLayout } from "./SharedCanvasLayout";
import { CanvasAudienceProvider } from "./presentation";

type Trigger = (width: number) => void;
let triggers: Trigger[] = [];

/**
 * A speech synthesiser that never makes a sound.
 *
 * jsdom has none at all, and the read-aloud button hides itself when speech is
 * unsupported — so without this the button is not in the document and the guide
 * it summons can never be tested. Utterances are captured rather than played,
 * and the test fires `onstart` / `onend` by hand, which is the only part the
 * layout actually reacts to.
 */
let utterances: any[] = [];

const installSpeech = () => {
  utterances = [];
  class FakeUtterance {
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    voice: unknown = null;
    rate = 1;
    pitch = 1;
    volume = 1;
    lang = "en-US";
    constructor(public text: string) {}
  }
  (globalThis as any).SpeechSynthesisUtterance = FakeUtterance;
  (globalThis as any).speechSynthesis = {
    cancel: () => {},
    getVoices: () => [],
    speak: (utterance: any) => utterances.push(utterance),
  };
};

/** Press Listen, then let the synthesiser report that it has started. */
const speak = () => {
  act(() => {
    fireEvent.click(screen.getByTitle(/Listen to question/i));
  });
  act(() => {
    utterances.at(-1)?.onstart?.();
  });
};

/** The voice reaching the end of the sentence. */
const finishSpeaking = () => {
  act(() => {
    utterances.at(-1)?.onend?.();
  });
};

beforeEach(() => {
  triggers = [];
  installSpeech();
  (globalThis as any).ResizeObserver = class {
    constructor(private cb: ResizeObserverCallback) {
      triggers.push((width: number) =>
        this.cb([{ contentRect: { width } } as ResizeObserverEntry], this as any),
      );
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => vi.clearAllMocks());

const mount = (props: Record<string, unknown> = {}) =>
  render(
    <SharedCanvasLayout
      isPlayMode
      headerTitle="Count"
      headerSubtitle="0 counted so far"
      readAloudText="Tap each one"
      {...props}
    >
      <div />
    </SharedCanvasLayout>,
  );

/** The header row: the only child carrying the row's bottom padding. */
const headerRow = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>("div")].find(node =>
    /pb-2|pb-1/.test(node.className) && /items-center|items-stretch/.test(node.className),
  );

const resizeTo = (width: number) => act(() => triggers.forEach(fire => fire(width)));

describe("the canvas header adapts to the room it got", () => {
  test("a wide card keeps the title and its controls on one row", () => {
    const { container } = mount();
    resizeTo(900);
    expect(headerRow(container)!.className).toContain("items-center");
    expect(headerRow(container)!.className).not.toContain("flex-col");
  });

  test("a narrow card stacks them, so the instruction gets the full width", () => {
    const { container } = mount();
    resizeTo(400);

    const row = headerRow(container)!;
    expect(row.className).toContain("flex-col");
    expect(row.className).toContain("items-stretch");
  });

  test("it follows the card back and forth, not just on the way down", () => {
    const { container } = mount();

    resizeTo(400);
    expect(headerRow(container)!.className).toContain("flex-col");

    // A studio panel closing, or a phone turned on its side.
    resizeTo(900);
    expect(headerRow(container)!.className).not.toContain("flex-col");
  });

  test("an explicit compact still wins over the measurement", () => {
    const { container } = mount({ compact: true });
    resizeTo(1200);
    expect(headerRow(container)!.className).toContain("flex-col");
  });

  test("the instruction wraps rather than losing its second half", () => {
    // `truncate` cut the sentence off at the toolbar — exactly when a long
    // instruction is the one a child most needs to read.
    const { container } = mount({ headerSubtitle: "Tap each bottle boba once to count it" });
    const line = [...container.querySelectorAll<HTMLElement>("div")].find(node =>
      (node.textContent || "") === "Tap each bottle boba once to count it",
    )!;
    expect(line.className).toContain("line-clamp-2");
    expect(line.className).not.toContain("truncate");
  });
});

/**
 * The question display — the header a canvas gets when it passes `questionText`.
 *
 * The thing being checked is a hierarchy, not a set of classes: whatever else is
 * on this row, the sentence a child has to read is the heading, and the state of
 * their work is not.
 */
describe("the question display", () => {
  const ask = (props: Record<string, unknown> = {}) =>
    mount({
      questionText: "Group 13 beads into tens.",
      questionEyebrow: "E · Understand place value",
      headerSubtitle: undefined,
      ...props,
    });

  test("the question is the heading", () => {
    const { container } = ask();
    const heading = container.querySelector("h2")!;
    expect(heading.textContent).toBe("Group 13 beads into tens.");
  });

  test("the eyebrow sits above it and does not take the heading's place", () => {
    const { container } = ask();
    const heading = container.querySelector("h2")!;
    const eyebrow = [...container.querySelectorAll<HTMLElement>("div")].find(
      node => (node.textContent || "") === "E · Understand place value",
    )!;
    // Earlier in document order, and smaller — an eyebrow, not a second heading.
    expect(eyebrow.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(eyebrow.className).toContain("uppercase");
  });

  test("a canvas that says nothing better falls back to its own name", () => {
    const { container } = ask({ questionEyebrow: undefined });
    expect(container.textContent).toContain("Count");
  });

  /*
    The canvas does not own the whole screen. The launcher's navbar already
    prints the slide's name above it, so a Count slide titled "Count" was
    printing the word twice — and the copy a child cannot read is the one to
    drop, not the one they need.
  */
  test("a learner is not shown the activity name twice", () => {
    const { container } = render(
      <CanvasAudienceProvider learnerMode>
        <SharedCanvasLayout isPlayMode headerTitle="Count" questionText="How many apples?">
          <div />
        </SharedCanvasLayout>
      </CanvasAudienceProvider>,
    );
    expect(container.querySelector("h2")!.textContent).toBe("How many apples?");
    expect(container.textContent).not.toContain("Count");
  });

  test("a real eyebrow survives for a learner, because it is context not a title", () => {
    const { container } = render(
      <CanvasAudienceProvider learnerMode>
        <SharedCanvasLayout
          isPlayMode
          headerTitle="Count"
          questionEyebrow="Unit 3 · Place value"
          questionText="How many apples?"
        >
          <div />
        </SharedCanvasLayout>
      </CanvasAudienceProvider>,
    );
    expect(container.textContent).toContain("Unit 3 · Place value");
  });

  /** The artwork itself — Koda wears no card and no nameplate to look for. */
  const koda = (container: HTMLElement) => container.querySelector("[data-koda-state]");

  test("Koda is absent until the question is spoken", () => {
    const { container } = ask({ guideRole: "waiting" });
    resizeTo(900);
    expect(koda(container)).toBeNull();
  });

  test("Koda says the line out loud and in writing", () => {
    /*
      The script is not the heading. `readAloudText` is the guidance, which
      existed only as sound before this — so a child who could not follow the
      voice, or a classroom with the volume down, had nothing.
    */
    const { container } = ask({ guideRole: "waiting", readAloudText: "Drag each apple into the next box" });
    resizeTo(900);
    speak();

    const bubble = container.querySelector('[role="status"]')!;
    expect(bubble.textContent).toBe("Drag each apple into the next box");
    // One live region for the whole sentence — not fifteen spans read one by one.
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  test("pressing Listen brings Koda in, talking", () => {
    const { container } = ask({ guideRole: "waiting" });
    resizeTo(900);

    speak();
    const guide = koda(container);
    expect(guide).not.toBeNull();
    // Not merely present — moving, because a still character with a voice
    // coming out of them is the uncanny version of this.
    expect(guide!.getAttribute("data-koda-state")).toBe("talking");
  });

  test("Koda stays on when the sentence ends, in the canvas's own role", () => {
    /*
      Leaving on the last syllable was the wrong instinct: a guide who vanishes
      the moment they stop talking is never around to react to the answer, which
      is most of what a guide is for. They stay, and change actor.
    */
    const { container } = ask({ guideRole: "waiting" });
    resizeTo(900);

    speak();
    expect(koda(container)!.getAttribute("data-koda-state")).toBe("talking");

    finishSpeaking();
    expect(koda(container)!.getAttribute("data-koda-state")).toBe("waiting");
  });

  test("the bubble closes with the voice, so it is not a sticky note on the board", () => {
    const { container } = ask({ guideRole: "waiting", readAloudText: "Count them all" });
    resizeTo(900);

    speak();
    expect(container.querySelector('[role="status"]')).not.toBeNull();

    finishSpeaking();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  test("a wrong answer changes who is standing there", () => {
    const { container, rerender } = ask({ guideRole: "waiting" });
    resizeTo(900);
    speak();
    finishSpeaking();

    rerender(
      <SharedCanvasLayout
        isPlayMode
        headerTitle="Count"
        readAloudText="Tap each one"
        questionText="Group 13 beads into tens."
        guideRole="oops"
      >
        <div />
      </SharedCanvasLayout>,
    );
    expect(koda(container)!.getAttribute("data-koda-state")).toBe("oops");
  });

  test("an answer brings the guide in even when Listen was never pressed", () => {
    const correct = ask({ guideRole: "celebrating" });
    resizeTo(900);
    expect(koda(correct.container)).not.toBeNull();
    expect(koda(correct.container)!.getAttribute("data-koda-state")).toBe("excited");
    correct.unmount();

    const incorrect = ask({ guideRole: "oops" });
    resizeTo(900);
    expect(koda(incorrect.container)).not.toBeNull();
    expect(koda(incorrect.container)!.getAttribute("data-koda-state")).toBe("oops");
  });

  test("a canvas that asks for no guide stays quiet through the whole sentence", () => {
    const { container } = ask();
    resizeTo(900);
    speak();
    expect(koda(container)).toBeNull();
  });

  test("a narrow card shrinks Koda rather than dropping them", () => {
    /*
      Dropping the guide below the compact threshold hid it in the one place it
      is most looked at: the Studio's canvas panel is ~530px, so an author
      pressed Listen and no character ever came. It shrinks instead.
    */
    // Measured off Koda's own svg — the Listen button has a lucide icon in it
    // that would otherwise be the first `svg[width]` in the document.
    const drawnAt = (root: HTMLElement) =>
      Number(koda(root)!.querySelector("svg[width]")!.getAttribute("width"));

    const wide = ask({ guideRole: "waiting" });
    resizeTo(900);
    speak();
    const wideSize = drawnAt(wide.container);
    // Unmounted before the second render, so there is only ever one Listen button to press.
    wide.unmount();

    const narrow = ask({ guideRole: "waiting" });
    resizeTo(360);
    speak();
    expect(narrow.container.querySelector("h2")!.textContent).toBe("Group 13 beads into tens.");
    expect(koda(narrow.container)).not.toBeNull();
    expect(drawnAt(narrow.container)).toBeLessThan(wideSize);
  });

  test("canvases that pass no question keep the old header untouched", () => {
    const { container } = mount();
    expect(container.querySelector("h2")).toBeNull();
    expect(container.textContent).toContain("0 counted so far");
  });
});

/**
 * The jump.
 *
 * The keyframes themselves are not worth asserting — a number here says nothing
 * about whether it looks like a jump. What is worth pinning is the ground:
 * without a shadow the same keyframes read as drifting rather than as height,
 * and it is the kind of element a later cleanup deletes as decoration.
 */
describe("Koda lands on something", () => {
  test("the guide brings a ground shadow with it", () => {
    const { container } = mount({ questionText: "Group 13 beads into tens.", guideRole: "waiting" });
    resizeTo(900);
    speak();

    const guide = container.querySelector("[data-koda-state]")!;
    const frame = guide.closest("div.relative")!;
    expect(frame.querySelector("span.rounded-\\[50\\%\\]")).not.toBeNull();
  });
});
