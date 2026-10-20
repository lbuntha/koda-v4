/**
 * Math questions by grade, 1 to 6, each in English and Khmer.
 *
 * Generated from small rules with the answer worked out in code (see `kit.ts`),
 * so the sets can be grown or reshuffled without a typed answer ever being wrong.
 */

import type { Puzzle } from "../../types";
import { answerKey } from "../../puzzle";
import { MATH } from "../math";
import { GRADE_1 } from "./g1";
import { GRADE_2 } from "./g2";
import { GRADE_3 } from "./g3";
import { GRADE_4 } from "./g4";
import { GRADE_5 } from "./g5";
import { GRADE_6 } from "./g6";

const existing = new Set(MATH.map((p) => p.id));

const taken = new Set(MATH.map(answerKey));

/** Not a sum the older Math set already has, and not the same question twice: the younger grade keeps it. */
export const MATH_GRADES: Puzzle[] = [...GRADE_1, ...GRADE_2, ...GRADE_3, ...GRADE_4, ...GRADE_5, ...GRADE_6].filter((p) => {
  const key = answerKey(p);
  if (existing.has(p.id) || taken.has(key)) return false;
  taken.add(key);
  return true;
});
