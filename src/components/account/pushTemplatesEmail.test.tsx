import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rewordNotificationEmail = vi.fn();
const rewordEmailFrame = vi.fn();

const wording = {
  templates: [
    {
      id: "system.announcement",
      label: "Announcements",
      class: "courtesy",
      title: "{title}",
      body: "{message}",
      placeholders: ["title", "message"],
      edited: false,
      email: {
        subject: "{title}",
        body: "{message}",
        placeholders: ["title", "message", "parent", "family", "app_link"],
        edited: false,
      },
    },
  ],
  frame: {
    body: "Hi {parent},\n\n{message}",
    footer: "Stop these emails: {unsubscribe_link}",
    accountFooter: "About your account.",
    placeholders: {
      body: ["parent", "message"],
      footer: ["kind_label", "unsubscribe_link", "app_link"],
      accountFooter: ["app_link"],
    },
    required: { body: "message", footer: "unsubscribe_link" },
    edited: false,
  },
};

vi.mock("../../lib/push", () => ({
  notificationWording: () => Promise.resolve(wording),
  rewordNotificationEmail: (kind: string, body: unknown) => rewordNotificationEmail(kind, body),
  rewordEmailFrame: (frame: unknown) => rewordEmailFrame(frame),
  rewordNotification: vi.fn(),
  resetNotificationWording: vi.fn(),
  resetNotificationEmail: vi.fn(),
  resetEmailFrame: vi.fn(),
  sendTestEmail: vi.fn(),
}));

vi.mock("../../lib/sync", () => ({ ApiError: class ApiError extends Error {} }));

vi.mock("../../lib/themeSystem", () => ({
  themeSystem: { card: (_tone: string, extra: string) => extra, button: () => "", spacing: { card: "" } },
}));

vi.mock("../ui", () => ({
  UISectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  UIBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

const { PushTemplates } = await import("./PushTemplates");

const openEmail = async () => {
  render(<PushTemplates />);
  const card = (await screen.findByText("Announcements")).closest("[data-wording]") as HTMLElement;
  fireEvent.click(within(card).getByRole("tab", { name: "Email" }));
  return card;
};

beforeEach(() => {
  rewordNotificationEmail.mockReset().mockResolvedValue(wording);
  rewordEmailFrame.mockReset().mockResolvedValue(wording);
});

describe("editing a notification email", () => {
  it("previews the email inside the frame, with sample values", async () => {
    const card = await openEmail();

    expect((within(card).getByLabelText("Announcements email subject") as HTMLInputElement).value).toBe("{title}");
    expect(within(card).getByText(/Hi Dara,/)).toBeTruthy();
  });

  it("flags a placeholder nothing fills as it is typed", async () => {
    const card = await openEmail();

    fireEvent.change(within(card).getByLabelText("Announcements email body"), {
      target: { value: "Hello {learnr}" },
    });

    expect(within(card).getByText(/\{learnr\} isn't a placeholder/)).toBeTruthy();
  });

  it("writes a placeholder in from its chip and saves the email", async () => {
    const card = await openEmail();
    const body = within(card).getByLabelText("Announcements email body") as HTMLTextAreaElement;

    // The cursor goes where a person would leave it: after "Hi ".
    fireEvent.change(body, { target: { value: "Hi  — {message}" } });
    body.focus();
    body.setSelectionRange(3, 3);
    fireEvent.click(within(card).getByRole("button", { name: "{parent}" }));

    await waitFor(() => expect(body.value).toBe("Hi {parent} — {message}"));
    fireEvent.click(within(card).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(rewordNotificationEmail).toHaveBeenCalledWith("system.announcement", {
        subject: "{title}",
        body: "Hi {parent} — {message}",
      }),
    );
  });

  it("will not save a frame that lost its unsubscribe link", async () => {
    render(<PushTemplates />);
    const frame = (await screen.findByLabelText("Footer on updates")).closest("[data-frame]") as HTMLElement;

    fireEvent.change(within(frame).getByLabelText("Footer on updates"), { target: { value: "Bye." } });

    expect((within(frame).getByRole("button", { name: "Save frame" }) as HTMLButtonElement).disabled).toBe(true);
    expect(rewordEmailFrame).not.toHaveBeenCalled();
  });
});
