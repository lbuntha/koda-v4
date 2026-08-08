/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CountingQuestion, CountingTechnique } from "./types";

export const DEFAULT_QUESTIONS: CountingQuestion[] = [
  /*
    The four counting starters are one game now — same technique, different
    `staging`. Each still opens on the action it was named for, so the starter
    deck demonstrates all four without four picker entries behind it.
  */
  {
    id: "q-one-to-one",
    technique: CountingTechnique.MOVE_AND_COUNT,
    title: "1. One-to-One Correspondence",
    instruction: "Touch or point to each object once. Count them in order from 1 to 5!",
    objectId: "apple",
    targetCount: 5,
    config: {
      staging: "tap",
      assetType: "apple",
      pattern: "grid",
      gridColumns: 3
    }
  },
  {
    id: "q-move-count",
    technique: CountingTechnique.MOVE_AND_COUNT,
    title: "2. Move and Count",
    instruction: "Move the objects one at a time to their new place while counting them: 1, 2, 3!",
    objectId: "duck",
    targetCount: 3,
    config: { staging: "move" }
  },
  {
    id: "q-line-up",
    technique: CountingTechnique.MOVE_AND_COUNT,
    title: "3. Line Up and Count",
    instruction: "Arrange the objects in a straight horizontal line, then count them from left to right!",
    objectId: "cupcake",
    targetCount: 4,
    config: { staging: "lineup" }
  },
  {
    id: "q-group-tens",
    technique: CountingTechnique.GROUP_IN_TENS,
    title: "4. Group in Tens (Base-10)",
    instruction: "Use the ten-frames to group by 10. Drag 14 stars to see that 10 + 4 = 14!",
    objectId: "star",
    targetCount: 14,
    config: {
      assetType: "star",
      baseCount: 10,
      extraCount: 4
    }
  },
  {
    id: "q-count-on",
    technique: CountingTechnique.COUNT_ON,
    title: "5. Count On",
    instruction: "Start from 5 in the hand. Drag the extra circles and count on: 5... 6, 7, 8!",
    objectId: "blue_dot",
    targetCount: 8,
    config: {
      baseCount: 5,
      extraCount: 3
    }
  },
  {
    id: "q-count-back",
    technique: CountingTechnique.COUNT_BACK,
    title: "6. Count Back",
    instruction: "Start at 8 and cross out/remove circles to count backward: 8... 7... 6... 5!",
    objectId: "red_dot",
    targetCount: 5,
    config: {
      totalCount: 8,
      removeCount: 3
    }
  },
  {
    id: "q-arrangements",
    technique: CountingTechnique.DIFFERENT_ARRANGEMENTS,
    title: "7. Count in Different Arrangements",
    instruction: "Tap and count the dinosaurs. No matter how they are arranged, the total count is still 6!",
    objectId: "dino",
    targetCount: 6,
    config: {
      assetType: "dino",
      pattern: "scatter" // user can toggle grid, circle, scatter, line
    }
  },
  {
    id: "q-magnets",
    technique: CountingTechnique.MOVE_AND_COUNT,
    title: "8. Count Using Magnets",
    instruction: "Drag the star magnets into the jar, and watch the count display update!",
    objectId: "star",
    targetCount: 5,
    config: {
      staging: "container",
      containerShape: "jar",
      assetType: "star"
    }
  },
  {
    id: "q-subitize",
    technique: CountingTechnique.SUBITIZE,
    title: "9. Subitize (Quick Recognition)",
    instruction: "Look at the objects briefly and recognize how many without counting one-by-one!",
    objectId: "blue_dot",
    targetCount: 5,
    config: {
      pattern: "dice",
      flashDurationMs: 1500
    }
  },
  {
    id: "q-addition",
    technique: CountingTechnique.ADDITION_SANDBOX,
    title: "10. Koda's Addition Tree",
    instruction: "Merge the groups by dragging apples into the basket: 3 apples + 2 apples = ?",
    objectId: "apple",
    targetCount: 5,
    config: {
      addend1: 3,
      addend2: 2
    }
  },
  {
    id: "q-subtraction",
    technique: CountingTechnique.SUBTRACTION_SANDBOX,
    title: "11. Koda's Subtracting Donut Shop",
    instruction: "Start with 8 cookies. Tap 3 of them to eat/cross them out and count the leftovers!",
    objectId: "cookie",
    targetCount: 5,
    config: {
      minuend: 8,
      subtrahend: 3
    }
  },
  {
    id: "q-multiplication",
    technique: CountingTechnique.MULTIPLICATION_ARRAY,
    title: "12. Equal Groups (Multiplication)",
    instruction: "Form a 3 rows by 4 columns array of stars to solve: 3 groups of 4 equals what?",
    objectId: "star",
    targetCount: 12,
    config: {
      rows: 3,
      cols: 4
    }
  },
  {
    id: "q-sudoku",
    technique: CountingTechnique.KODA_SUDOKU,
    title: "13. Koda's Visual Mini Sudoku",
    instruction: "Complete the 4x4 visual sudoku by placing emojis. No duplicates in rows or columns!",
    objectId: "blue_dot",
    targetCount: 16,
    config: {
      sudokuOptions: ["🍎", "🧁", "🦆", "⭐"],
      sudokuStartingGrid: [
        ["🍎", "", "🦆", ""],
        ["", "⭐", "", "🧁"],
        ["⭐", "", "", "🦆"],
        ["", "🦆", "⭐", ""]
      ],
      sudokuSolution: [
        ["🍎", "🧁", "🦆", "⭐"],
        ["🦆", "⭐", "🍎", "🧁"],
        ["⭐", "🍎", "🧁", "🦆"],
        ["🧁", "🦆", "⭐", "🍎"]
      ]
    }
  },
  {
    id: "q-pattern",
    technique: CountingTechnique.KODA_PATTERN,
    title: "14. Pattern Completion Detective",
    instruction: "Look at the pattern sequence. Which emoji comes next to complete the mystery?",
    objectId: "balloon",
    targetCount: 1,
    config: {
      patternSequence: ["🎈", "🍪", "🎈", "🍪", "🎈", ""],
      patternAnswer: "🍪",
      sudokuOptions: ["🎈", "🍪", "🚗", "🦆"]
    }
  },
  {
    id: "q-flexible-sorting",
    technique: CountingTechnique.FLEXIBLE_CANVAS,
    title: "15. Classroom Sorting Detective",
    instruction: "Sort the items! Drag the Apples 🍎 to the Apples Bin, and Balloons 🎈 to the Balloons Bin!",
    objectId: "apple",
    targetCount: 5,
    config: {
      flexibleMode: "dragmatch",
      flexibleBgStyle: "meadow",
      flexibleItems: [
        { id: "f1", emoji: "🍎", x: 60, y: 40, targetBin: "bin-apples" },
        { id: "f2", emoji: "🍎", x: 140, y: 30, targetBin: "bin-apples" },
        { id: "f3", emoji: "🍎", x: 220, y: 50, targetBin: "bin-apples" },
        { id: "f4", emoji: "🎈", x: 100, y: 100, targetBin: "bin-balloons" },
        { id: "f5", emoji: "🎈", x: 180, y: 90, targetBin: "bin-balloons" }
      ],
      flexibleTargets: [
        { id: "bin-apples", label: "🍎 Apples Bin", x: 50, y: 180, width: 140, height: 70 },
        { id: "bin-balloons", label: "🎈 Balloons Bin", x: 210, y: 180, width: 140, height: 70 }
      ]
    }
  },
  {
    id: "q-addition-tutor",
    technique: CountingTechnique.ADDITION_TUTOR,
    title: "16. Addition Tutor (18 + 7)",
    instruction: "Help Koda gather 18 red apples and 7 green apples, then group them into tens to find the sum!",
    objectId: "apple",
    targetCount: 25,
    config: {
      num1: 18,
      num2: 7,
      assetType: "apple",
      frameColor: "indigo"
    }
  },
  {
    id: "q-xtra-math",
    technique: CountingTechnique.XTRA_MATH,
    title: "17. XtraMath Speed Fluency",
    instruction: "Solve the math facts quickly and accurately to build fluency!",
    objectId: "star",
    targetCount: 10,
    config: {
      levelId: "xm_level_1",
      themeId: "classic",
      timeLimitSec: 6,
      defaultVsComputer: false
    }
  }
];
