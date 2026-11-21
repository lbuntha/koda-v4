import { beforeEach, describe, expect, it } from "vitest";
import { aboutYouKey, birthYears, shouldAskAboutYou } from "./AboutYou";

describe("About you", () => {
  beforeEach(() => localStorage.clear());

  it("asks someone learning on their own for what is missing, once per device", () => {
    const student = { role: "student", userId: "u1", learnerId: "l1" };
    expect(shouldAskAboutYou(student)).toBe(true);
    expect(shouldAskAboutYou({ ...student, learnerBirthYear: 2012 })).toBe(true); // still no country
    expect(shouldAskAboutYou({ ...student, learnerBirthYear: 2012, country: "KH" })).toBe(false);
    localStorage.setItem(aboutYouKey("u1"), "1");
    expect(shouldAskAboutYou(student)).toBe(false);
  });

  it("asks a parent only for a country, and never a child or a signed-out device", () => {
    expect(shouldAskAboutYou({ role: "owner", userId: "u2" })).toBe(true);
    expect(shouldAskAboutYou({ role: "owner", userId: "u2", country: "KH" })).toBe(false);
    expect(shouldAskAboutYou({ role: "child", learnerId: "l3" })).toBe(false);
    expect(shouldAskAboutYou(null)).toBe(false);
  });

  it("offers birth years from five years old back", () => {
    const years = birthYears(2026);
    expect(years[0]).toBe(2021);
    expect(years.at(-1)).toBe(1936);
  });
});
