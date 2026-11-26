import { describe, expect, it } from "vitest";
import { lessonInRegion, regionFromCountry } from "./region";
import { viewerForSession, DEFAULT_VIEWER } from "./viewer";
import type { Session } from "../lib/sync/session";

describe("regionFromCountry", () => {
  it("maps the three supported curricula", () => {
    expect(regionFromCountry("US")).toBe("US");
    expect(regionFromCountry("GB")).toBe("GB");
    expect(regionFromCountry("KH")).toBe("KH");
  });

  it("accepts lower case and the common UK alias", () => {
    expect(regionFromCountry("kh")).toBe("KH");
    expect(regionFromCountry("UK")).toBe("GB");
  });

  it("treats every other or missing country as international", () => {
    expect(regionFromCountry("FR")).toBe("INTL");
    expect(regionFromCountry("")).toBe("INTL");
    expect(regionFromCountry(undefined)).toBe("INTL");
    expect(regionFromCountry(null)).toBe("INTL");
  });
});

describe("lessonInRegion", () => {
  it("shows a lesson with no region list to everyone", () => {
    for (const r of ["US", "GB", "KH", "INTL"] as const) {
      expect(lessonInRegion(undefined, r)).toBe(true);
      expect(lessonInRegion([], r)).toBe(true);
    }
  });

  it("shows a limited lesson only in its regions, never to international learners", () => {
    expect(lessonInRegion(["US"], "US")).toBe(true);
    expect(lessonInRegion(["US"], "GB")).toBe(false);
    expect(lessonInRegion(["GB", "KH"], "KH")).toBe(true);
    expect(lessonInRegion(["GB", "KH"], "INTL")).toBe(false);
  });
});

describe("viewer region", () => {
  it("comes from the signed-in country", () => {
    const viewer = viewerForSession({ country: "KH" } as Session, DEFAULT_VIEWER);
    expect(viewer.region).toBe("KH");
  });

  it("falls back to the preview's region when the session has no country", () => {
    const viewer = viewerForSession({} as Session, { ...DEFAULT_VIEWER, region: "US" });
    expect(viewer.region).toBe("US");
  });
});
