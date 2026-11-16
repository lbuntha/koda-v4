import { describe, expect, it } from "vitest";

import { CONTACT_EMAIL, legalDoc, legalKindOf } from "./legalText";

describe("legal pages", () => {
  it("answers /privacy and /terms, with or without a trailing slash, and nothing else", () => {
    expect(legalKindOf("/privacy")).toBe("privacy");
    expect(legalKindOf("/privacy/")).toBe("privacy");
    expect(legalKindOf("/Terms")).toBe("terms");
    expect(legalKindOf("/")).toBeNull();
    expect(legalKindOf("/privacy/extra")).toBeNull();
  });

  it("has the same sections in Khmer as in English", () => {
    for (const kind of ["privacy", "terms"] as const) {
      const en = legalDoc(kind, "en");
      const km = legalDoc(kind, "km");
      expect(km.title).not.toBe(en.title);
      expect(km.sections.map((s) => s.body.length)).toEqual(en.sections.map((s) => s.body.length));
    }
  });

  it("falls back to English for a language without its own copy", () => {
    expect(legalDoc("privacy", "fr")).toBe(legalDoc("privacy", "en"));
  });

  it("names the support mailbox", () => {
    expect(CONTACT_EMAIL).toBe("support@learnwithkoda.tech");
  });
});
