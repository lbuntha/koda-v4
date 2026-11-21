import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, countryName, searchCountries } from "./countries";

describe("countries", () => {
  it("lists real countries once, with Cambodia's neighbours first", () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(COUNTRY_CODES).toContain("KH");
    expect(searchCountries("", "en").slice(0, 4)).toEqual(["KH", "TH", "VN", "LA"]);
  });

  it("finds a country by English or Khmer name, whatever the app language", () => {
    expect(searchCountries("camb", "en")).toEqual(["KH"]);
    expect(searchCountries("កម្ពុ", "en")).toEqual(["KH"]);
    expect(searchCountries("united", "km")).toContain("US");
    expect(searchCountries("zzq", "en")).toEqual([]);
    expect(countryName("KH", "km")).toBe("កម្ពុជា");
  });
});
