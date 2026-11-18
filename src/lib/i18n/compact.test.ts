import { describe, expect, it } from "vitest";
import { formatCompact } from "./index";

describe("formatCompact", () => {
  it("keeps small counts whole and shortens from a thousand", () => {
    expect(formatCompact(999, "en")).toBe("999");
    expect(formatCompact(1000, "en")).toBe("1K");
    expect(formatCompact(1786, "en")).toBe("1.8K");
    expect(formatCompact(12500, "en")).toBe("12.5K");
  });
});
