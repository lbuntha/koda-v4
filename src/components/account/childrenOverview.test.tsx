import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let session: Record<string, unknown> | null = null;
let rights: string[] = [];
const refresh = vi.fn();

vi.mock("../../lib/sync", () => ({
  useSession: () => session,
  usePermissions: () => ({ can: (right: string) => rights.includes(right) }),
}));

vi.mock("../../lib/childrenOverview", async () => {
  const real = await vi.importActual<typeof import("../../lib/childrenOverview")>("../../lib/childrenOverview");
  return { ...real, refreshChildrenOverview: (userId: string) => refresh(userId) };
});

vi.mock("../../lib/themeSystem", () => ({
  themeSystem: {
    list: { group: "", row: "", rowTitle: "", rowNote: "" },
    card: () => "",
  },
}));

vi.mock("../ui", () => ({
  UIAvatar: () => <span />,
  UIButton: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  UIBanner: ({
    title,
    children,
    action,
  }: {
    title: string;
    children: ReactNode;
    action?: { label: string; onClick: () => void };
  }) => (
    <div role="status">
      <p>{title}</p>
      <p>{children}</p>
      {action && <button onClick={action.onClick}>{action.label}</button>}
    </div>
  ),
}));

const { ChildrenOverview, dayOf } = await import("./ChildrenOverview");

const overview = {
  children: [
    {
      id: "l_mia",
      displayName: "Mia",
      avatarSeed: "s",
      today: { rounds: 5, minutes: 12, goal: 5, goalMet: true },
      streak: 5,
      daysAway: 0,
      daysThisWeek: 4,
    },
    {
      id: "l_leo",
      displayName: "Leo",
      avatarSeed: "s",
      today: { rounds: 0, minutes: 0, goal: 5, goalMet: false },
      streak: 0,
      daysAway: 9,
      daysThisWeek: 0,
    },
  ],
  attention: { learnerId: "l_leo", kind: "learn.absence", title: "Leo hasn't practised in 9 days", body: "A 5-minute round is an easy way back in." },
  generatedAt: "2026-09-15T10:00:00Z",
  absenceDays: 7,
};

beforeEach(() => {
  localStorage.clear();
  session = { userId: "u_parent", role: "owner" };
  rights = ["learner:create"];
  refresh.mockReset().mockResolvedValue({ overview, savedAt: Date.now() });
});

describe("Your children", () => {
  it("shows each child's day and opens a report", async () => {
    const onOpenChild = vi.fn();
    render(<ChildrenOverview onOpenChild={onOpenChild} />);

    expect(await screen.findByText("12 min today")).toBeTruthy();
    expect(screen.getByText("Goal met")).toBeTruthy();
    expect(screen.getByText("5-day streak")).toBeTruthy();
    expect(screen.getByText("Last practised 9 days ago")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open report" }));
    expect(onOpenChild).toHaveBeenCalledWith("l_leo");
  });

  it("draws the last answer when the network does not come back", async () => {
    localStorage.setItem(
      "koda_children_overview_v1",
      JSON.stringify({ userId: "u_parent", savedAt: Date.now() - 3 * 3_600_000, overview }),
    );
    refresh.mockRejectedValue(new Error("offline"));
    render(<ChildrenOverview />);

    expect(screen.getByText("Mia")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Updated 3 h ago")).toBeTruthy());
  });

  it("is not drawn for a child's session", async () => {
    session = { userId: "u_parent", role: "child", learnerId: "l_mia" };
    render(<ChildrenOverview />);

    await Promise.resolve();
    expect(screen.queryByText("Your children")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  /**
   * The first day of a parent's account.
   *
   * This section used to draw nothing for a family with no children, and Home
   * fell through to a learner's empty state — telling a parent to build their
   * own learning list, which is neither what they came for nor what the button
   * under it did.
   */
  it("invites a parent with no children to add their first", async () => {
    const onAddChild = vi.fn();
    refresh.mockResolvedValue({
      overview: { ...overview, children: [], attention: null },
      savedAt: Date.now(),
    });
    render(<ChildrenOverview onAddChild={onAddChild} />);

    expect(await screen.findByText("Add your first child")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add child" }));
    expect(onAddChild).toHaveBeenCalled();
  });

  it("says nothing until it knows whether there are children", async () => {
    // The answer is still in flight and there is no cache. Guessing "none" here
    // greets a parent of three with an invitation to make their first.
    refresh.mockReturnValue(new Promise(() => {}));
    render(<ChildrenOverview onAddChild={vi.fn()} />);

    await Promise.resolve();
    expect(screen.queryByText("Add your first child")).toBeNull();
    expect(screen.queryByText("Your children")).toBeNull();
  });

  it("ignores an old cache whose overview is null", async () => {
    localStorage.setItem(
      "koda_children_overview_v1",
      JSON.stringify({ userId: "u_parent", savedAt: Date.now(), overview: null }),
    );
    refresh.mockReturnValue(new Promise(() => {}));

    expect(() => render(<ChildrenOverview />)).not.toThrow();
    await Promise.resolve();
    expect(screen.queryByText("Your children")).toBeNull();
  });

  it("does not crash when a malformed refresh result reaches the component", async () => {
    refresh.mockResolvedValue({ overview: null, savedAt: Date.now() });

    expect(() => render(<ChildrenOverview />)).not.toThrow();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByText("Your children")).toBeNull();
  });

  it("says a child who never started has not started", () => {
    expect(dayOf({ ...overview.children[1], daysAway: null })).toBe("Hasn't started yet");
    expect(dayOf({ ...overview.children[1], daysAway: 1 })).toBe("Last practised yesterday");
  });
});
