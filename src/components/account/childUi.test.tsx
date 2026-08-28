import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { DayDoneScreen } from "../DayDoneScreen";
import { PinPrompt } from "./PinPrompt";
import { ChildSettingsFields } from "./ChildSettingsFields";
import { CHILD_SETTINGS_DEFAULTS, type ChildSettings } from "../../lib/childSettings";
import type { ConceptTotals } from "../../lib/learning/learningLog";

/**
 * The screens Phase A and B added, actually mounted.
 *
 * These are not a substitute for somebody looking at the pages — nothing here
 * can tell you a layout is ugly or a sentence reads badly. What they do catch
 * is the failure that unexercised UI actually has: a component that throws on
 * mount, on empty data, or on the one branch nobody happened to render.
 */

const permissions = vi.fn();
vi.mock("../../lib/sync", async () => {
  const actual = await vi.importActual<typeof import("../../lib/sync")>("../../lib/sync");
  return { ...actual, usePermissions: () => ({ can: (p: string) => permissions(p) }) };
});

const fetchChildReport = vi.fn();
vi.mock("../../lib/childReport", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/childReport")>("../../lib/childReport");
  return { ...actual, fetchChildReport: (...a: unknown[]) => fetchChildReport(...a) };
});

const totals = (patch: Partial<ConceptTotals> = {}): ConceptTotals => ({
  conceptKey: "make-ten",
  skillIds: ["counting"],
  questionsAnswered: 20,
  correctFirstTry: 19,
  supportsUsed: 0,
  lessonsCompleted: 2,
  lessonsAbandoned: 0,
  totalResponseMs: 60_000,
  errors: {},
  practisedOn: ["2026-08-20", "2026-08-21"],
  lastSeenTs: "2026-08-21T10:00:00.000Z",
  ...patch,
});

const report = async (rows: ConceptTotals[]) => {
  const { buildReport } = await vi.importActual<typeof import("../../lib/childReport")>(
    "../../lib/childReport",
  );
  return buildReport("l_mia", rows, rows.length);
};

const ChildReportPage = async () =>
  (await import("./ChildReportPage")).ChildReportPage;

const show = async (rows: ConceptTotals[]) => {
  permissions.mockReturnValue(true);
  fetchChildReport.mockResolvedValue(await report(rows));
  const Page = await ChildReportPage();
  render(<Page learnerId="l_mia" learnerName="Mia" />);
  // The fetch resolves on a microtask, so the page mounts in its loading state.
  // Waiting on the h1 rather than the name: "Mia" appears in the heading, the
  // subtitle and most of the hints, and a multiple-match is not a wait.
  await screen.findByRole("heading", { level: 1, name: "Mia" });
};

describe("a child's report, mounted", () => {
  it("refuses the page to an account without the right", async () => {
    permissions.mockReturnValue(false);
    const Page = await ChildReportPage();
    render(<Page learnerId="l_mia" learnerName="Mia" />);

    expect(screen.getByText(/learner_data:read/)).toBeTruthy();
  });

  it("says there is nothing yet for a child who has never played", async () => {
    await show([]);

    expect(await screen.findByText(/Nothing to show yet/)).toBeTruthy();
  });

  it("draws the rhythm and the concept for a child who has", async () => {
    await show([totals()]);

    expect(await screen.findByText("Rhythm")).toBeTruthy();
    expect(screen.getByText(/Where Mia is/)).toBeTruthy();
    // Named from the lesson that teaches it, not by its machine key. The title
    // is child-facing copy and may be reworded, so this asserts that the report
    // resolved *a* lesson title rather than pinning today's wording.
    expect(screen.getByText("Friends of Ten")).toBeTruthy();
    expect(screen.queryByText("make-ten"), "shows the title, not the key").toBeNull();
    // Twice: the group is headed "Secure" and each concept in it carries the
    // same badge. Redundant rather than wrong — a row still has to read on its
    // own when a parent scans past the heading.
    expect(screen.getAllByText("Secure")).toHaveLength(2);
  });

  it("says what is going wrong, in a sentence rather than a code", async () => {
    await show([
      totals({ questionsAnswered: 20, correctFirstTry: 4, errors: { place_value: 6 } }),
    ]);

    expect(await screen.findByText("Tens and ones")).toBeTruthy();
    expect(screen.getByText(/15 for 51/)).toBeTruthy();
    // The machine name never reaches the page.
    expect(screen.queryByText("place_value")).toBeNull();
  });

  it("refuses to judge a concept it has too little evidence for", async () => {
    await show([totals({ questionsAnswered: 3, correctFirstTry: 1, practisedOn: ["2026-08-21"] })]);

    expect(await screen.findByText(/Still getting to know Mia/)).toBeTruthy();
    expect(screen.getByText(/about 5 more before this says anything/)).toBeTruthy();
    // No percentage, because three answers cannot support one.
    expect(screen.queryByText(/33%/)).toBeNull();
  });

  it("hides the nearly-solo section when it has nothing to say", async () => {
    await show([totals()]);

    expect(screen.queryByText("Nearly solo")).toBeNull();
  });

  it("shows nearly-solo for a child who is right but still taking hints", async () => {
    // Rendered on its own: two trees in one document would make every query
    // ambiguous, which is the same mistake the helper above just made.
    cleanup();
    await show([totals({ supportsUsed: 15 })]);

    expect(await screen.findByText("Nearly solo")).toBeTruthy();
  });
});

describe("the parent's controls, mounted", () => {
  const draw = (value: Partial<ChildSettings> = {}, onChange = vi.fn()) => {
    render(
      <ChildSettingsFields
        value={{ ...CHILD_SETTINGS_DEFAULTS, ...value }}
        onChange={onChange}
        childName="Mia"
      />,
    );
    return onChange;
  };

  it("draws all four controls", () => {
    draw();

    for (const title of ["Time each day", "Starting point", "Koda's help", "Streak"]) {
      expect(screen.getByText(title), `${title} is missing`).toBeTruthy();
    }
  });

  it("names the child in its hints rather than talking about a field", () => {
    draw();

    expect(screen.getByText(/How long Mia can play/)).toBeTruthy();
  });

  it("sends a patch, not a whole document, when a cap is picked", () => {
    const onChange = draw();
    screen.getByRole("radio", { name: "30 min" }).click();

    expect(onChange).toHaveBeenCalledWith({ sessionMinutes: 30 });
  });

  it("marks the cap that is currently set", () => {
    draw({ sessionMinutes: 30 });

    expect(screen.getByRole("radio", { name: "30 min" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("radio", { name: "No limit" }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("keeps a cap that is not one of the presets selectable", () => {
    // Set on another device. It has to appear, or saving would silently change it.
    draw({ sessionMinutes: 25 });

    expect(screen.getByRole("radio", { name: "25 min" }).getAttribute("aria-checked")).toBe("true");
  });

  it("turns Koda's help off with the switch", () => {
    const onChange = draw({ aiHelpEnabled: true });
    screen.getByRole("switch", { name: "Koda's help" }).click();

    expect(onChange).toHaveBeenCalledWith({ aiHelpEnabled: false });
  });

  it("says the plan does not cover Koda rather than pretending it does", () => {
    render(
      <ChildSettingsFields
        value={CHILD_SETTINGS_DEFAULTS}
        onChange={vi.fn()}
        childName="Mia"
        planHasAi={false}
      />,
    );

    expect(screen.getByText(/Not included on your plan yet/)).toBeTruthy();
  });

  it("names the unit the flame counts in, rather than a frequency", () => {
    // "Every day" read as *how often she must practise*, which is not what
    // this sets. The choices name the unit and the hint says so.
    draw();

    expect(screen.getByText(/flame counts days or weeks/)).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Days" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Weeks" })).toBeTruthy();
  });

  it("switches the streak to weeks", () => {
    const onChange = draw({ goalCadence: "daily" });
    screen.getByRole("radio", { name: "Weeks" }).click();

    expect(onChange).toHaveBeenCalledWith({ goalCadence: "weekly" });
  });

  it("explains what each unit means, about the child by name", () => {
    cleanup();
    draw({ goalCadence: "weekly" });

    expect(screen.getByText(/Mia's flame grows on a week practised/)).toBeTruthy();
    expect(screen.getByText(/a busy day costs nothing/)).toBeTruthy();
  });

  it("says the daily goal is not what this changes", () => {
    // The two controls sit together and both involve a day; a parent who
    // conflated them would set one meaning to get the other.
    draw();

    expect(screen.getByText(/daily goal is separate/)).toBeTruthy();
  });

  it("offers units for the starting point, never level numbers", () => {
    draw();
    const group = screen.getByRole("radiogroup", { name: "Where this child starts" });

    expect(within(group).getByRole("radio", { name: "From the start" })).toBeTruthy();
    expect(within(group).getByRole("radio", { name: "Unit 2" })).toBeTruthy();
    expect(within(group).queryByRole("radio", { name: /level/i })).toBeNull();
  });

  it("promises that placing a child does not shut the earlier units", () => {
    draw({ startingPoint: 4 });

    expect(screen.getByText(/Earlier units stay open/)).toBeTruthy();
  });
});

describe("the end of a capped day, mounted", () => {
  it("tells a child the rule was a grown-up's, and offers no way round it", () => {
    render(<DayDoneScreen cap={20} />);

    expect(screen.getByText(/That’s it for today/)).toBeTruthy();
    expect(screen.getByText(/your 20 minutes/)).toBeTruthy();
    expect(screen.getByText(/Your grown-up picked that/)).toBeTruthy();
    // Nothing a child can tap to buy more time.
    expect(screen.queryByRole("button", { name: /more|continue|keep/i })).toBeNull();
  });

  it("reassures them that what they earned is kept", () => {
    render(<DayDoneScreen cap={30} />);

    expect(screen.getByText(/Everything you earned today is saved/)).toBeTruthy();
  });
});

describe("a dialog opened from inside the sidebar", () => {
  /**
   * The bug a screenshot caught.
   *
   * `position: fixed` is only relative to the viewport while no ancestor has a
   * transform — and the sidebar `<aside>` carries `translate-x-0` at every
   * breakpoint, so a modal mounted inside it was laid out against the sidebar
   * instead of the screen. Portalling to `document.body` is the fix, and this
   * is what stops it regressing.
   */
  it("renders on document.body, not where it was mounted", () => {
    const { container } = render(
      <div style={{ transform: "translateX(0)" }}>
        <PinPrompt isOpen onClose={vi.fn()} onSubmit={vi.fn()} />
      </div>,
    );

    // Nothing inside the transformed wrapper…
    expect(container.querySelector("input")).toBeNull();
    // …and the dialog is on the page all the same.
    expect(screen.getByRole("heading", { name: /Ask a grown/ })).toBeTruthy();
  });

  it("keeps 'grown-up' on one line", () => {
    cleanup();
    render(<PinPrompt isOpen onClose={vi.fn()} onSubmit={vi.fn()} />);

    // A non-breaking hyphen, so a narrow dialog cannot split the word.
    expect(screen.getByRole("heading", { name: "Ask a grown‑up" })).toBeTruthy();
  });

  it("names the account being opened, and offers no way to skip the PIN", () => {
    cleanup();
    render(
      <PinPrompt isOpen accountName="lbuntha@gmail.com" onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByText("lbuntha@gmail.com")).toBeTruthy();
    // No "forgot it" escape from a child's session — that would be the whole
    // control undone.
    expect(screen.queryByText(/forgot/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Unlock" }).hasAttribute("disabled")).toBe(true);
  });
});
