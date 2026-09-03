import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PrintPreview, UIPaper, UIPaperBreak } from "./UIPaper";

/**
 * The paper primitive.
 *
 * Everything here is about the thing that cannot be seen on screen: what the
 * printer is handed. The bug that produced these was a worksheet of fifteen
 * questions printing as twelve pages — the app was hidden with `visibility`,
 * which keeps the layout, so the whole learning path underneath still
 * paginated. The fix is that the printed copy lives outside `#root` and the app
 * is hidden with `display`, and that is a structural claim a test can hold.
 */

afterEach(cleanup);

describe("what the printer is given", () => {
  it("puts a copy outside the app, where hiding the app cannot hide it", () => {
    render(
      <PrintPreview>
        <UIPaper title="Doubles">
          <p>1. Double 4.</p>
        </UIPaper>
      </PrintPreview>,
    );

    const root = document.getElementById("print-root");
    expect(root, "no print root was created").not.toBeNull();
    expect(root!.parentElement).toBe(document.body);
    expect(root!.textContent).toContain("Double 4.");
  });

  it("shows the same paper on screen, and drops that copy at print time", () => {
    /* Two copies of one element: the preview a person reads, and the one the
       printer takes. Printing both would print the sheet twice, so the preview
       carries the marker the stylesheet hides. */
    render(
      <PrintPreview>
        <UIPaper title="Doubles">
          <p>1. Double 4.</p>
        </UIPaper>
      </PrintPreview>,
    );

    expect(screen.getAllByText("1. Double 4.")).toHaveLength(2);
    const preview = document.querySelector("[data-print-hide]");
    expect(preview, "the preview is not marked, so it would print too").not.toBeNull();
    expect(preview!.textContent).toContain("Double 4.");
  });

  it("takes the printed copy away with the dialog that opened it", () => {
    /* A sheet left behind in the print root prints on the next Ctrl-P, from
       whatever page the user happens to be on. */
    const view = render(
      <PrintPreview>
        <UIPaper title="Doubles">
          <p>1. Double 4.</p>
        </UIPaper>
      </PrintPreview>,
    );

    view.unmount();
    const root = document.getElementById("print-root");
    expect(root === null || root.textContent === "").toBe(true);
  });
});

describe("the sheet itself", () => {
  it("prints its heading, its blanks and its body", () => {
    render(
      <UIPaper
        eyebrow="Addition"
        title="Doubles"
        subtitle="The same number twice."
        blanks={["Name", "Date"]}
        footer="Koda"
      >
        <p>1. Double 4.</p>
      </UIPaper>,
    );

    expect(screen.getByText("Addition")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Doubles" })).toBeTruthy();
    expect(screen.getByText("The same number twice.")).toBeTruthy();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Date")).toBeTruthy();
    expect(screen.getByText("Koda")).toBeTruthy();
  });

  it("leaves out the furniture it was given nothing for", () => {
    /* A certificate has no name blank and no instruction line; an empty rule
       or a stray dash where they would be is worse than their absence. */
    const { container } = render(
      <UIPaper title="Well done">
        <p>Body</p>
      </UIPaper>,
    );

    expect(container.querySelector("footer")).toBeNull();
    expect(container.textContent).toBe("Well doneBody");
  });

  it("marks a section that must start its own page", () => {
    const { container } = render(<UIPaperBreak>Answers</UIPaperBreak>);
    expect(container.querySelector(".paper-break")).not.toBeNull();
  });
});
