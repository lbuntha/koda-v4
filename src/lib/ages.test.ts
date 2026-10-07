import { describe, expect, it } from "vitest";
import { GRADE_CHIPS, fitsAge, gradesOf, isAgeRange, toggleGrade } from "./ages";

describe("age ranges", () => {
  it("accepts whole years from pre-school to Grade 12, youngest first", () => {
    expect(isAgeRange([6, 8])).toBe(true);
    expect(isAgeRange([4, 18])).toBe(true);
    expect(isAgeRange([8, 6])).toBe(false);
    expect(isAgeRange([3, 6])).toBe(false);
    expect(isAgeRange([6.5, 8])).toBe(false);
    expect(isAgeRange(null)).toBe(false);
  });

  it("offers content a year either side of its range, and all of it when it has none", () => {
    expect(fitsAge([6, 8], 7)).toBe(true);
    expect(fitsAge([6, 8], 9)).toBe(true);
    expect(fitsAge([6, 8], 10)).toBe(false);
    expect(fitsAge(undefined, 15)).toBe(true);
  });

  it("maps grades onto ages: Grade 1 is six", () => {
    expect(GRADE_CHIPS[0].ages).toEqual([4, 5]);
    expect(GRADE_CHIPS[1].ages).toEqual([6, 6]);
    expect(GRADE_CHIPS[12].ages).toEqual([17, 18]);
    expect(gradesOf([6, 8])).toEqual([1, 3]);
  });
});

describe("tapping grade chips", () => {
  it("starts on the grade tapped", () => {
    expect(toggleGrade(null, 2)).toEqual([7, 7]);
  });

  it("grows the run to reach a grade outside it", () => {
    expect(toggleGrade([7, 7], 4)).toEqual([7, 9]);
    expect(toggleGrade([7, 9], 0)).toEqual([4, 9]);
  });

  it("shrinks from either end, but never to nothing", () => {
    expect(toggleGrade([7, 9], 4)).toEqual([7, 8]);
    expect(toggleGrade([7, 9], 2)).toEqual([8, 9]);
    expect(toggleGrade([7, 7], 2)).toEqual([7, 7]);
  });

  it("starts again from a grade in the middle", () => {
    expect(toggleGrade([6, 10], 3)).toEqual([8, 8]);
  });
});
