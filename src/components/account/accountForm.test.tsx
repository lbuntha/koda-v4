import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Signing up, for the two people who do it: somebody setting Koda up for their
 * children, and somebody learning on their own.
 *
 * The third assertion is a regression: Google's button used to be re-rendered
 * whenever the form switched tabs, and rebuilding that iframe is the blink a
 * person sees when they press "Create account".
 */

const signUp = vi.fn();

vi.mock("../../lib/sync", () => ({
  ApiError: class ApiError extends Error {},
  SessionAPI: {
    signUp: (email: string, password: string, space: string, type: string) =>
      signUp(email, password, space, type),
    join: vi.fn(),
    signIn: vi.fn(),
    signInWithGoogle: vi.fn(),
    resendVerification: vi.fn(),
  },
  request: vi.fn(),
}));

vi.mock("../../lib/themeSystem", () => ({
  themeSystem: { field: () => "", button: () => "", flash: () => "" },
}));

vi.mock("../../utils/audio", () => ({ playSound: vi.fn() }));

const { AccountForm } = await import("./AccountForm");

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  signUp.mockReset().mockResolvedValue({ accessToken: "a" });
  vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "client-123");
});

afterEach(() => vi.unstubAllEnvs());

describe("creating an account", () => {
  it("creates a parent account by default", async () => {
    render(<AccountForm />);
    fireEvent.click(screen.getByRole("tab", { name: "Create account" }));

    fill("Email", "dara@example.com");
    fill("Password", "correct horse battery");
    fireEvent.change(screen.getByLabelText(/Family or group name/), { target: { value: "The Riveras" } });
    fireEvent.click(screen.getByRole("button", { name: /Create account/ }));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith("dara@example.com", "correct horse battery", "The Riveras", "parent"),
    );
  });

  it("creates a learner's own account, with no family to name", async () => {
    render(<AccountForm />);
    fireEvent.click(screen.getByRole("tab", { name: "Create account" }));
    fireEvent.click(screen.getByRole("tab", { name: "For myself" }));

    expect(screen.queryByLabelText(/Family or group name/)).toBeNull();
    fill("Email", "sam@example.com");
    fill("Password", "correct horse battery");
    fireEvent.click(screen.getByRole("button", { name: /Create account/ }));

    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith("sam@example.com", "correct horse battery", "My learning space", "student"),
    );
  });

  it("keeps Google's button in place when the tab changes", () => {
    const { container } = render(<AccountForm />);
    const before = container.querySelector("[data-google-block]");

    fireEvent.click(screen.getByRole("tab", { name: "Create account" }));

    // The same node, not a new one: re-mounting it rebuilds Google's iframe,
    // which is the flash this test exists to catch.
    expect(container.querySelector("[data-google-block]")).toBe(before);
  });
});
