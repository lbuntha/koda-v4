/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Worked example: Grade 1 / Math / Unit 1 / "Counting & Number Sense (0–120)"
 * with its required 10 questions, built from CountingQuestion configs that
 * already validate against each technique's real canvas — nothing here is
 * hypothetical. See the honest gap noted at the bottom before importing this
 * anywhere real.
 */

import { CountingTechnique, CountingQuestion } from "../types";
import { CurriculumTree } from "./types";

export const EXAMPLE_TREE: CurriculumTree = {
  grades: [
    { id: "grade-1", label: "Grade 1", order: 1 },
  ],
  subjects: [
    { id: "grade-1-math", gradeId: "grade-1", label: "Math", order: 1 },
  ],
  units: [
    { id: "g1-math-unit-1", subjectId: "grade-1-math", label: "Unit 1", order: 1 },
    // Minimal second unit/skill/question — a template to copy when hand-authoring
    // your own content in code instead of using the Curriculum Studio UI. Same
    // shape as Unit 1, just one question deep instead of ten.
    { id: "g1-math-unit-2", subjectId: "grade-1-math", label: "Unit 2", order: 2 },
  ],
  skills: [
    {
      id: "g1-math-u1-counting-0-120",
      unitId: "g1-math-unit-1",
      label: "Counting & Number Sense (0–120)",
      standardRef: "1.NBT.A.1", // Common Core: count to 120, starting at any number
      order: 1,
      minQuestions: 10,
    },
    {
      id: "g1-math-u2-addition-within-10",
      unitId: "g1-math-unit-2",
      label: "Addition Within 10",
      standardRef: "1.OA.C.6", // Common Core: add and subtract within 10
      order: 1,
      minQuestions: 1, // intentionally 1 for this template — a real skill should use ~10, like Unit 1's
    },
  ],
};

/**
 * 10 questions, 8 different techniques — proving the point that a Skill is
 * served by many techniques, not one. Every config here matches what that
 * canvas's own AI-generator schema (studio/ai-generator/schemas/) validates,
 * so these are exactly as "real" as anything a teacher would build by hand.
 */
export const EXAMPLE_QUESTIONS: CountingQuestion[] = [
  {
    id: "q-ex-1", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.ONE_TO_ONE,
    title: "Count the Apples", instruction: "Tap each apple once: 1, 2, 3, 4, 5, 6!",
    objectId: "apple", targetCount: 6,
    config: { pattern: "grid", showNumbersOnTap: true },
  },
  {
    id: "q-ex-2", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.MOVE_AND_COUNT,
    title: "Move the Fish", instruction: "Move all 5 fish from the bowl into the aquarium!",
    objectId: "fish", targetCount: 5,
    config: { frameColor: "emerald", sourceBinLabel: "Fish Bowl", destinationBinLabel: "Aquarium", defaultRepresentation: "concrete" },
  },
  {
    id: "q-ex-3", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.LINE_UP_AND_COUNT,
    title: "Line Up the Race Cars", instruction: "Line up all 5 cars at the starting line, in order: 1 to 5!",
    objectId: "car", targetCount: 5,
    config: { frameColor: "rose", sourceBinLabel: "Garage", destinationBinLabel: "Starting Line", showNumbersInSlots: true },
  },
  {
    id: "q-ex-4", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.DIFFERENT_ARRANGEMENTS,
    title: "Frogs in a Circle", instruction: "Count the 7 frogs — no matter how they're arranged, the total is still 7!",
    objectId: "frog", targetCount: 7,
    config: { pattern: "circle", frameColor: "emerald" },
  },
  {
    id: "q-ex-5", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.COUNT_MAGNETS,
    title: "Collect the Bugs", instruction: "Drag all 6 bugs into the jar!",
    objectId: "ladybug", targetCount: 6,
    config: { containerShape: "mystery", frameColor: "indigo" },
  },
  {
    id: "q-ex-6", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.SUBITIZE,
    title: "Quick Look!", instruction: "Watch carefully — how many dots do you see?",
    objectId: "blue_dot", targetCount: 4,
    config: { pattern: "dice", flashDurationMs: 1500 },
  },
  {
    id: "q-ex-7", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.COUNT_ON,
    title: "Count On from the Chest", instruction: "The chest already has 5 gems hidden inside. Count on 3 more: 6, 7, 8!",
    objectId: "star", targetCount: 8,
    config: { baseCount: 5, extraCount: 3, containerShape: "chest", frameColor: "purple" },
  },
  {
    id: "q-ex-8", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.COUNT_BACK,
    title: "Balloons Count Back", instruction: "Start at 8 balloons and count back as 3 pop: 8, 7, 6, 5!",
    objectId: "balloon", targetCount: 8,
    config: { totalCount: 8, removeCount: 3, frameColor: "rose" },
  },
  {
    id: "q-ex-9", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.GROUP_IN_TENS,
    title: "Group the Apples", instruction: "Drag the 13 apples into the ten-frames: make one full ten, then 3 more!",
    objectId: "apple", targetCount: 13,
    config: { frameColor: "emerald", sourceBinLabel: "Apple Basket", showNumbersInSlots: true },
  },
  {
    id: "q-ex-10", skillId: "g1-math-u1-counting-0-120",
    technique: CountingTechnique.GROUP_IN_TENS,
    title: "Group the Stars", instruction: "Drag the 18 stars into the ten-frames: one full ten, then 8 more!",
    objectId: "star", targetCount: 18,
    config: { frameColor: "purple", sourceBinLabel: "Star Box", showNumbersInSlots: true },
  },
  // Template question for Unit 2 / "Addition Within 10" — copy this shape (id,
  // skillId, technique, title, instruction, objectId, targetCount, config) to
  // add your own questions directly in code. targetCount must equal
  // config.addend1 + config.addend2 for ADDITION_SANDBOX, same rule the
  // Property Studio panel enforces when you drag its sliders instead.
  {
    id: "q-ex-11", skillId: "g1-math-u2-addition-within-10",
    technique: CountingTechnique.ADDITION_SANDBOX,
    title: "Koda's Apple Addition", instruction: "3 apples plus 2 more apples — how many apples in total?",
    objectId: "apple", targetCount: 5,
    config: { addend1: 3, addend2: 2, frameColor: "indigo" },
  },
];

/**
 * HONEST GAP: the skill is named "0–120" (the real Common Core standard,
 * 1.NBT.A.1) but every technique's own AI-schema clamps targetCount well
 * under that — GroupTens tops out at 20, OneToOne at 12, etc. (see
 * studio/ai-generator/schemas/*.schema.ts topLevelFields.targetCount.max).
 * Nothing here lies about that: these 10 questions cover 4–18, the range
 * today's canvases actually render well. Reaching the full 0–120 span for
 * real needs either raised ceilings on existing canvases (a 100-item grid
 * is a bad idea) or a new component built for it — a hundred-chart or
 * number-line canvas. Worth deciding before a teacher notices a "0–120"
 * skill tops out at 18.
 */
