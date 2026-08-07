/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A rung per new component, for `?preview=count-ladder&ladder=equation`. Same shape as the
 * counting ladder so the preview harness renders either without knowing the difference.
 */

import { CountingTechnique } from "../../types";
import type { CountLevel } from "./countLevels";

export const EQUATION_PREVIEW_LEVELS: CountLevel[] = [
  {
    id: "eq_second", label: "8 + ? = 11", tier: "starter",
    rationale: "Equation Mat — the missing addend. The total is known, one group is hidden.",
    technique: CountingTechnique.EQUATION_MAT, targetCount: 3,
    config: { equationOperation: "add", equationFirst: 8, equationSecond: 3, equationUnknown: "second" },
  },
  {
    id: "cmp_42_24", label: "42 ? 24", tier: "starter",
    rationale: "Compare Numbers — both drawn as tens rods and unit cubes, so size is seen before it is read.",
    technique: CountingTechnique.COMPARE_NUMBERS, targetCount: 42,
    config: { compareFirst: 42, compareSecond: 24 },
  },
  {
    id: "clock_half", label: "Half past 2", tier: "developing",
    rationale: "Clock — at half past, the hour hand sits between the numbers, which is what makes it honest.",
    technique: CountingTechnique.CLOCK_READ, targetCount: 2,
    config: { clockHour: 2, clockMinute: 30 },
  },
  {
    id: "measure_6", label: "Measure 6 units", tier: "developing",
    rationale: "Measure Length — units laid end to end with no gaps, which is the standard itself.",
    technique: CountingTechnique.MEASURE_LENGTH, targetCount: 6,
    config: { measureTask: "measure", measureLengths: [6] },
  },
  {
    id: "measure_longest", label: "Find the longest", tier: "secure",
    rationale: "Measure Length — three bars to scale; comparing is comparing counts.",
    technique: CountingTechnique.MEASURE_LENGTH, targetCount: 2,
    config: { measureTask: "longest", measureLengths: [3, 6, 4] },
  },
  {
    id: "data_more", label: "How many more?", tier: "secure",
    rationale: "Data Chart — counted objects with a tally beneath, the bridge to the abstract form.",
    technique: CountingTechnique.DATA_CHART, targetCount: 4,
    // Labels the built-in shapes can actually draw — a column of flowers called "Pears" is the
    // one thing a chart must never do.
    config: { dataKind: "more", dataCounts: [6, 2, 4], dataCategories: ["Apples", "Flowers", "Hearts"], dataAssets: ["apple", "flower", "heart"], dataFocus: 0, dataAgainst: 1 },
  },
  {
    id: "shape_hexagon", label: "Hexagon sides", tier: "extending",
    rationale: "Shape Lab — drawn from a real vertex count, so six sides are actually there to count.",
    technique: CountingTechnique.SHAPE_LAB, targetCount: 6,
    config: { shapeTask: "sides", shapeName: "hexagon" },
  },
  {
    id: "shape_fourths", label: "Fourths", tier: "extending",
    rationale: "Shape Lab — a circle cut through the middle twice, so the four parts really are equal.",
    technique: CountingTechnique.SHAPE_LAB, targetCount: 4,
    config: { shapeTask: "shares", shapeName: "circle", shapeShares: 4 },
  },
];
