import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one question every paid surface asks.
 *
 * Worth pinning because it is the difference between a family being *told* and
 * a family being *refused*: covered runs the action, uncovered runs nothing and
 * raises the prompt instead — and never both.
 */

const has = vi.fn();
vi.mock("./billing", () => ({
  AI_FEATURE: "ai.koda",
  Billing: { has: (f: string) => has(f) },
}));

const aiHelpEnabled = vi.fn();
vi.mock("./childSettings", () => ({
  ChildSettingsAPI: { current: () => ({ aiHelpEnabled: aiHelpEnabled() }) },
}));

const mod = async () => await import("./featureGate");

beforeEach(() => {
  vi.resetModules();
  has.mockReset();
  aiHelpEnabled.mockReset().mockReturnValue(true);
});

describe("asking for a feature", () => {
  it("runs the action when the plan covers it, and raises nothing", async () => {
    has.mockReturnValue(true);
    const { requireFeature, FeatureGate } = await mod();
    const action = vi.fn();

    expect(requireFeature("ai.koda", action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(FeatureGate.pending()).toBeNull();
  });

  it("does not run the action when it does not, and says which feature", async () => {
    has.mockReturnValue(false);
    const { requireFeature, FeatureGate } = await mod();
    const action = vi.fn();

    expect(requireFeature("ai.koda", action)).toBe(false);
    expect(action).not.toHaveBeenCalled();
    expect(FeatureGate.pending()).toBe("ai.koda");
  });

  it("tells the app to redraw when a gate is hit and when it is dismissed", async () => {
    has.mockReturnValue(false);
    const { requireFeature, FeatureGate } = await mod();
    let told = 0;
    const stop = FeatureGate.subscribe(() => (told += 1));

    requireFeature("ai.koda", () => undefined);
    expect(told).toBe(1);

    FeatureGate.dismiss();
    expect(told).toBe(2);
    expect(FeatureGate.pending()).toBeNull();
    stop();
  });

  it("asks the plan every time rather than remembering the answer", async () => {
    // A grant lands mid-session; the next tap has to notice.
    has.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { requireFeature } = await mod();
    const action = vi.fn();

    expect(requireFeature("ai.koda", action)).toBe(false);
    expect(requireFeature("ai.koda", action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe("asking Koda for help", () => {
  /**
   * Two people can say no, for two different reasons, and a child has to be
   * told which — "upgrade your plan" is both wrong and unactionable when the
   * answer is that their mother switched it off.
   */
  it("runs when the plan covers it and the grown-up left it on", async () => {
    has.mockReturnValue(true);
    aiHelpEnabled.mockReturnValue(true);
    const { requireKodaHelp, FeatureGate } = await mod();
    const action = vi.fn();

    expect(requireKodaHelp(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(FeatureGate.pending()).toBeNull();
    expect(FeatureGate.withheld()).toBeNull();
  });

  it("stops, and says it was withheld, when the grown-up switched it off", async () => {
    has.mockReturnValue(true);
    aiHelpEnabled.mockReturnValue(false);
    const { requireKodaHelp, FeatureGate } = await mod();
    const action = vi.fn();

    // False: the plan said yes, the grown-up said no, and it did not run.
    expect(requireKodaHelp(action)).toBe(false);
    expect(action).not.toHaveBeenCalled();
    expect(FeatureGate.withheld()).toBe("ai.koda");
    // Not a plan problem, so the upgrade prompt must stay shut.
    expect(FeatureGate.pending()).toBeNull();
  });

  it("blames the plan first when the family does not have it at all", async () => {
    // Both say no. The plan is the outer constraint — a family without the
    // feature has nothing for a parent to have switched off — so a price is
    // the honest answer here and a parent's switch is not.
    has.mockReturnValue(false);
    aiHelpEnabled.mockReturnValue(false);
    const { requireKodaHelp, FeatureGate } = await mod();
    const action = vi.fn();

    requireKodaHelp(action);

    expect(action).not.toHaveBeenCalled();
    expect(FeatureGate.pending()).toBe("ai.koda");
    expect(FeatureGate.withheld()).toBeNull();
  });

  it("redraws when help is withheld, and clears on dismiss", async () => {
    has.mockReturnValue(true);
    aiHelpEnabled.mockReturnValue(false);
    const { requireKodaHelp, FeatureGate } = await mod();
    let told = 0;
    const stop = FeatureGate.subscribe(() => (told += 1));

    requireKodaHelp(() => undefined);
    expect(told).toBe(1);

    FeatureGate.dismiss();
    expect(FeatureGate.withheld()).toBeNull();
    expect(told).toBe(2);
    stop();
  });

  it("asks the grown-up's switch every time rather than remembering it", async () => {
    // A parent turns it back on from their phone; the next tap has to notice.
    has.mockReturnValue(true);
    aiHelpEnabled.mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { requireKodaHelp } = await mod();
    const action = vi.fn();

    // False because it did not run — not because the plan refused, which it
    // did not. That distinction is what the return value means.
    expect(requireKodaHelp(action)).toBe(false);
    expect(action).not.toHaveBeenCalled();

    expect(requireKodaHelp(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
