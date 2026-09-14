import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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

/** A local day string `n` days back — `practisedOn` is keyed by local date. */
const localDay = (back: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - back);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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

    expect(await screen.findByText("How often")).toBeTruthy();
    expect(screen.getByText(/Where Mia is/)).toBeTruthy();
    // Named from the lesson that teaches it, not by its machine key. The title
    // is child-facing copy and may be reworded, so this asserts that the report
    // resolved *a* lesson title rather than pinning today's wording.
    expect(screen.getByText("Friends of Ten")).toBeTruthy();
    expect(screen.queryByText("make-ten"), "shows the title, not the key").toBeNull();
    // Once, on the group heading. The row inside used to repeat the same badge
    // on its right-hand side; that column now carries the thing a parent can
    // act on instead.
    expect(screen.getAllByText("Secure")).toHaveLength(1);
  });

  it("says whether the week was enough practice, not just how many days", async () => {
    cleanup();
    // Two days, so under the bar — and the sentence says what to aim for
    // instead of leaving "2 of 7" to be interpreted.
    await show([totals({ practisedOn: [localDay(0), localDay(1)] })]);

    expect(await screen.findByText(/Aim for 3 short sessions/)).toBeTruthy();
  });

  it("tells a parent what to do about a concept, not just where it sits", async () => {
    cleanup();
    // Right most times, on two days, but a hint taken on three quarters of the
    // questions: the missing ingredient is working alone, and the page says so.
    await show([
      totals({ questionsAnswered: 20, correctFirstTry: 16, supportsUsed: 15, lessonsCompleted: 0 }),
    ]);

    // Matched on the diagnosis rather than the instruction: the Nearly solo
    // section gives the same advice in its own subtitle, and both appearing is
    // the point rather than an ambiguity to work around.
    expect(await screen.findByText(/Right most times, but with a hint/)).toBeTruthy();
  });

  it("names the missing day when that is the only thing left", async () => {
    cleanup();
    // Accurate, unaided, a finished round — and all of it on one afternoon.
    await show([
      totals({ practisedOn: ["2026-08-21"], lastSeenTs: "2026-08-21T10:00:00.000Z" }),
    ]);

    expect(await screen.findByText(/round on a different day/i)).toBeTruthy();
  });

  it("keeps the groups a parent cannot act on shut, and says how many they hold", async () => {
    cleanup();
    await show([totals()]);

    // "Secure" is finished work: present, counted, but not opened over the top
    // of anything that still needs doing.
    const group = screen.getByText("Secure").closest("details");
    expect(group).toBeTruthy();
    expect(group!.open, "a finished group opens on a tap, not on load").toBe(false);
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
    expect(screen.getByText(/About 5 more answers before this can say anything/)).toBeTruthy();
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
  const draw = (
    value: Partial<ChildSettings> = {},
    onChange = vi.fn(),
    childAge: number | null = 6,
  ) => {
    render(
      <ChildSettingsFields
        value={{ ...CHILD_SETTINGS_DEFAULTS, ...value }}
        onChange={onChange}
        childName="Mia"
        childAge={childAge}
      />,
    );
    return onChange;
  };

  const startSelect = () =>
    screen.getByLabelText("Where this child starts") as HTMLSelectElement;

  it("draws all five controls", () => {
    draw();

    for (const title of [
      "Daily play time",
      "Play hours",
      "Starting lesson",
      "Koda's help",
      "Streak",
    ]) {
      expect(screen.getByText(title), `${title} is missing`).toBeTruthy();
    }
  });

  it("keeps the time hint short", () => {
    draw();

    expect(screen.getByText(/Set a daily time limit/)).toBeTruthy();
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

  it("offers no hour pickers until a parent limits the hours", () => {
    draw({ allowedHours: null });

    expect(screen.queryByLabelText("Koda opens at")).toBeNull();
    expect(screen.getByText(/Available all day/)).toBeTruthy();
  });

  it("starts a window at a sensible school day rather than at midnight", () => {
    const onChange = draw({ allowedHours: null });
    screen.getByRole("switch", { name: "Limit play hours" }).click();

    expect(onChange).toHaveBeenCalledWith({ allowedHours: { from: 7, to: 20 } });
  });

  it("switches the window off without disturbing anything else", () => {
    const onChange = draw({ allowedHours: { from: 7, to: 20 } });
    screen.getByRole("switch", { name: "Limit play hours" }).click();

    expect(onChange).toHaveBeenCalledWith({ allowedHours: null });
  });

  it("sends the whole window when one end of it moves", () => {
    // A patch of `{ to }` alone would leave the store merging a half window.
    const onChange = draw({ allowedHours: { from: 7, to: 20 } });
    const until = screen.getByLabelText("Koda shuts at") as HTMLSelectElement;
    until.value = "19";
    until.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith({ allowedHours: { from: 7, to: 19 } });
  });

  it("reads the window back in words a parent can check", () => {
    draw({ allowedHours: { from: 7, to: 20 } });

    expect(screen.getByText(/Mia: 7 AM–8 PM/)).toBeTruthy();
  });

  it("warns when a window has been set inside out", () => {
    // "8 PM until 7 AM" is what a parent types when they mean bedtime, and it
    // opens the night instead. Legal, so it is said out loud rather than refused.
    draw({ allowedHours: { from: 20, to: 7 } });

    expect(screen.getByText(/Mia: 8 PM–7 AM overnight/)).toBeTruthy();
  });

  it("will not let a parent pick the same hour twice and wipe the rule", () => {
    // `clampHours` reads `from === to` as no window at all, so saving one would
    // switch the whole setting off with nothing saying why.
    draw({ allowedHours: { from: 7, to: 20 } });

    const opens = screen.getByLabelText("Koda opens at") as HTMLSelectElement;
    const shuts = screen.getByLabelText("Koda shuts at") as HTMLSelectElement;
    expect([...opens.options].map((o) => o.value)).not.toContain("20");
    expect([...shuts.options].map((o) => o.value)).not.toContain("7");
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

    expect(screen.getByText(/Not included in your plan/)).toBeTruthy();
  });

  it("names the unit the flame counts in, rather than a frequency", () => {
    // "Every day" read as *how often she must practise*, which is not what
    // this sets. The choices name the unit and the hint says so.
    draw();

    expect(screen.getByText(/Count streaks by days or weeks/)).toBeTruthy();
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

    expect(screen.getByText(/Practise this week to grow it/)).toBeTruthy();
  });

  it("says the daily goal is not what this changes", () => {
    // The two controls sit together and both involve a day; a parent who
    // conflated them would set one meaning to get the other.
    draw();

    expect(screen.getByText(/Daily goals count rounds/)).toBeTruthy();
  });

  it("puts age-band placement first, then the manual choices", () => {
    draw({}, vi.fn(), 12);
    const labels = [...startSelect().options].map((option) => option.textContent ?? "");

    // The default leads, and names the unit it will actually land on.
    expect(labels[0]).toMatch(/^By age — Unit \d+: .+/);
    expect(labels[1]).toBe("From the very start");
    // Titles rather than bare numbers: a parent recognises the work, not "Unit 47".
    expect(labels[2]).toMatch(/^Unit 2: .+/);
    expect(labels.some((label) => /level/i.test(label))).toBe(false);
  });

  it("says what it has to go on when no birth year was entered", () => {
    draw({}, vi.fn(), null);

    expect(startSelect().options[0].textContent).toBe("By age (add a birth year)");
    expect(screen.getByText(/Add Mia's birth year to start by age/)).toBeTruthy();
  });

  it("places an older child further in than a younger one", () => {
    draw({}, vi.fn(), 12);
    const older = startSelect().options[0].textContent ?? "";
    cleanup();
    draw({}, vi.fn(), 7);
    const younger = startSelect().options[0].textContent ?? "";

    expect(older).not.toBe(younger);
  });

  it("sends the age rule, not a level, when a parent picks it back", () => {
    const onChange = draw({ startingPoint: 40 }, vi.fn(), 12);
    const where = startSelect();
    where.value = "age";
    where.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith({ startingPoint: "age" });
  });

  it("lets a parent override the age band with the very start", () => {
    const onChange = draw({ startingPoint: "age" }, vi.fn(), 12);
    const where = startSelect();
    where.value = "start";
    where.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith({ startingPoint: null });
  });

  it("puts the whole course behind one control rather than a wall of buttons", () => {
    // 107 units. As a row of `Choices` this drew 106 buttons, which is why it
    // is a dropdown — and why a regression to buttons should fail here.
    draw();

    expect(screen.queryByRole("radiogroup", { name: "Where this child starts" })).toBeNull();
    expect(startSelect().options.length).toBeGreaterThan(50);
  });

  it("promises that placing a child does not shut the earlier units", () => {
    draw({ startingPoint: 4 });

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
