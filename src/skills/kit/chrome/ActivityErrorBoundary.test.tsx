import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { ActivityErrorBoundary } from "./ActivityErrorBoundary";

/**
 * A boundary that does not catch is worse than none — it reads as protection
 * that is not there. These drive a real throw rather than asserting on markup.
 */

const Boom = ({ explode }: { explode: boolean }) => {
  if (explode) throw new Error("activity blew up");
  return <p>lesson running</p>;
};

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // React logs caught errors itself; the noise would drown the run.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("ActivityErrorBoundary", () => {
  it("renders the activity when nothing throws", () => {
    render(
      <ActivityErrorBoundary onExit={() => {}}>
        <Boom explode={false} />
      </ActivityErrorBoundary>,
    );
    expect(screen.getByText("lesson running")).toBeTruthy();
  });

  it("catches a throw instead of unmounting the tree", () => {
    render(
      <ActivityErrorBoundary onExit={() => {}}>
        <Boom explode />
      </ActivityErrorBoundary>,
    );
    expect(screen.getByText("That didn't work")).toBeTruthy();
    // The reassurance matters as much as the catch: a child who thinks their
    // work is gone will not want to start again.
    expect(screen.getByText(/progress is safe/i)).toBeTruthy();
  });

  it("offers a way out, so the message is not a dead end", () => {
    const onExit = vi.fn();
    render(
      <ActivityErrorBoundary onExit={onExit}>
        <Boom explode />
      </ActivityErrorBoundary>,
    );
    fireEvent.click(screen.getByRole("button", { name: /back to lessons/i }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("retries the activity, so a transient failure is not terminal", () => {
    /*
     * The condition is held outside the component and flipped between renders,
     * rather than mutated during one. React may invoke a render more than once,
     * so a component that decides whether to throw by writing to itself is
     * testing React's scheduling rather than this boundary.
     */
    let broken = true;
    const Flaky = () => {
      if (broken) throw new Error("transient");
      return <p>lesson running</p>;
    };

    render(
      <ActivityErrorBoundary onExit={() => {}}>
        <Flaky />
      </ActivityErrorBoundary>,
    );
    expect(screen.getByText("That didn't work")).toBeTruthy();

    // Whatever was wrong has resolved — a loaded asset, a settled race.
    broken = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("lesson running")).toBeTruthy();
  });

  it("logs the failure with the activity that caused it", () => {
    render(
      <ActivityErrorBoundary onExit={() => {}} activityRef="counting/orbit">
        <Boom explode />
      </ActivityErrorBoundary>,
    );
    const logged = consoleError.mock.calls.flat().join(" ");
    expect(logged).toContain("counting/orbit");
  });
});
