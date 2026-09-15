import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let session: Record<string, unknown> | null = null;
let support = { state: "askable" };
let on = false;

vi.mock("../../lib/sync", () => ({ useSession: () => session }));

vi.mock("../../lib/push", () => ({
  pushSupport: () => support,
  notificationsAreOn: () => on,
}));

vi.mock("../../lib/themeSystem", () => ({
  themeSystem: { button: () => "" },
}));

vi.mock("../ui", () => ({
  UIModal: ({
    isOpen,
    title,
    backdrop,
    children,
  }: {
    isOpen: boolean;
    title: string;
    backdrop?: string;
    children: ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title} data-backdrop={backdrop}>
        {children}
      </div>
    ) : null,
}));

const { NotificationSetupPrompt } = await import("./NotificationSetupPrompt");

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  localStorage.clear();
  session = { userId: "u_parent", role: "owner" };
  support = { state: "askable" };
  on = false;
});

describe("the notification setup card", () => {
  it("asks on load, and Set up goes to the switch", async () => {
    const onSetUp = vi.fn();
    render(<NotificationSetupPrompt onSetUp={onSetUp} delayMs={0} />);

    const dialog = await screen.findByRole("dialog", { name: "Turn on notifications?" });
    // Nothing dimmed behind it: it is a suggestion, not a form.
    expect(dialog.getAttribute("data-backdrop")).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Set up" }));

    expect(onSetUp).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays away after Skip, even on the next launch", async () => {
    const first = render(<NotificationSetupPrompt onSetUp={vi.fn()} delayMs={0} />);
    fireEvent.click(await screen.findByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    first.unmount();

    render(<NotificationSetupPrompt onSetUp={vi.fn()} delayMs={0} />);
    await settle();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape skips it", async () => {
    render(<NotificationSetupPrompt onSetUp={vi.fn()} delayMs={0} />);
    await screen.findByRole("dialog");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not ask when notifications are already on", async () => {
    on = true;
    render(<NotificationSetupPrompt onSetUp={vi.fn()} delayMs={0} />);
    await settle();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not ask a child", async () => {
    session = { userId: "u_parent", role: "owner", learnerId: "l_mia" };
    render(<NotificationSetupPrompt onSetUp={vi.fn()} delayMs={0} />);
    await settle();

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits until a lesson is over", async () => {
    const view = render(<NotificationSetupPrompt onSetUp={vi.fn()} suppressed delayMs={0} />);
    await settle();
    expect(screen.queryByRole("dialog")).toBeNull();

    view.rerender(<NotificationSetupPrompt onSetUp={vi.fn()} delayMs={0} />);

    expect(await screen.findByRole("dialog")).toBeTruthy();
  });
});
