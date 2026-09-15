import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const chooseNotification = vi.fn();
let prefs: Record<string, unknown> = {};

vi.mock("../../lib/push", () => ({
  chooseNotification: (kind: string, on: boolean, channel: string) => chooseNotification(kind, on, channel),
  disableNotifications: vi.fn(),
  enableNotifications: vi.fn(),
  notificationPreferences: () => Promise.resolve(prefs),
  notificationSchedule: () => Promise.resolve(null),
  notificationsAreOn: () => false,
  pushSupport: () => ({ state: "not-configured" }),
  setNotificationSchedule: vi.fn(),
  testMyOwnDevices: vi.fn(),
}));

vi.mock("../../lib/themeSystem", () => ({
  themeSystem: {
    list: { groupLabel: "", group: "", row: "", rowIcon: "", rowTitle: "", rowNote: "" },
    button: () => "",
  },
}));

vi.mock("../ui", () => ({
  UIToggle: ({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) => (
    <button role="switch" aria-checked={checked} aria-label={label} onClick={onChange} />
  ),
}));

const { NotificationsSettings } = await import("./NotificationsSettings");

const base = {
  enabled: true,
  kinds: [],
  emailEnabled: true,
  emailVerified: true,
  emailAddress: "dara@example.com",
  emailKinds: [{ id: "system.announcement", label: "Announcements", on: true }],
  emailStopped: false,
};

beforeEach(() => {
  prefs = { ...base };
  chooseNotification.mockReset();
});

describe("email updates in a parent's settings", () => {
  it("are offered even where push is not set up, and switch one kind off", async () => {
    chooseNotification.mockResolvedValue({
      ...base,
      emailKinds: [{ id: "system.announcement", label: "Announcements", on: false }],
    });
    render(<NotificationsSettings />);

    const toggle = await screen.findByRole("switch", { name: "Announcements emails" });
    expect(screen.getByText("Sent to dara@example.com.")).toBeTruthy();
    fireEvent.click(toggle);

    await waitFor(() => expect(chooseNotification).toHaveBeenCalledWith("system.announcement", false, "email"));
  });

  it("stop all hides the per-kind switches", async () => {
    chooseNotification.mockResolvedValue({ ...base, emailStopped: true });
    render(<NotificationsSettings />);

    fireEvent.click(await screen.findByRole("switch", { name: "Email updates" }));

    await waitFor(() => expect(chooseNotification).toHaveBeenCalledWith("*", false, "email"));
    expect(screen.queryByRole("switch", { name: "Announcements emails" })).toBeNull();
  });

  it("ask for a verified address before drawing any switch", async () => {
    prefs = { ...base, emailVerified: false };
    render(<NotificationsSettings />);

    expect(await screen.findByText(/Verify dara@example.com/)).toBeTruthy();
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
