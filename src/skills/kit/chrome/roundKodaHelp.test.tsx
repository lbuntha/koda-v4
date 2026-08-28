import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Koda, on the one screen a child is actually stuck on.
 *
 * The round used to be the only place with no help: the bar's button sat behind
 * a prop no skill ever passed, and the floating Ask Koda button is deliberately
 * hidden mid-round because it would cover the activity. So nothing offered it.
 *
 * What the *gate* decides is pinned in `lib/koda.test.ts`. What this pins is
 * that the bar asks it at all, and opens the half a tap is meant to open:
 * talking wherever the deployment runs it, writing where it does not, and
 * nothing at all when it runs neither — the case where drawing a button would
 * promise what no plan could deliver.
 */

const offered = vi.fn();
const ask = vi.fn();
vi.mock("../../../lib/useKoda", () => ({
  useKoda: () => ({
    access: (capability: string) => ({
      allowed: offered(capability),
      blockedBy: null,
      offered: offered(capability),
    }),
    allows: (capability: string) => offered(capability),
    ask: (capability: string, action: () => void) => ask(capability, action),
    // The real `preferredKodaMode`: voice wherever the deployment runs it.
    mode: offered("voice") ? "voice" : offered("chat") ? "chat" : null,
  }),
}));

// Heavy and not what this is about: one opens a live socket, the other fetches.
vi.mock("../../../components/KodaAskModal", () => ({ KodaAskModal: () => null }));
vi.mock("../../../components/LiveVoiceCoachModal", () => ({ LiveVoiceCoachModal: () => null }));

import { createFakeKoda } from "../testing/fakeKoda";
import { SkillRoundTopBar } from "./SkillRoundTopBar";

const drawBar = () =>
  render(
    <SkillRoundTopBar
      koda={createFakeKoda().sdk}
      title="Counting to ten"
      questionIndex={2}
      totalQuestions={5}
      onExit={() => undefined}
    />,
  );

/** The bar draws the same control twice — one per breakpoint. */
const askButtons = () => screen.queryAllByLabelText("Ask Koda about this question");

/** Every capability this deployment runs. */
const running = (...capabilities: string[]) =>
  offered.mockImplementation((capability: string) => capabilities.includes(capability));

beforeEach(() => {
  offered.mockReset();
  ask.mockReset();
});

afterEach(cleanup);

describe("asking Koda from inside a round", () => {
  it("offers help without the skill wiring anything", () => {
    running("chat", "voice");
    drawBar();
    expect(askButtons().length).toBeGreaterThan(0);
  });

  it("opens the spoken coach when both are on — the same tap as everywhere else", () => {
    running("chat", "voice");
    drawBar();
    fireEvent.click(askButtons()[0]);
    expect(ask).toHaveBeenCalledWith("voice", expect.any(Function));
  });

  it("falls to writing where a deployment has switched the voice coach off", () => {
    running("chat");
    drawBar();
    fireEvent.click(askButtons()[0]);
    expect(ask).toHaveBeenCalledWith("chat", expect.any(Function));
  });

  it("draws nothing when this deployment runs neither", () => {
    running();
    drawBar();
    expect(askButtons()).toHaveLength(0);
  });
});
