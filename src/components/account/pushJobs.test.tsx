import type { ReactNode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What an operator reads after pressing a button.
 *
 * The arithmetic in these reports is the server's and is tested there. What is
 * tested here is the sentence, because the sentence is where this screen went
 * wrong: three jobs answer in three different shapes, the screen understood
 * one of them, and the two it did not understand rendered a literal
 * "Invalid Date" and a count of summaries a reminder run never composed.
 *
 * The payloads below are not invented. They are what `weekly_summary`,
 * `daily_reminders` and `skill_announcements` returned from a running
 * deployment, copied field for field — an assertion against a shape I made up
 * would agree with a screen that is wrong about the shape the server sends.
 */

const runNotificationJob = vi.fn();

vi.mock("../../lib/push", () => ({
  notificationJobs: () =>
    Promise.resolve([
      { id: "weekly-summary", description: "Sunday's summary." },
      { id: "daily-reminders", description: "A nudge for a child who has not practised." },
      { id: "skill-announcements", description: "Tell every family about a new skill." },
    ]),
  runNotificationJob: (job: string, preview: boolean) => runNotificationJob(job, preview),
}));

vi.mock("../../lib/themeSystem", () => ({
  themeSystem: {
    card: (_tone: string, extra: string) => extra,
    button: () => "",
    spacing: { card: "" },
  },
}));

vi.mock("../ui", () => ({
  UISectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  UIDataTable: ({
    columns,
    rows,
    rowKey,
  }: {
    columns: { key: string; render: (row: any) => ReactNode }[];
    rows: any[];
    rowKey: (row: any) => string;
  }) => (
    <div>
      {rows.map((row) => (
        <div key={rowKey(row)}>
          {columns.map((column) => (
            <span key={column.key}>{column.render(row)}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}));

const { PushJobs } = await import("./PushJobs");

/** Press one job's button and wait for the report to land. */
const press = async (job: string, label: "Preview" | "Run now") => {
  render(<PushJobs />);
  // The job list is fetched, so the card does not exist on the first paint.
  const heading = await screen.findByText(job);
  const card = heading.closest("div")!.parentElement!;
  act(() => {
    within(card).getByRole("button", { name: new RegExp(label, "i") }).click();
  });
  await waitFor(() => expect(runNotificationJob).toHaveBeenCalledWith(job, label === "Preview"));
};

beforeEach(() => {
  runNotificationJob.mockReset();
});

describe("the reminder report", () => {
  // Captured from a real preview: a reminder line carries `kind`, `streak` and
  // `people`, and carries no Sunday at all.
  const preview = {
    job: "daily-reminders",
    preview: true,
    report: {
      job: "daily-reminders",
      preview: true,
      families: 1,
      due: 1,
      reminders: 0,
      streaks: 0,
      sent: 0,
      cursor: null,
      would_send: [
        {
          familyId: "f_799c7c4465cc4b1a85a9",
          learnerId: "l_5f3e95a332044b0e8f27",
          learner: "Mia",
          kind: "learn.practice_reminder",
          title: "Time to practise",
          body: "It's been 7 days since Mia practised.",
          streak: 0,
          people: 0,
        },
      ],
    },
  };

  it("never prints an invalid date where a summary would have its Sunday", async () => {
    runNotificationJob.mockResolvedValue(preview);
    await press("daily-reminders", "Preview");

    // The bug, asserted as an absence: `theirSundayEvening` is undefined on a
    // reminder line, and `new Date(undefined).toLocaleString()` is the string
    // below. It reached an operator's screen under every reminder previewed.
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
    expect(await screen.findByText(/It's been 7 days since Mia practised/)).toBeTruthy();
  });

  it("says why the reminder would go, and how many parents would get it", async () => {
    runNotificationJob.mockResolvedValue(preview);
    await press("daily-reminders", "Preview");

    // `people: 0` is the answer to "why did nothing arrive?" — shown, not hidden.
    expect(await screen.findByText(/has not practised today · 0 parents would be told/)).toBeTruthy();
    expect(screen.getByText(/1 reminder across 1 family/)).toBeTruthy();
  });

  it("counts a streak warning as a reason rather than a variant", async () => {
    runNotificationJob.mockResolvedValue({
      ...preview,
      report: {
        ...preview.report,
        would_send: [
          { ...preview.report.would_send[0], kind: "learn.streak_ending", streak: 5, people: 2 },
        ],
      },
    });
    await press("daily-reminders", "Preview");

    expect(await screen.findByText(/5-day streak at stake · 2 parents would be told/)).toBeTruthy();
  });

  it("does not report summaries after a run that composed reminders", async () => {
    runNotificationJob.mockResolvedValue({
      job: "daily-reminders",
      preview: false,
      report: {
        job: "daily-reminders",
        preview: false,
        families: 3,
        due: 2,
        reminders: 3,
        streaks: 1,
        sent: 4,
        cursor: null,
      },
    });
    await press("daily-reminders", "Run now");

    // `summaries` is a field only the summary sets, so reading it here reported
    // "0 summaries composed" for a run that had just sent four notifications.
    expect(
      await screen.findByText(/3 reminders and 1 streak warning composed, 4 delivered/),
    ).toBeTruthy();
    expect(screen.queryByText(/summaries composed/)).toBeNull();
  });

  it("waits for the chosen hour rather than for Sunday evening", async () => {
    runNotificationJob.mockResolvedValue({
      job: "daily-reminders",
      preview: false,
      report: { job: "daily-reminders", preview: false, families: 2, due: 0, sent: 0 },
    });
    await press("daily-reminders", "Run now");

    // Not "it is nobody's Sunday evening", which is what this said for every
    // job — and which sends an operator to wait five days for a nudge that was
    // only ever waiting for 18:00.
    const report = await screen.findByText(/nobody\u2019s chosen hour right now/);
    expect(report.textContent).not.toMatch(/Sunday/);
  });
});

describe("the announcement report", () => {
  const twoSkills = {
    job: "skill-announcements",
    preview: true,
    report: {
      job: "skill-announcements",
      preview: true,
      families: 1,
      skills: 2,
      announcements: 0,
      sent: 0,
      cursor: null,
      would_send: [
        {
          familyId: "f_1",
          skillId: "bottle-sort",
          skill: "Bottle Sort",
          title: "Something new",
          body: "Bottle Sort is ready to try.",
          alreadySent: false,
          theirLocalHour: 9,
        },
        {
          familyId: "f_1",
          skillId: "money",
          skill: "Money",
          title: "Something new",
          body: "Money is ready to try.",
          alreadySent: true,
          theirLocalHour: 9,
        },
      ],
    },
  };

  it("keeps two skills for one family apart", async () => {
    runNotificationJob.mockResolvedValue(twoSkills);
    await press("skill-announcements", "Preview");

    // Keyed on `familyId-learnerId` these collided: an announcement line has no
    // learner, so both rows claimed the key "f_1-undefined".
    expect(await screen.findByText(/Bottle Sort · 09:00 their time/)).toBeTruthy();
    expect(screen.getByText(/Money · 09:00 their time/)).toBeTruthy();
    expect(screen.getByText(/2 announcements across 1 family/)).toBeTruthy();
  });

  it("reports what a real run announced, not what it summarised", async () => {
    runNotificationJob.mockResolvedValue({
      job: "skill-announcements",
      preview: false,
      report: {
        job: "skill-announcements",
        preview: false,
        families: 4,
        skills: 1,
        announcements: 4,
        sent: 9,
        cursor: null,
      },
    });
    await press("skill-announcements", "Run now");

    expect(await screen.findByText(/1 skill announced to 4 families, 9 delivered/)).toBeTruthy();
  });
});

describe("the summary report", () => {
  it("still reads its own shape", async () => {
    runNotificationJob.mockResolvedValue({
      job: "weekly-summary",
      preview: true,
      report: {
        job: "weekly-summary",
        preview: true,
        families: 1,
        due: 1,
        summaries: 1,
        sent: 0,
        would_send: [
          {
            familyId: "f_1",
            learnerId: "l_1",
            learner: "Mia",
            days: 4,
            title: "Mia's week",
            body: "Mia practised 4 days this week.",
            alreadySent: false,
            theirSundayEvening: "2026-09-20T18:00:00+07:00",
          },
        ],
      },
    });
    await press("weekly-summary", "Preview");

    expect(await screen.findByText(/Mia practised 4 days this week/)).toBeTruthy();
    expect(screen.getByText(/^due /)).toBeTruthy();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it("explains a browser that belongs to no family", async () => {
    // The state this deployment is actually in: tokens registered by an admin
    // account with no membership, which every job filters out on `familyId`.
    runNotificationJob.mockResolvedValue({
      job: "weekly-summary",
      preview: true,
      report: { job: "weekly-summary", preview: true, families: 0, due: 0, summaries: 0, sent: 0 },
    });
    await press("weekly-summary", "Preview");

    expect(await screen.findByText(/an account with no family counts for nothing/)).toBeTruthy();
  });

  it("names the console driver when nothing was delivered", async () => {
    runNotificationJob.mockResolvedValue({
      job: "weekly-summary",
      preview: false,
      report: { job: "weekly-summary", preview: false, families: 1, due: 1, summaries: 2, sent: 0 },
    });
    await press("weekly-summary", "Run now");

    expect(await screen.findByText(/2 summaries composed, 0 delivered/)).toBeTruthy();
    expect(screen.getByText(/console push driver/)).toBeTruthy();
  });
});
