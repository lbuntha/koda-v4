import { beforeEach, describe, expect, it } from "vitest";
import { SKIP_DAYS, shouldOfferNotificationSetup, skipNotificationSetup } from "./setupPrompt";

const parent = { userId: "u_parent", role: "owner" };
const askable = { state: "askable" } as const;
const NOW = Date.UTC(2026, 8, 15);
const DAY = 86_400_000;

beforeEach(() => localStorage.clear());

describe("offering notification setup", () => {
  it("asks an adult whose notifications are off", () => {
    expect(shouldOfferNotificationSetup(parent, askable, false, NOW)).toBe(true);
    expect(shouldOfferNotificationSetup(parent, { state: "granted" }, false, NOW)).toBe(true);
    expect(shouldOfferNotificationSetup(parent, { state: "needs-install" }, false, NOW)).toBe(true);
  });

  it("does not ask once they are on", () => {
    expect(shouldOfferNotificationSetup(parent, { state: "granted" }, true, NOW)).toBe(false);
  });

  it("never asks a child", () => {
    expect(shouldOfferNotificationSetup({ ...parent, learnerId: "l_mia" }, askable, false, NOW)).toBe(false);
    expect(shouldOfferNotificationSetup({ userId: "u_kid", role: "child" }, askable, false, NOW)).toBe(false);
    expect(shouldOfferNotificationSetup(null, askable, false, NOW)).toBe(false);
  });

  it("does not ask where saying yes cannot work", () => {
    for (const state of ["denied", "unsupported", "not-configured"] as const) {
      expect(shouldOfferNotificationSetup(parent, { state }, false, NOW)).toBe(false);
    }
  });

  it("keeps away for the skip window, for that account only", () => {
    skipNotificationSetup(parent.userId, NOW);

    expect(shouldOfferNotificationSetup(parent, askable, false, NOW + DAY)).toBe(false);
    expect(shouldOfferNotificationSetup({ userId: "u_other", role: "parent" }, askable, false, NOW)).toBe(true);
    expect(shouldOfferNotificationSetup(parent, askable, false, NOW + (SKIP_DAYS + 1) * DAY)).toBe(true);
  });
});
