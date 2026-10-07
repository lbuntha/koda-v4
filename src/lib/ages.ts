/**
 * Who a piece of content is for, in years — one shape for all of Learn.
 *
 * Think (lessons), Read (books) and Write (trace collections) each describe
 * their audience the same way, `[min, max]` in whole years, so a recommender
 * can read all three without translating between bands and grades. Required to
 * publish: a book or a collection with no age cannot be put in front of the
 * right child, so it does not go out. `server/app/ages.py` holds the same rules
 * and is what actually refuses.
 *
 * Authors think in school grades, so the Studio shows grades and stores ages.
 * Cambodia starts Grade 1 at six, so a grade is its age less five.
 */

export type AgeRange = readonly [number, number];

/** The youngest and oldest learner Koda is made for: pre-school to Grade 12. */
export const AGE_MIN = 4;
export const AGE_MAX = 18;

export const isAgeRange = (value: unknown): value is AgeRange =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((n) => Number.isInteger(n) && n >= AGE_MIN && n <= AGE_MAX) &&
  value[0] <= value[1];

/** How far either side of a range a child may still be offered it. Matches the curriculum's stretch. */
export const AGE_STRETCH = 1;

/**
 * Whether content for `range` suits a child of `age`.
 *
 * Content saved before ages were required has none and suits everybody, so a
 * shelf never empties itself the day this ships; publishing now fills it in.
 */
export const fitsAge = (range: AgeRange | null | undefined, age: number | null | undefined, stretch = AGE_STRETCH): boolean => {
  if (!isAgeRange(range) || age == null || !Number.isFinite(age)) return true;
  return age >= range[0] - stretch && age <= range[1] + stretch;
};

/** One chip in the grade picker, and the ages it stands for. */
export interface GradeChip {
  /** 0 is pre-school; 1–12 are grades. */
  grade: number;
  ages: AgeRange;
}

export const GRADE_CHIPS: readonly GradeChip[] = Array.from({ length: 13 }, (_, grade) => ({
  grade,
  ages: grade === 0 ? [AGE_MIN, 5] : grade === 12 ? [17, AGE_MAX] : [grade + 5, grade + 5],
}));

const overlaps = (a: AgeRange, b: AgeRange) => a[0] <= b[1] && b[0] <= a[1];

/** The chips a range touches, as a first and last grade. */
export const gradesOf = (range: AgeRange): [number, number] => {
  const touched = GRADE_CHIPS.filter((chip) => overlaps(chip.ages, range));
  return [touched[0]?.grade ?? 0, touched[touched.length - 1]?.grade ?? 12];
};

export const chipSelected = (range: AgeRange | null | undefined, chip: GradeChip): boolean =>
  isAgeRange(range) && overlaps(chip.ages, range);

/**
 * A tap on a grade chip. The range stays one unbroken run of grades:
 *
 * - nothing chosen yet → that grade;
 * - a grade outside the run → the run grows to reach it;
 * - the first or last grade of a run → the run shrinks by it (never to nothing:
 *   an age is required, so the last grade stays);
 * - a grade in the middle → just that grade, to start again.
 */
export const toggleGrade = (range: AgeRange | null | undefined, grade: number): AgeRange => {
  const chip = GRADE_CHIPS[grade];
  if (!isAgeRange(range)) return chip.ages;
  const [first, last] = gradesOf(range);
  if (grade < first) return [chip.ages[0], range[1]];
  if (grade > last) return [range[0], chip.ages[1]];
  if (first === last) return range;
  if (grade === first) return [GRADE_CHIPS[first + 1].ages[0], range[1]];
  if (grade === last) return [range[0], GRADE_CHIPS[last - 1].ages[1]];
  return chip.ages;
};
