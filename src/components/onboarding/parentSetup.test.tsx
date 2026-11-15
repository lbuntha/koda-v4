import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Parent setup, the two paths a parent takes after adding a child: a code for
 * the child's own device, and opening the child here behind a parent PIN.
 */

const request = vi.fn();
const switchToChild = vi.fn();
const pinSet = vi.fn();
const pinIsSet = vi.fn();

vi.mock("../../lib/sync", () => ({
  ApiError: class ApiError extends Error {},
  accessToken: async () => "token",
  request: (...args: unknown[]) => request(...args),
  SessionAPI: { switchToChild: (...args: unknown[]) => switchToChild(...args) },
  useSession: () => ({ userId: "u1", email: "parent@example.com" }),
}));
vi.mock("../../lib/billing", () => ({ Billing: { refresh: vi.fn(async () => ({})) } }));
let plan = { planName: "Family", learnerLimit: 3, learnersUsed: 0 };
vi.mock("../../lib/useBilling", () => ({ useBilling: () => plan }));
vi.mock("../../lib/familyPin", () => ({
  PIN_LENGTH: 4,
  isWellFormed: (pin: string) => /^\d{4}$/.test(pin),
  FamilyPin: { set: (pin: string) => pinSet(pin), isSet: () => pinIsSet() },
}));
vi.mock("../../lib/push", () => ({
  chooseNotification: vi.fn(),
  enableNotifications: vi.fn(),
  // Nothing to offer: the alerts step should step past itself.
  notificationPreferences: async () => ({ enabled: false, kinds: [], emailEnabled: false }),
  notificationsAreOn: () => false,
  pushSupport: () => ({ state: "unsupported" }),
}));
vi.mock("../../utils/audio", () => ({ playSound: vi.fn() }));

const { ParentSetup } = await import("./ParentSetup");

beforeEach(() => {
  request.mockReset();
  switchToChild.mockReset().mockResolvedValue({});
  pinSet.mockReset().mockResolvedValue(undefined);
  pinIsSet.mockReset().mockResolvedValue(false);
  localStorage.clear();
  plan = { planName: "Family", learnerLimit: 3, learnersUsed: 0 };
});

const addDaraInGrade1 = async () => {
  request.mockResolvedValueOnce({ id: "l1", displayName: "Dara" });
  fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: "Dara" } });
  fireEvent.click(screen.getByRole("button", { name: "Grade 1" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Where will Dara learn?");
};

describe("ParentSetup", () => {
  it("needs a grade before it will add the child, and stores it as an age", async () => {
    render(<ParentSetup onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Child's name"), { target: { value: "Dara" } });
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);

    await addDaraInGrade1();
    expect(request).toHaveBeenCalledWith(
      "/learners",
      expect.objectContaining({
        method: "POST",
        body: { displayName: "Dara", birthYear: new Date().getFullYear() - 6 },
      }),
    );
    expect(localStorage.getItem("koda.parentSetup.seen.u1")).toBe("1");
  });

  it("gives a code and a QR for the child's own device", async () => {
    render(<ParentSetup onClose={vi.fn()} />);
    await addDaraInGrade1();
    request.mockResolvedValueOnce({ code: "ABCD2345", expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    fireEvent.click(screen.getByRole("button", { name: /On their own device/ }));

    expect(await screen.findByText("ABCD2345")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Sign-in code for Dara" })).toBeTruthy();
    expect(request).toHaveBeenLastCalledWith("/learners/l1/join-code", expect.objectContaining({ method: "POST" }));

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("All set!")).toBeTruthy();
  });

  it("sets a parent PIN, then opens the child on this device", async () => {
    const onClose = vi.fn();
    render(<ParentSetup onClose={onClose} />);
    await addDaraInGrade1();
    fireEvent.click(screen.getByRole("button", { name: /On this phone or tablet/ }));

    await screen.findByText("Set a parent PIN");
    fireEvent.change(screen.getByLabelText("New PIN"), { target: { value: "1234" } });
    fireEvent.change(screen.getByLabelText("Type it again"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "Save PIN" }));
    await waitFor(() => expect(pinSet).toHaveBeenCalledWith("1234"));

    fireEvent.click(await screen.findByRole("button", { name: "Start Dara's learning" }));
    await waitFor(() => expect(switchToChild).toHaveBeenCalledWith("l1", "Dara"));
    expect(onClose).toHaveBeenCalled();
  });

  it("says the plan is full instead of offering a child it cannot add", () => {
    plan = { planName: "Free", learnerLimit: 1, learnersUsed: 1 };
    render(<ParentSetup onClose={vi.fn()} />);
    expect(screen.queryByLabelText("Child's name")).toBeNull();
    expect(screen.getByText("The Free plan covers 1 child. Upgrade to add another.")).toBeTruthy();
  });
});
