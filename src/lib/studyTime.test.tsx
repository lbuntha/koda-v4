import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import React from "react";

/**
 * The daily study limit, end to end.
 *
 * `sessionTime.test.ts` pins the arithmetic. This pins the *rule* — the three
 * moving parts that have to agree before a parent's decision reaches a child:
 *
 *   1. the clock, which spends time only while a round is actually being played
 *   2. the gate, which reads the parent's cap against that clock
 *   3. the screen the child is shown once it closes
 *
 * All three ran untested before, because the gate lived as four lines inside
 * `App` and nothing could mount `App`. Every assertion here is about behaviour a
 * parent would describe: "she gets twenty minutes", "reading the menu does not
 * count", "I raised it and it let her back in".
 */

const recordDoc = vi.fn();
vi.mock("./sync", async () => {
  const kinds = await vi.importActual<typeof import("./sync/kinds")>("./sync/kinds");
  return {
    storageKeyFor: kinds.storageKeyFor,
    SyncEngine: { recordDoc: (...args: unknown[]) => recordDoc(...args) },
  };
});

/** One child on this device, so the clock and the cap key to the same learner. */
vi.mock("./learnerProgress", () => ({ currentLearnerId: () => "l_mia" }));

const load = async () => {
  const sessionTime = await import("./sessionTime");
  const { ChildSettingsAPI } = await import("./childSettings");
  return { ...sessionTime, ChildSettingsAPI };
};

type Loaded = Awaited<ReturnType<typeof load>>;

beforeEach(() => {
  vi.resetModules();
  recordDoc.mockClear();
  localStorage.clear();
  showTab("visible");
});

afterEach(() => {
  vi.useRealTimers();
});

/** jsdom has no real tab, so the one thing the clock asks about is set here. */
const showTab = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
};

/**
 * Start a fake clock at a fixed, boring moment.
 *
 * Vitest's fake timers move `Date` along with them, and these tests advance the
 * clock by up to half an hour. Run late enough in the real day, that crosses the
 * learning-day boundary mid-test: the tally is written against one day and read
 * against the next, and comes back zero.
 *
 * It is not hypothetical. CI ran at 23:30:54Z, the "tablet lying face down" test
 * advanced 31 minutes into the next day, and a green suite went red on a change
 * that had nothing to do with it — the flake was in the test, and it had been
 * waiting since the test was written for CI to run late enough to find it.
 *
 * Mid-morning, mid-month: no boundary within reach of anything here.
 */
const FIXED_NOW = new Date("2026-05-14T09:00:00.000Z");

const useClock = () => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
};

/** Play for `minutes`, the way the clock actually banks it: one tick at a time. */
const play = (mod: Loaded, minutes: number) => {
  const ticks = Math.round((minutes * 60_000) / mod.TICK_MS);
  act(() => {
    vi.advanceTimersByTime(ticks * mod.TICK_MS);
  });
};

describe("the clock only counts time a child actually spends playing", () => {
  const Round: React.FC<{ open: boolean; clock: Loaded["useSessionClock"] }> = ({
    open,
    clock,
  }) => {
    clock(open);
    return null;
  };

  it("spends nothing while no round is open", async () => {
    const mod = await load();
    useClock();
    render(<Round open={false} clock={mod.useSessionClock} />);

    play(mod, 30);

    // Reading the lesson picker, or the menu, or a report is not study time.
    expect(mod.SessionTimeAPI.spentToday()).toBe(0);
  });

  it("banks the minutes a round is open", async () => {
    const mod = await load();
    useClock();
    render(<Round open clock={mod.useSessionClock} />);

    play(mod, 5);

    expect(mod.SessionTimeAPI.spentToday()).toBe(5);
  });

  it("stops the moment the round closes", async () => {
    const mod = await load();
    useClock();
    const view = render(<Round open clock={mod.useSessionClock} />);

    play(mod, 2);
    view.rerender(<Round open={false} clock={mod.useSessionClock} />);
    play(mod, 20);

    expect(mod.SessionTimeAPI.spentToday()).toBe(2);
  });

  it("does not spend a child's day on a tablet lying face down", async () => {
    const mod = await load();
    useClock();
    render(<Round open clock={mod.useSessionClock} />);

    play(mod, 1);
    showTab("hidden");
    play(mod, 30);

    expect(mod.SessionTimeAPI.spentToday()).toBe(1);
  });
});

describe("the gate reads the parent's cap against that clock", () => {
  /** Renders the gate and reports it, the way `App` consumes it. */
  const Gate: React.FC<{ use: Loaded["useStudyGate"] }> = ({ use }) => {
    const gate = use();
    return (
      <div>
        <span data-testid="done">{String(gate.dayDone)}</span>
        <span data-testid="left">{String(gate.left)}</span>
        <span data-testid="cap">{String(gate.cap)}</span>
        <span data-testid="asleep">{String(gate.outsideHours)}</span>
        <span data-testid="closed">{String(gate.closed)}</span>
      </div>
    );
  };

  const gateFor = async (setup: (mod: Loaded) => void) => {
    const mod = await load();
    setup(mod);
    render(<Gate use={mod.useStudyGate} />);
    return mod;
  };

  const done = () => screen.getByTestId("done").textContent;
  const left = () => screen.getByTestId("left").textContent;

  it("never closes on a child whose grown-up set no cap", async () => {
    await gateFor((mod) => mod.SessionTimeAPI.record(4 * 3600));

    expect(done()).toBe("false");
    expect(left()).toBe("null");
  });

  it("stays open right up to the last minute the parent allowed", async () => {
    await gateFor((mod) => {
      mod.ChildSettingsAPI.set("l_mia", { sessionMinutes: 15 });
      mod.SessionTimeAPI.record(14 * 60);
    });

    expect(done()).toBe("false");
    expect(left()).toBe("1");
  });

  it("closes exactly on the minute the parent named", async () => {
    await gateFor((mod) => {
      mod.ChildSettingsAPI.set("l_mia", { sessionMinutes: 15 });
      mod.SessionTimeAPI.record(15 * 60);
    });

    expect(done()).toBe("true");
    expect(left()).toBe("0");
  });

  it("closes while the child is sitting there, as the clock runs out", async () => {
    const mod = await gateFor((m) => {
      m.ChildSettingsAPI.set("l_mia", { sessionMinutes: 20 });
      m.SessionTimeAPI.record(19 * 60);
    });
    expect(done()).toBe("false");

    // The clock's next tick, arriving mid-round.
    act(() => mod.SessionTimeAPI.record(60));

    expect(done()).toBe("true");
  });

  it("lets a child back in when their parent raises the cap from another device", async () => {
    const mod = await gateFor((m) => {
      m.ChildSettingsAPI.set("l_mia", { sessionMinutes: 15 });
      m.SessionTimeAPI.record(15 * 60);
    });
    expect(done()).toBe("true");

    // What sync does when a grown-up changes their mind on their phone.
    act(() => {
      mod.ChildSettingsAPI.set("l_mia", { sessionMinutes: 30 });
    });

    expect(done()).toBe("false");
    expect(left()).toBe("15");
  });

  it("gives the day back tomorrow", async () => {
    const mod = await gateFor((m) => {
      m.ChildSettingsAPI.set("l_mia", { sessionMinutes: 15 });
      m.SessionTimeAPI.record(15 * 60);
    });
    expect(done()).toBe("true");

    // The morning reading of a tally written yesterday.
    act(() => mod.SessionTimeAPI.reset());

    expect(done()).toBe("false");
  });
});

describe("a parent's twenty minutes, from the setting to the child's screen", () => {
  it("plays out end to end", async () => {
    const mod = await load();
    useClock();

    // 1. The grown-up sets it, on the Learners page.
    mod.ChildSettingsAPI.set("l_mia", { sessionMinutes: 20 });
    expect(recordDoc).toHaveBeenCalledWith(
      "childSettings",
      "l_mia",
      expect.objectContaining({ sessionMinutes: 20 }),
      { learnerId: "l_mia" },
    );

    // 2. The child plays. `App` opens the clock for exactly as long as a round is.
    const Round: React.FC<{ open: boolean }> = ({ open }) => {
      mod.useSessionClock(open);
      const gate = mod.useStudyGate();
      return gate.dayDone && gate.cap !== null ? (
        <DayDone cap={gate.cap} />
      ) : (
        <span>lesson</span>
      );
    };
    const { DayDoneScreen } = await import("../components/DayDoneScreen");
    const DayDone: React.FC<{ cap: number }> = ({ cap }) => <DayDoneScreen cap={cap} />;

    const view = render(<Round open />);
    play(mod, 19);
    expect(view.container.textContent).toContain("lesson");

    // 3. The twentieth minute lands, and the door closes under them.
    play(mod, 1);
    expect(screen.getByText(/That.s it for today/i)).toBeTruthy();

    // 4. The child is told the rule, in the number their grown-up picked.
    expect(screen.getByText(/20 minutes of Koda today/i)).toBeTruthy();
  });
});

describe("the screen a child is shown when their time is up", () => {
  it("names the number the parent set, and says whose rule it is", async () => {
    const { DayDoneScreen } = await import("../components/DayDoneScreen");
    render(<DayDoneScreen cap={45} />);

    expect(screen.getByText(/45 minutes of Koda today/i)).toBeTruthy();
    expect(screen.getByText(/grown-up picked that/i)).toBeTruthy();
  });

  it("keeps what the child earned, and offers no way back into a lesson", async () => {
    const { DayDoneScreen } = await import("../components/DayDoneScreen");
    render(<DayDoneScreen cap={30} onGoHome={() => {}} />);

    expect(screen.getByText(/Everything you earned today is saved/i)).toBeTruthy();
    // A cap with a "five more minutes" button a child can reach is not a cap.
    const ways = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(ways).toEqual(["Back home"]);
  });
});

/**
 * The hours half of the rule: *when*, as against how long.
 *
 * `FIXED_NOW` above is 09:00Z, which is not 9am everywhere, so nothing here
 * leans on it — each test sets the wall clock it means with a local-time string.
 * The predicate reads `getHours()`, which is the point: a bedtime is what the
 * clock in the hall says, not what UTC says.
 */
describe("the hours a grown-up opens Koda for", () => {
  const at = (local: string) => new Date(local);

  it("is open all day and all night when nobody set a window", async () => {
    const { withinAllowedHours } = await load();

    expect(withinAllowedHours(null, at("2026-05-14T03:00:00"))).toBe(true);
    expect(withinAllowedHours(null, at("2026-05-14T23:59:00"))).toBe(true);
  });

  it("opens on the hour the parent named and shuts on the stroke of the other", async () => {
    const { withinAllowedHours } = await load();
    const school = { from: 7, to: 20 };

    // The minute before opening, and the first minute open.
    expect(withinAllowedHours(school, at("2026-05-14T06:59:00"))).toBe(false);
    expect(withinAllowedHours(school, at("2026-05-14T07:00:00"))).toBe(true);
    // The last minute open, and the stroke of eight: `to` is when it shuts.
    expect(withinAllowedHours(school, at("2026-05-14T19:59:00"))).toBe(true);
    expect(withinAllowedHours(school, at("2026-05-14T20:00:00"))).toBe(false);
  });

  it("shuts a child out at eleven at night, which is the whole reason it exists", async () => {
    const { withinAllowedHours } = await load();

    expect(withinAllowedHours({ from: 7, to: 20 }, at("2026-05-14T23:00:00"))).toBe(false);
    expect(withinAllowedHours({ from: 7, to: 20 }, at("2026-05-14T02:00:00"))).toBe(false);
  });

  it("carries a window over midnight for a household that meant it", async () => {
    const { withinAllowedHours } = await load();
    const evening = { from: 20, to: 7 };

    expect(withinAllowedHours(evening, at("2026-05-14T21:00:00"))).toBe(true);
    expect(withinAllowedHours(evening, at("2026-05-14T00:30:00"))).toBe(true);
    expect(withinAllowedHours(evening, at("2026-05-14T06:59:00"))).toBe(true);
    // And is shut in the middle of the day, which is what wrapping means.
    expect(withinAllowedHours(evening, at("2026-05-14T12:00:00"))).toBe(false);
  });

  it("says the hour the way a grown-up would", async () => {
    const { hourLabel } = await load();

    expect(hourLabel(0)).toBe("midnight");
    expect(hourLabel(12)).toBe("noon");
    expect(hourLabel(7)).toBe("7 AM");
    expect(hourLabel(20)).toBe("8 PM");
  });
});

describe("the gate, reading the hours against the wall clock", () => {
  /** The gate as the door sees it, at a named local time. */
  const gateAt = async (local: string, setup: (mod: Loaded) => void) => {
    const mod = await load();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(local));
    setup(mod);
    return mod.studyGateNow();
  };

  it("is open, with no cap spent and no window set", async () => {
    const gate = await gateAt("2026-05-14T23:00:00", () => {});

    expect(gate.outsideHours).toBe(false);
    expect(gate.closed).toBe(false);
  });

  it("closes at bedtime even though not a minute has been spent", async () => {
    const gate = await gateAt("2026-05-14T21:30:00", (m) => {
      m.ChildSettingsAPI.set("l_mia", { allowedHours: { from: 7, to: 20 } });
    });

    expect(gate.outsideHours).toBe(true);
    expect(gate.closed).toBe(true);
    // The other rule has not fired, and the child must be told which did.
    expect(gate.dayDone).toBe(false);
  });

  it("opens again in the morning with nothing else changing", async () => {
    const gate = await gateAt("2026-05-15T08:00:00", (m) => {
      m.ChildSettingsAPI.set("l_mia", { allowedHours: { from: 7, to: 20 } });
    });

    expect(gate.outsideHours).toBe(false);
    expect(gate.closed).toBe(false);
  });

  it("reports both reasons when both are true, and keeps them apart", async () => {
    const gate = await gateAt("2026-05-14T21:30:00", (m) => {
      m.ChildSettingsAPI.set("l_mia", {
        sessionMinutes: 15,
        allowedHours: { from: 7, to: 20 },
      });
      m.SessionTimeAPI.record(15 * 60);
    });

    expect(gate.dayDone).toBe(true);
    expect(gate.outsideHours).toBe(true);
    expect(gate.closed).toBe(true);
  });

  it("hands back the window, so the child's screen can name the opening hour", async () => {
    const gate = await gateAt("2026-05-14T21:30:00", (m) => {
      m.ChildSettingsAPI.set("l_mia", { allowedHours: { from: 7, to: 20 } });
    });

    expect(gate.hours).toEqual({ from: 7, to: 20 });
  });

  it("still closes on a spent cap inside the open hours", async () => {
    const gate = await gateAt("2026-05-14T10:00:00", (m) => {
      m.ChildSettingsAPI.set("l_mia", {
        sessionMinutes: 15,
        allowedHours: { from: 7, to: 20 },
      });
      m.SessionTimeAPI.record(15 * 60);
    });

    expect(gate.outsideHours).toBe(false);
    expect(gate.closed).toBe(true);
  });
});

describe("the screen a child is shown when Koda is asleep", () => {
  it("names the hour Koda wakes up rather than only refusing", async () => {
    const { KodaAsleepScreen } = await import("../components/KodaAsleepScreen");
    render(<KodaAsleepScreen opensAt={7} />);

    expect(screen.getByText(/Koda is asleep/i)).toBeTruthy();
    expect(screen.getByText(/wakes up at 7 AM/i)).toBeTruthy();
  });

  it("offers no way back into a lesson", async () => {
    const { KodaAsleepScreen } = await import("../components/KodaAsleepScreen");
    render(<KodaAsleepScreen opensAt={7} onGoHome={() => {}} />);

    const ways = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    expect(ways).toEqual(["Back home"]);
  });
});
