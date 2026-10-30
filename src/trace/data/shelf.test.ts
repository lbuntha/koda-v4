import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ fetchBundle: vi.fn(), fetchShelf: vi.fn(), sendReport: vi.fn() }));
vi.mock("../../library/photos", () => ({ isPhoto: () => false, photoUrl: vi.fn() }));

import { TraceShelf } from "./shelf";

describe("TraceShelf.read", () => {
  it("hands back the same parsed shelf every time, not a fresh parse per render", () => {
    expect(TraceShelf.read()).toBe(TraceShelf.read());
  });
});
