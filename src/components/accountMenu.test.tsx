import { describe, expect, it } from "vitest";

import { accountName, accountType } from "./AccountMenu";
import type { Session } from "../lib/sync/session";

/**
 * What the account menu calls an account.
 *
 * A student carries a learner name exactly as a child does — they are their own
 * learner — so the rule that read "has a learner name, therefore Child" put the
 * wrong word under a self-managed account.
 */
const session = (patch: Partial<Session>): Session =>
  ({
    accessToken: "a",
    refreshToken: "r",
    expiresAt: Date.now() + 60_000,
    deviceId: "d",
    role: "owner",
    ...patch,
  }) as Session;

describe("naming an account", () => {
  it("calls a student a student, not a child", () => {
    const student = session({ role: "student", learnerId: "l_1", learnerName: "Jutta" });

    expect(accountType(student)).toBe("Student");
    expect(accountName(student)).toBe("Jutta");
  });

  it("still calls a child a child", () => {
    expect(accountType(session({ role: "child", learnerName: "Mia" }))).toBe("Child");
    expect(accountType(session({ role: "parent", learnerName: "Mia" }))).toBe("Child");
  });

  it("falls back to the role only when nothing else names the account", () => {
    expect(accountName(session({ role: "student" }))).toBe("Student");
    expect(accountName(session({ role: "parent", displayName: "Mr. Ly" }))).toBe("Mr. Ly");
  });
});
