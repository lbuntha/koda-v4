import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let session: Record<string, unknown> | null = null;
let rights: string[] = [];
const learnerRequest = vi.fn();
const privacy = vi.fn();
const weekly = vi.fn();
const publicWeekly = vi.fn();
const buddies = vi.fn();
const setPrivacy = vi.fn();
const createInvite = vi.fn();
const acceptInvite = vi.fn();
const removeBuddy = vi.fn();
const blockBuddy = vi.fn();

const setCompactViewport = (compact: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: !compact,
      media: "(min-width: 45rem)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

vi.mock("../lib/sync", () => ({
  ApiError: class ApiError extends Error {},
  accessToken: async () => "token",
  request: (...args: unknown[]) => learnerRequest(...args),
  useSession: () => session,
  usePermissions: () => ({ can: (right: string) => rights.includes(right) }),
}));

vi.mock("../lib/leaderboardApi", () => ({
  LeaderboardAPI: {
    privacy: (...args: unknown[]) => privacy(...args),
    weekly: (...args: unknown[]) => weekly(...args),
    publicWeekly: (...args: unknown[]) => publicWeekly(...args),
    buddies: (...args: unknown[]) => buddies(...args),
    setPrivacy: (...args: unknown[]) => setPrivacy(...args),
    createInvite: (...args: unknown[]) => createInvite(...args),
    acceptInvite: (...args: unknown[]) => acceptInvite(...args),
    removeBuddy: (...args: unknown[]) => removeBuddy(...args),
    blockBuddy: (...args: unknown[]) => blockBuddy(...args),
  },
}));

vi.mock("../utils/audio", () => ({ playSound: vi.fn() }));

const { LeaderboardPage } = await import("./LeaderboardPage");

const learner = { id: "l_mia", displayName: "Mia", avatarSeed: "a_mia" };
const privateChoice = {
  learnerId: learner.id,
  sharingEnabled: false,
  visibility: "private",
  nickname: null,
  consentedAt: null,
  revokedAt: null,
};

beforeEach(() => {
  setCompactViewport(false);
  session = { role: "owner", familyId: "f_one" };
  rights = ["learner:read", "leaderboard:consent", "buddy:manage"];
  learnerRequest.mockReset().mockResolvedValue({ learners: [learner] });
  privacy.mockReset().mockResolvedValue(privateChoice);
  weekly.mockReset().mockResolvedValue({
    scope: "buddies",
    sharingEnabled: false,
    weekStart: "2026-09-14",
    weekEnd: "2026-09-20",
    generatedAt: "2026-09-20T10:00:00Z",
    rows: [],
  });
  publicWeekly.mockReset().mockResolvedValue({
    scope: "public",
    sharingEnabled: false,
    weekStart: "2026-09-14",
    weekEnd: "2026-09-20",
    generatedAt: "2026-09-20T10:00:00Z",
    rows: [],
  });
  buddies.mockReset().mockResolvedValue([]);
  setPrivacy.mockReset().mockResolvedValue({ ...privateChoice, sharingEnabled: true });
  createInvite.mockReset();
  acceptInvite.mockReset();
  removeBuddy.mockReset();
  blockBuddy.mockReset();
});

describe("Buddy Leaderboard page", () => {
  it("starts private and requires explicit confirmation before sharing", async () => {
    render(<LeaderboardPage />);

    expect(await screen.findByText("You’re private by default")).toBeTruthy();
    expect(screen.getByText("No email, age, real name, or lesson details")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Buddies only" }));

    const confirm = screen.getByRole("button", { name: "Confirm buddies only" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Leaderboard nickname"), {
      target: { value: "StarFox" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);

    await waitFor(() => expect(setPrivacy).toHaveBeenCalledWith("l_mia", "buddies", "StarFox"));
  });

  it("renders only the safe weekly leaderboard projection", async () => {
    privacy.mockResolvedValue({ ...privateChoice, sharingEnabled: true, visibility: "buddies", nickname: "MathMango" });
    weekly.mockResolvedValue({
      sharingEnabled: true,
      scope: "buddies",
      weekStart: "2026-09-14",
      weekEnd: "2026-09-20",
      generatedAt: "2026-09-20T10:00:00Z",
      rows: [
        { rank: 1, isYou: false, nickname: "StarFox", avatarSeed: null, weeklyXp: 840 },
        { rank: 2, isYou: true, nickname: "MathMango", avatarSeed: "a_mia", weeklyXp: 710 },
      ],
    });
    buddies.mockResolvedValue([
      {
        relationshipId: "bud_opaque",
        nickname: "StarFox",
        avatarSeed: null,
        sharingEnabled: true,
        connectedAt: "2026-09-19T10:00:00Z",
      },
    ]);
    render(<LeaderboardPage />);

    expect(await screen.findByText("840 XP")).toBeTruthy();
    expect(screen.getAllByTitle("Fox avatar")).toHaveLength(2);
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Sharing with 1 buddy")).toBeTruthy();
    expect(document.body.textContent).not.toContain("f_one");
    expect(document.body.textContent).not.toContain("bud_opaque");
  });

  it("shows the public top 20 separately and asks for broader consent", async () => {
    publicWeekly.mockResolvedValue({
      scope: "public",
      sharingEnabled: false,
      weekStart: "2026-09-14",
      weekEnd: "2026-09-20",
      generatedAt: "2026-09-20T10:00:00Z",
      rows: [
        { rank: 1, isYou: false, nickname: "PublicPanda", avatarSeed: null, weeklyXp: 900 },
      ],
    });
    render(<LeaderboardPage />);

    fireEvent.click(await screen.findByRole("tab", { name: "Public" }));
    expect(await screen.findByText("PublicPanda")).toBeTruthy();
    expect(screen.getByText("Viewing only")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Join public leaderboard" }));
    expect(screen.getByText("Any signed-in Koda learner.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirm public sharing" })).toBeTruthy();
  });

  it("lets a managed learner view privacy status without consent controls", async () => {
    session = { role: "child", familyId: "f_one", learnerId: "l_mia" };
    rights = ["learner:read"];
    render(<LeaderboardPage />);

    expect(await screen.findByText("Ask a parent or account owner to turn on sharing.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Buddies only" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create buddy code" })).toBeNull();
    expect(screen.getByText("A parent or account owner manages buddy connections.")).toBeTruthy();
  });

  it("keeps a large buddy list searchable", async () => {
    buddies.mockResolvedValue(
      ["Alpha", "Bravo", "Comet", "Delta", "Echo", "Zebra"].map((nickname, index) => ({
        relationshipId: `relationship_${index}`,
        nickname,
        avatarSeed: null,
        sharingEnabled: true,
        connectedAt: "2026-09-19T10:00:00Z",
      })),
    );
    render(<LeaderboardPage />);

    const search = await screen.findByPlaceholderText("Search buddies");
    fireEvent.change(search, { target: { value: "zeb" } });
    expect(screen.getByText("Zebra")).toBeTruthy();
    expect(screen.queryByText("Alpha")).toBeNull();
  });

  it("switches directly between a small set of learner cards", async () => {
    let resolveJuttaPrivacy!: (value: typeof privateChoice) => void;
    privacy
      .mockResolvedValueOnce(privateChoice)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveJuttaPrivacy = resolve; }));
    learnerRequest.mockResolvedValue({
      learners: [
        learner,
        { id: "l_jutta", displayName: "Jutta", avatarSeed: "a_jutta" },
        { id: "l_thana", displayName: "Thana", avatarSeed: "a_thana" },
      ],
    });
    render(<LeaderboardPage />);

    const jutta = await screen.findByRole("radio", { name: "Jutta" });
    expect(jutta.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(jutta);

    await waitFor(() => expect(jutta.getAttribute("aria-checked")).toBe("true"));
    expect(await screen.findByText("Loading Jutta…")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Jutta" })).toBeTruthy();
    expect(screen.queryByText("Loading buddy leaderboard")).toBeNull();
    await waitFor(() => expect(privacy).toHaveBeenCalledWith("l_jutta", expect.any(AbortSignal)));
    resolveJuttaPrivacy(privateChoice);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("opens buddy management as a dedicated mobile view", async () => {
    setCompactViewport(true);
    render(<LeaderboardPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Manage buddies (0)" }));
    expect(await screen.findByRole("heading", { name: "Manage buddies" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to leaderboard" })).toBeTruthy();
    expect(screen.queryByRole("tab", { name: "Buddies" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to leaderboard" }));
    expect(await screen.findByRole("tab", { name: "Buddies" })).toBeTruthy();
  });
});
