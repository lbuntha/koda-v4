import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendAnnouncement = vi.fn();

vi.mock("../../lib/push", () => ({
  sendAnnouncement: (draft: unknown, preview: boolean) => sendAnnouncement(draft, preview),
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
}));

const { PushAnnounce } = await import("./PushAnnounce");

const reach = {
  job: "announcement",
  preview: true,
  audience: "everyone",
  families: 2,
  staff: 1,
  people: 3,
  devices: 4,
  sent: 0,
};

const write = (title: string, message: string) => {
  fireEvent.change(screen.getByLabelText("Announcement title"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("Announcement message"), { target: { value: message } });
};

beforeEach(() => sendAnnouncement.mockReset());

describe("announcing", () => {
  it("checks who it reaches first, and sends only on confirm", async () => {
    sendAnnouncement
      .mockResolvedValueOnce(reach)
      .mockResolvedValueOnce({ ...reach, preview: false, devices: undefined, sent: 4 });
    render(<PushAnnounce />);

    write("Holiday", "  Closed Monday. ");
    fireEvent.click(screen.getByRole("radio", { name: /Everyone/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send…" }));

    const confirm = await screen.findByRole("button", { name: "Send to 3 people" });
    const draft = { title: "Holiday", message: "Closed Monday.", audience: "everyone", email: false };
    expect(sendAnnouncement).toHaveBeenCalledWith(draft, true);
    expect(screen.getByText(/2 families and 1 member of staff, with 4 browsers/)).toBeTruthy();

    fireEvent.click(confirm);

    expect(await screen.findByText(/Sent to 3 people, and 4 browsers rang/)).toBeTruthy();
    expect(sendAnnouncement).toHaveBeenLastCalledWith(draft, false);
    expect((screen.getByLabelText("Announcement message") as HTMLTextAreaElement).value).toBe("");
  });

  it("sends by email too when asked, and counts the addresses", async () => {
    sendAnnouncement.mockResolvedValueOnce({ ...reach, emails: 2 });
    render(<PushAnnounce />);

    write("", "Closed Monday.");
    fireEvent.click(screen.getByLabelText("Also send by email"));
    fireEvent.click(screen.getByRole("button", { name: "Send…" }));

    expect(await screen.findByText(/and 2 verified email addresses/)).toBeTruthy();
    expect(sendAnnouncement).toHaveBeenCalledWith(
      { title: "", message: "Closed Monday.", audience: "families", email: true },
      true,
    );
  });

  it("withdraws the count when the message changes after checking", async () => {
    sendAnnouncement.mockResolvedValueOnce(reach);
    render(<PushAnnounce />);

    write("", "Closed Monday.");
    fireEvent.click(screen.getByRole("button", { name: "Send…" }));
    await screen.findByRole("button", { name: "Send to 3 people" });

    write("", "Closed Tuesday.");

    expect(screen.queryByRole("button", { name: "Send to 3 people" })).toBeNull();
    expect(sendAnnouncement).toHaveBeenCalledTimes(1);
  });

  it("says why nothing can be sent", async () => {
    sendAnnouncement.mockResolvedValueOnce({ ...reach, skipped: "announcements are switched off" });
    render(<PushAnnounce />);

    write("", "Closed Monday.");
    fireEvent.click(screen.getByRole("button", { name: "Send…" }));

    expect(await screen.findByText(/Nothing can be sent: announcements are switched off/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Send to/ })).toBeNull();
  });

  it("does not offer to send an empty message", () => {
    render(<PushAnnounce />);
    write("Title only", "   ");

    expect((screen.getByRole("button", { name: "Send…" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
