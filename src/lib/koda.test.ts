import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who says no, and what the app does about it.
 *
 * Three people can stop Koda for three different reasons, and the order they
 * are asked in is a product decision, not an implementation detail: a
 * deployment that does not run the feature must leave no button behind, while a
 * plan or a parent saying no leaves the button and explains. Getting the order
 * wrong shows a child an upgrade prompt for something nobody could buy.
 */

const allows = vi.fn();
vi.mock("./sync", () => ({ System: { allows: (id: string) => allows(id) } }));

const has = vi.fn();
vi.mock("./billing", () => ({
  AI_FEATURE: "ai.koda",
  Billing: { has: (f: string) => has(f) },
}));

const aiHelpEnabled = vi.fn();
vi.mock("./childSettings", () => ({
  ChildSettingsAPI: { current: () => ({ aiHelpEnabled: aiHelpEnabled() }) },
}));

const mod = async () => await import("./koda");

/** Every switch on, so each test can turn off exactly the one it is about. */
const everythingOn = () => {
  allows.mockReturnValue(true);
  has.mockReturnValue(true);
  aiHelpEnabled.mockReturnValue(true);
};

beforeEach(() => {
  vi.resetModules();
  allows.mockReset();
  has.mockReset();
  aiHelpEnabled.mockReset();
  everythingOn();
});

describe("what a capability is allowed to do", () => {
  it("allows a capability when all three agree", async () => {
    const { kodaAccess } = await mod();
    expect(kodaAccess("chat")).toEqual({ allowed: true, blockedBy: null, offered: true });
  });

  it("offers nothing when the deployment does not run it", async () => {
    allows.mockImplementation((id: string) => id !== "ai.chat");
    const { kodaAccess } = await mod();

    const chat = kodaAccess("chat");
    expect(chat.allowed).toBe(false);
    expect(chat.blockedBy).toBe("deployment");
    // The whole point: no button, because there is nothing to explain.
    expect(chat.offered).toBe(false);
    // And only that capability — the others are untouched.
    expect(kodaAccess("voice").allowed).toBe(true);
  });

  it("takes every capability with it when the master switch is off", async () => {
    allows.mockImplementation((id: string) => id !== "ai.enabled");
    const { kodaAccess } = await mod();

    for (const capability of ["chat", "voice", "speech", "whiteboard"] as const) {
      expect(kodaAccess(capability).offered).toBe(false);
    }
  });

  it("keeps offering it when the plan is what says no", async () => {
    has.mockReturnValue(false);
    const { kodaAccess } = await mod();

    expect(kodaAccess("chat")).toEqual({ allowed: false, blockedBy: "plan", offered: true });
  });

  it("names the parent, not the plan, when a family has paid and switched it off", async () => {
    aiHelpEnabled.mockReturnValue(false);
    const { kodaAccess } = await mod();

    // Different person, different remedy — telling this child to upgrade would
    // be both wrong and unactionable.
    expect(kodaAccess("chat")).toEqual({ allowed: false, blockedBy: "parent", offered: true });
  });

  it("asks the deployment before the plan", async () => {
    allows.mockReturnValue(false);
    has.mockReturnValue(false);
    const { kodaAccess } = await mod();

    expect(kodaAccess("voice").blockedBy).toBe("deployment");
  });
});

describe("which way of asking a tap opens", () => {
  /*
   * The two panels cost very different amounts. The written one is a request
   * and a reply; the voice coach holds a socket open and streams audio both
   * ways for as long as it is on screen. A tap used to open the expensive one
   * unconditionally, so a child who only wanted to type paid for a spoken
   * session before saying a word.
   *
   * Which is *first* is therefore an operator's decision, and `ai.voiceFirst`
   * is where they make it. Neither is out of reach: each panel is one tap from
   * the other.
   */
  it("opens the written panel by default, and voice is one tap in", async () => {
    allows.mockImplementation((id: string) => id !== "ai.voiceFirst");
    const { preferredKodaMode } = await mod();

    expect(preferredKodaMode()).toBe("chat");
  });

  it("opens the spoken coach when the operator asks for it", async () => {
    allows.mockReturnValue(true);
    const { preferredKodaMode } = await mod();

    expect(preferredKodaMode()).toBe("voice");
  });

  it("falls to writing when the voice coach is switched off", async () => {
    allows.mockImplementation((id: string) => id !== "ai.liveVoice");
    const { preferredKodaMode } = await mod();
    expect(preferredKodaMode()).toBe("chat");
  });

  it("still opens the voice coach when writing is the switched-off one", async () => {
    // The preference only chooses between two open doors. With chat off there
    // is nothing to choose, and honouring it would offer a panel that is not
    // running.
    allows.mockImplementation((id: string) => id !== "ai.chat" && id !== "ai.voiceFirst");
    const { preferredKodaMode } = await mod();

    expect(preferredKodaMode()).toBe("voice");
  });

  it("offers nothing at all when the deployment runs neither", async () => {
    allows.mockImplementation((id: string) => id !== "ai.liveVoice" && id !== "ai.chat");
    const { preferredKodaMode } = await mod();
    expect(preferredKodaMode()).toBeNull();
  });

  it("is the deployment's answer alone — an unpaid plan still opens a panel", async () => {
    allows.mockReturnValue(true);
    has.mockReturnValue(false);
    aiHelpEnabled.mockReturnValue(false);
    const { preferredKodaMode } = await mod();
    // Those two decide whether it *opens*, never which one was going to.
    expect(preferredKodaMode()).toBe("voice");
  });
});

describe("asking Koda to do something", () => {
  it("runs the action when it may", async () => {
    const { askKoda } = await mod();
    const action = vi.fn();

    expect(askKoda("voice", action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("runs nothing and explains nothing when the deployment does not run it", async () => {
    allows.mockReturnValue(false);
    const { askKoda } = await mod();
    const { FeatureGate } = await import("./featureGate");
    const action = vi.fn();

    expect(askKoda("voice", action)).toBe(false);
    expect(action).not.toHaveBeenCalled();
    expect(FeatureGate.pending()).toBeNull();
  });

  it("runs nothing and raises the upgrade prompt when the plan does not cover it", async () => {
    has.mockReturnValue(false);
    const { askKoda } = await mod();
    const { FeatureGate } = await import("./featureGate");
    const action = vi.fn();

    expect(askKoda("voice", action)).toBe(false);
    expect(action).not.toHaveBeenCalled();
    expect(FeatureGate.pending()).toBe("ai.koda");
  });
});
