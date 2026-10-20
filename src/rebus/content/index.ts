/**
 * The puzzles Koda ships with, before the Studio adds more.
 *
 * Written by hand and checked by `content.audit.test.ts` against the same
 * validator the Studio uses, so a puzzle that would not pass review cannot be
 * added here either.
 */

import type { Puzzle } from "../types";
import { ANIMALS } from "./animals";
import { CHOICE } from "./choice";
import { COUNTRIES } from "./countries";
import { FOOD } from "./food";
import { KHMER } from "./khmer";
import { MATH } from "./math";
import { SAYINGS } from "./sayings";
import { SCHOOL } from "./school";
import { MORE_ANIMALS, MORE_FOOD, MORE_SAYINGS, MORE_SCIENCE } from "./more";
import { SCIENCE } from "./science";
import { SPORTS } from "./sports";

export const OFFICIAL_PUZZLES: readonly Puzzle[] = [...COUNTRIES, ...FOOD, ...ANIMALS, ...SAYINGS, ...SCHOOL, ...SCIENCE, ...SPORTS, ...MORE_FOOD, ...MORE_ANIMALS, ...MORE_SCIENCE, ...MORE_SAYINGS, ...KHMER, ...MATH, ...CHOICE];
