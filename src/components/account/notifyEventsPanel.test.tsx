import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notifyEvents = vi.fn();
const setNotifySwitch = vi.fn();
const setNotifyJob = vi.fn();

vi.mock("../../lib/push", () => ({
  notifyEvents: () => notifyEvents(),
  setNotifySwitch: (id: string, value: boolean) => setNotifySwitch(id, value),
  setNotifyJob: (job: string, patch: unknown) => setNotifyJob(job, patch),
}));

vi.mock("../../lib/sync", () => ({ ApiError: class ApiError extends Error {} }));

vi.mock("../../lib/themeSystem", () => ({
  themeSystem: {
    card: (_tone: string, extra: string) => extra,
    button: () => "",
    field: () => "",
    spacing: { card: "" },
  },
}));

vi.mock("../ui", () => ({
  UISectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  UIToggle: ({
    checked,
    onChange,
    label,
    disabled,
  }: {
    checked: boolean;
    onChange: () => void;
    label: string;
    disabled?: boolean;
  }) => <button role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={onChange} />,
  UIToggleRow: ({
    title,
    description,
    checked,
    onChange,
  }: {
    title: string;
    description?: string;
    checked: boolean;
    onChange: () => void;
  }) => (
    <div>
      <button role="switch" aria-checked={checked} aria-label={title} onClick={onChange} />
      <p>{description}</p>
    </div>
  ),
}));

const { NotifyEventsPanel } = await import("./NotifyEventsPanel");

const off = { available: false, settingId: null, on: false, locked: false };
const events = {
  pushEnabled: true,
  emailEnabled: true,
  pushDriver: "fcm",
  mailDriver: "console",
  events: [
    {
      id: "device.new_signin",
      label: "New device signed in",
      class: "account",
      push: { available: true, settingId: null, on: true, locked: true },
      email: { available: true, settingId: null, on: true, locked: true },
      job: null,
    },
    {
      id: "system.announcement",
      label: "Announcements",
      class: "courtesy",
      push: { available: true, settingId: "push.announcements", on: true, locked: false },
      email: { available: true, settingId: "email.announcements", on: true, locked: false },
      job: null,
    },
    {
      id: "learn.weekly_summary",
      label: "Weekly summary",
      class: "courtesy",
      push: { available: true, settingId: "push.weeklySummary", on: true, locked: false },
      email: off,
      job: "weekly-summary",
    },
  ],
  jobs: [
    {
      id: "weekly-summary",
      description: "Sunday's summary.",
      enabled: true,
      weekday: 6,
      hour: 18,
      lastRunAt: null,
      lastSent: null,
      lastSkipped: null,
    },
  ],
};

beforeEach(() => {
  notifyEvents.mockReset().mockResolvedValue(events);
  setNotifySwitch.mockReset().mockResolvedValue(undefined);
  setNotifyJob.mockReset().mockResolvedValue(events);
});

describe("the events screen", () => {
  it("draws account notices as always on, and flips a kind's email switch", async () => {
    render(<NotifyEventsPanel />);
    await screen.findByText("Announcements");

    expect(screen.getAllByText("Always")).toHaveLength(2);
    fireEvent.click(screen.getByRole("switch", { name: "Announcements email" }));

    await waitFor(() => expect(setNotifySwitch).toHaveBeenCalledWith("email.announcements", false));
  });

  it("says when the weekly summary goes, and moves its day", async () => {
    render(<NotifyEventsPanel />);

    expect(await screen.findByText("Sunday · 6pm, each family's own time")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Weekly summary day"), { target: { value: "5" } });

    await waitFor(() => expect(setNotifyJob).toHaveBeenCalledWith("weekly-summary", { weekday: 5 }));
  });

  it("sets how many days away before a parent is told", async () => {
    const withAbsence = {
      ...events,
      jobs: [
        ...events.jobs,
        {
          id: "absence-check",
          description: "Tell a parent once.",
          enabled: true,
          weekday: null,
          hour: null,
          days: 7,
          lastRunAt: null,
          lastSent: null,
          lastSkipped: null,
        },
      ],
    };
    notifyEvents.mockResolvedValue(withAbsence);
    render(<NotifyEventsPanel />);

    fireEvent.change(await screen.findByLabelText("Absence check days"), { target: { value: "14" } });

    await waitFor(() => expect(setNotifyJob).toHaveBeenCalledWith("absence-check", { days: 14 }));
  });

  it("says when email is only being logged", async () => {
    render(<NotifyEventsPanel />);

    expect(await screen.findByText(/MAIL_DRIVER is console/)).toBeTruthy();
  });
});
