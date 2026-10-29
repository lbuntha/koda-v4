import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { AppErrorBoundary, isChunkLoadError } from "./AppErrorBoundary";

function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("isChunkLoadError", () => {
  it("recognises a page that failed to arrive, in the wording of each browser", () => {
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module: /a.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("x is not a function"))).toBe(false);
  });
});

describe("AppErrorBoundary", () => {
  it("shows a way back instead of a blank screen when a screen throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <Boom message="bad lesson" />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("tries again without reloading for an ordinary error", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = true;
    const Flaky = () => {
      if (fail) throw new Error("once");
      return <p>fine</p>;
    };
    render(
      <AppErrorBoundary>
        <Flaky />
      </AppErrorBoundary>,
    );
    fail = false;
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("fine")).toBeTruthy();
  });
});
