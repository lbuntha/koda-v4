/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Every question in Grade 1 Mathematics, as recipes rather than hand-authored rows.
 *
 * The curriculum tree already exists in `grade1MathTemplate.ts` — 11 units, 30 skills, each
 * carrying its Common Core reference. What it has never had is content: 30 skills at five
 * questions each is 150 questions, and authoring those one at a time in the studio is exactly
 * where this curriculum stalled and got archived.
 *
 * So the questions are generated the way the sorting ladders are: a compact spec per skill,
 * expanded and then *verified* by `npm run export:grade1-math` before anything is seeded. The
 * checks live in the export — a count outside its canvas's authored range, or a config that
 * solves to a different answer than the question claims, fails the build rather than reaching
 * a child.
 *
 * Each skill also declares its `conceptId`: the stable name that outlives this curriculum, so
 * Grade 2 can state a prerequisite on "make a ten" and review it rather than re-teaching it.
 *
 * ## Two rules every builder here follows
 *
 * **A title never contains the answer.** `question.title` is rendered as the page `<h1>` by
 * `GameLauncher`, above the canvas. "Count 12" and "Half past 2" were therefore printing the
 * answer to the child before they had touched anything. Titles name the *task*; the numbers
 * live in the instruction, and only when the task genuinely requires them (you cannot ask a
 * child to build 30 without saying 30).
 *
 * **Every question explains itself.** `config.explanation` is one sentence of reasoning, shown
 * by the success panel *after* the card is solved. It is generated from the same numbers the
 * question is generated from, so it cannot drift into describing a different question.
 *
 * ## Coverage
 *
 * Every skill is now on a real manipulative canvas. Measurement, time, data and geometry ride
 * the components built for them (Measure Length, Clock, Data Chart, Shape Lab), and the two
 * equation skills use Equation Mat — including its `judge` mode for "is this true or false",
 * which is the half of 1.OA.D.7 that a missing-addend question cannot reach.
 */

import { CountingTechnique } from "../types";

export interface GeneratedQuestion {
  id: string;
  title: string;
  instruction: string;
  technique: CountingTechnique;
  skillId: string;
  difficulty: "easy" | "medium" | "hard";
  objectId: string;
  targetCount: number;
  config: Record<string, unknown>;
}

export interface SkillQuestions {
  /** Matches a skill id in `grade1MathTemplate.ts`. */
  skillId: string;
  /** Stable across curricula and grades — see `Skill.conceptId`. */
  conceptId: string;
  /** True when the skill has no real manipulative yet and falls back to choice questions. */
  needsCanvas?: boolean;
  questions: GeneratedQuestion[];
}

// ── Builders ────────────────────────────────────────────────────────────────────
// Each returns the question shape the seed writes into the deck. `targetCount` always
// carries the answer, because that is what both the canvas and the server grade against.

let sequence = 0;
const qid = (skillId: string) => `seed-g1-math-q-${skillId}-${++sequence}`;

const band = (index: number, total: number): "easy" | "medium" | "hard" =>
  index < total / 3 ? "easy" : index < (total * 2) / 3 ? "medium" : "hard";

/** "3 tens and 4 ones", said the way a Grade 1 explanation should say it. */
const tensAndOnes = (value: number): string => {
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  const tensPart = tens === 1 ? "1 ten" : `${tens} tens`;
  if (ones === 0) return `${tensPart} and no ones`;
  return `${tensPart} and ${ones === 1 ? "1 one" : `${ones} ones`}`;
};

/** Count a set of objects laid out in a named pattern. */
const counting = (
  skillId: string,
  technique: CountingTechnique,
  rows: Array<{ count: number; pattern?: string; object?: string; config?: Record<string, unknown> }>,
): GeneratedQuestion[] =>
  rows.map((row, index) => ({
    id: qid(skillId),
    // Not `Count ${row.count}` — that is the answer, in the page heading.
    title: `How many do you see?`,
    instruction: `Count them all, then tell me how many.`,
    technique,
    skillId,
    difficulty: band(index, rows.length),
    objectId: row.object ?? "apple",
    targetCount: row.count,
    config: {
      requireAnswerInput: true,
      explanation: `There are ${row.count}. However they are arranged, moving them around never changes how many there are.`,
      ...(row.pattern ? { pattern: row.pattern } : {}),
      ...row.config,
    },
  }));

/** Join two groups. `targetCount` is the sum the child must reach. */
const addition = (
  skillId: string,
  technique: CountingTechnique,
  pairs: Array<[number, number]>,
  explain?: (a: number, b: number) => string,
): GeneratedQuestion[] =>
  pairs.map(([a, b], index) => ({
    id: qid(skillId),
    title: `${a} + ${b}`,
    instruction: `Put the groups together. How many altogether?`,
    technique,
    skillId,
    difficulty: band(index, pairs.length),
    objectId: "apple",
    targetCount: a + b,
    config: {
      ...(technique === CountingTechnique.ADDITION_COLUMN
        ? { num1: a, num2: b }
        : { addend1: a, addend2: b }),
      requireAnswerInput: true,
      explanation: explain?.(a, b)
        ?? `${a} + ${b} = ${a + b}. Joining a group of ${a} and a group of ${b} makes one group of ${a + b}.`,
    },
  }));

const subtraction = (
  skillId: string,
  technique: CountingTechnique,
  pairs: Array<[number, number]>,
  explain?: (minuend: number, subtrahend: number) => string,
): GeneratedQuestion[] =>
  pairs.map(([minuend, subtrahend], index) => ({
    id: qid(skillId),
    title: `${minuend} − ${subtrahend}`,
    instruction: `Take them away. How many are left?`,
    technique,
    skillId,
    difficulty: band(index, pairs.length),
    objectId: "apple",
    targetCount: minuend - subtrahend,
    config: {
      minuend,
      subtrahend,
      requireAnswerInput: true,
      explanation: explain?.(minuend, subtrahend)
        ?? `${minuend} − ${subtrahend} = ${minuend - subtrahend}. Taking ${subtrahend} away from ${minuend} leaves ${minuend - subtrahend}.`,
    },
  }));

/** Count on from a number already in the jar, or back from a total. */
const countOn = (skillId: string, rows: Array<[number, number]>): GeneratedQuestion[] =>
  rows.map(([baseCount, extraCount], index) => ({
    id: qid(skillId),
    title: `Count on from ${baseCount}`,
    instruction: `There are already ${baseCount}. Keep counting as more arrive.`,
    technique: CountingTechnique.COUNT_ON,
    skillId,
    difficulty: band(index, rows.length),
    objectId: "apple",
    targetCount: baseCount + extraCount,
    config: {
      baseCount,
      extraCount,
      containerShape: "jar",
      requireAnswerInput: true,
      explanation: `Say "${baseCount}", then count on ${extraCount} more to reach ${baseCount + extraCount}. You never have to start again at 1.`,
    },
  }));

const countBack = (skillId: string, rows: Array<[number, number]>): GeneratedQuestion[] =>
  rows.map(([totalCount, removeCount], index) => ({
    id: qid(skillId),
    title: `Count back from ${totalCount}`,
    instruction: `Cross out ${removeCount}, then say how many are left.`,
    technique: CountingTechnique.COUNT_BACK,
    skillId,
    difficulty: band(index, rows.length),
    objectId: "apple",
    targetCount: totalCount - removeCount,
    config: {
      totalCount,
      removeCount,
      crossOutStyle: "strike",
      requireAnswerInput: true,
      explanation: `Start at ${totalCount} and count back ${removeCount}: ${totalCount - removeCount} are left. Counting back is the same as taking away.`,
    },
  }));

/** Bundle loose ones into tens. */
const groupTens = (skillId: string, counts: number[]): GeneratedQuestion[] =>
  counts.map((count, index) => ({
    id: qid(skillId),
    // The count is what the child works out by grouping, so it stays out of the heading.
    title: `Make tens`,
    instruction: `Fill a ten-frame first, then count what is left over.`,
    technique: CountingTechnique.GROUP_IN_TENS,
    skillId,
    difficulty: band(index, counts.length),
    objectId: "apple",
    targetCount: count,
    config: {
      sourceBinLabel: "Loose beads",
      showNumbersInSlots: index === 0,
      requireAnswerInput: true,
      explanation: `${count} is ${tensAndOnes(count)}. A full ten-frame is worth one ten, so you only have to count the leftovers.`,
    },
  }));

const placeValue = (
  skillId: string,
  task: "build_number" | "read_number" | "regroup_ones",
  targets: number[],
): GeneratedQuestion[] =>
  targets.map((target, index) => ({
    id: qid(skillId),
    // `read_number` must not name the number — reading it is the whole task. `build_number`
    // has to, because "show 30 with blocks" cannot be asked without saying 30.
    title: task === "read_number" ? `What number is this?` : `Build with tens and ones`,
    instruction: task === "read_number"
      ? `Count the tens, then the ones. What number do the blocks show?`
      : `Show ${target} using tens and ones.`,
    technique: CountingTechnique.PLACE_VALUE_LAB,
    skillId,
    difficulty: band(index, targets.length),
    objectId: "apple",
    targetCount: target,
    config: {
      placeValueTask: task,
      placeValueTarget: target,
      explanation: `${target} is ${tensAndOnes(target)}. The left digit counts the tens and the right digit counts the ones.`,
    },
  }));

const numberPath = (
  skillId: string,
  task: "count_forward" | "find_number" | "ten_more" | "ten_less",
  rows: Array<{ start: number; end: number }>,
  view: "path" | "chart" = "path",
): GeneratedQuestion[] =>
  rows.map((row, index) => ({
    id: qid(skillId),
    // "Count from 6 to 11" named the graded answer in the heading. The end number belongs in
    // the instruction, where it is the task ("tap each one until you reach it"), not a spoiler.
    title: task === "ten_more" ? `Ten more`
      : task === "ten_less" ? `Ten less`
      : task === "find_number" ? `Find the number`
      : `Count in order`,
    instruction: task === "ten_more" ? `Start at ${row.start}. Find the number that is ten more.`
      : task === "ten_less" ? `Start at ${row.start}. Find the number that is ten less.`
      : task === "find_number" ? `Tap ${row.end} on the chart.`
      : `Start at ${row.start} and tap each number in order until you reach ${row.end}.`,
    technique: CountingTechnique.NUMBER_PATH,
    skillId,
    difficulty: band(index, rows.length),
    objectId: "apple",
    targetCount: row.end,
    config: {
      numberChartView: view,
      numberChartTask: task,
      numberChartDifficulty: index === 0 ? "guided" : "independent",
      numberChartStart: row.start,
      numberChartEnd: row.end,
      explanation: task === "ten_more"
        ? `${row.start} + 10 = ${row.end}. Ten more moves you one whole row down the chart: the tens digit goes up by one and the ones digit stays the same.`
        : task === "ten_less"
          ? `${row.start} − 10 = ${row.end}. Ten less moves you one whole row up the chart: the tens digit goes down by one and the ones digit stays the same.`
          : task === "find_number"
            ? `${row.end} is ${tensAndOnes(row.end)}, which is what tells you where it sits on the chart.`
            : `After ${row.start} the numbers keep going up by one — ${row.start + 1}, ${row.start + 2}, and on to ${row.end}. Counting always works the same way, wherever you start.`,
    },
  }));

type StoryType = "add_to" | "take_from" | "put_together" | "take_apart" | "compare" | "three_addends";
type StoryUnknown = "result" | "change" | "start" | "part";

/**
 * The equation the story stands for, written out. This is the whole point of a story mat:
 * the child should leave knowing that "how many arrived?" was `5 + ? = 9` all along.
 */
const storyReasoning = (
  type: StoryType, unknown: StoryUnknown, first: number, second: number, third: number | undefined, answer: number,
): string => {
  if (type === "add_to" && unknown === "change") return `${first} + ? = ${first + second}, so ? is ${answer}. "Some more arrived" means adding, even though you are finding the part that was added.`;
  if (type === "add_to" && unknown === "start") return `? + ${second} = ${first + second}, so ? is ${answer}. Working backwards from the total finds the amount you started with.`;
  if (type === "add_to") return `${first} + ${second} = ${answer}. More arriving means the group grows.`;
  if (type === "take_from" && unknown === "change") return `${first} − ? = ${first - second}, so ? is ${answer}. The gap between what was there and what is left is what went away.`;
  if (type === "take_from" && unknown === "start") return `? − ${second} = ${first - second}, so ? is ${answer}. Put back what went away to find the amount you started with.`;
  if (type === "take_from") return `${first} − ${second} = ${answer}. Things going away means the group shrinks.`;
  if (type === "put_together" && unknown === "part") return `${first} + ? = ${first + second}, so ? is ${answer}. One part and the whole are known, so the other part is what is missing.`;
  if (type === "put_together") return `${first} + ${second} = ${answer}. Nothing moved — two parts are simply counted as one whole.`;
  if (type === "take_apart") return `${first} − ${second} = ${answer}. The whole is ${first}; take away the part you can see and the rest is the other part.`;
  if (type === "compare") return `${first} − ${second} = ${answer}. Comparing is subtracting: match them up in pairs and ${answer} are left over.`;
  return `${first} + ${second} + ${third ?? 0} = ${answer}. Add any two first, then add the last one to that total.`;
};

const story = (
  skillId: string,
  rows: Array<{ type: StoryType; unknown?: StoryUnknown; first: number; second: number; third?: number; answer: number; who: string }>,
): GeneratedQuestion[] =>
  rows.map((row, index) => {
    const unknown = row.unknown ?? "result";
    return {
      id: qid(skillId),
      title: `${row.who}'s story`,
      instruction: `Read the story, then choose the number that answers it.`,
      technique: CountingTechnique.STORY_PROBLEM_MAT,
      skillId,
      difficulty: band(index, rows.length),
      objectId: "apple",
      targetCount: row.answer,
      config: {
        storyProblemType: row.type,
        storyUnknown: unknown,
        storyStart: row.first,
        storyPart2: row.second,
        ...(row.third !== undefined ? { storyPart3: row.third } : {}),
        storyCharacterName: row.who,
        storyScene: "park",
        explanation: storyReasoning(row.type, unknown, row.first, row.second, row.third, row.answer),
      },
    };
  });

/** An equation with one quantity hidden — the component built for 1.OA.D.8. */
const equation = (
  skillId: string,
  rows: Array<{ op?: "add" | "subtract"; first: number; second: number; hide: "result" | "first" | "second"; why?: string }>,
): GeneratedQuestion[] =>
  rows.map((row, index) => {
    const op = row.op ?? "add";
    const sign = op === "add" ? "+" : "−";
    const result = op === "add" ? row.first + row.second : row.first - row.second;
    const answer = row.hide === "first" ? row.first : row.hide === "second" ? row.second : result;
    const shown = (term: string, value: number) => (row.hide === term ? "?" : String(value));
    const written = `${shown("first", row.first)} ${sign} ${shown("second", row.second)} = ${shown("result", result)}`;
    return {
      id: qid(skillId),
      title: written,
      instruction: row.hide === "result"
        ? "How many altogether? Tap the number."
        : "One group is hidden. Tap the number that makes the equation true.",
      technique: CountingTechnique.EQUATION_MAT,
      skillId,
      difficulty: band(index, rows.length),
      objectId: "apple",
      targetCount: answer,
      config: {
        equationOperation: op,
        equationFirst: row.first,
        equationSecond: row.second,
        equationUnknown: row.hide,
        explanation: row.why
          ?? (row.hide === "result"
            // "6 + 3 = ? is true when ? is 9 because 6 + 3 = 9" explains nothing — it restates
            // the question. A result-unknown needs to describe the move, not the equation.
            ? `${row.first} ${sign} ${row.second} = ${result}. ${op === "add"
                ? `Start at ${row.first} and count on ${row.second} more — you never have to go back to 1.`
                : `Start at ${row.first} and take ${row.second} away; what is left is ${result}.`}`
            : `${written} is only true when ? is ${answer}, because ${row.first} ${sign} ${row.second} = ${result}. Finding a hidden part means working backwards from what you know.`),
      },
    };
  });

/**
 * A complete equation the child judges true or false — Equation Mat's `judge` mode.
 * `claim` is what the right-hand side says; two values make it a second sum, which is how a
 * child meets `5 + 2 = 3 + 4` and learns that "=" means "the same as", not "here comes the
 * answer".
 */
const judgeEquation = (
  skillId: string,
  rows: Array<{ op?: "add" | "subtract"; first: number; second: number; claim: [number] | [number, number] }>,
): GeneratedQuestion[] =>
  rows.map((row, index) => {
    const op = row.op ?? "add";
    const sign = op === "add" ? "+" : "−";
    const result = op === "add" ? row.first + row.second : row.first - row.second;
    const [claimFirst, claimSecond = 0] = row.claim;
    const claim = claimFirst + claimSecond;
    const isTrue = result === claim;
    const rightSide = claimSecond > 0 ? `${claimFirst} + ${claimSecond}` : `${claimFirst}`;
    return {
      id: qid(skillId),
      title: `${row.first} ${sign} ${row.second} = ${rightSide}`,
      instruction: "Count both sides. Is this true or false?",
      technique: CountingTechnique.EQUATION_MAT,
      skillId,
      difficulty: band(index, rows.length),
      objectId: "apple",
      targetCount: isTrue ? 1 : 0,   // JUDGE_TRUE / JUDGE_FALSE in EquationMatCanvas
      config: {
        equationOperation: op,
        equationFirst: row.first,
        equationSecond: row.second,
        equationUnknown: "judge",
        equationClaimFirst: claimFirst,
        equationClaimSecond: claimSecond,
        // `${rightSide} makes ${claim}` reads as "5 makes 5" when the right side is a single
        // number, so a bare claim is described rather than recomputed.
        explanation: isTrue
          ? `True. This side makes ${result}, and ${claimSecond > 0 ? `${rightSide} also makes ${claim}` : `the other side is ${claim} too`} — "=" means the two sides are the same amount, not "here comes the answer".`
          : `False. This side makes ${result}, but ${claimSecond > 0 ? `${rightSide} makes ${claim}` : `the other side says ${claim}`}. Both sides have to be the same amount before you can write "=".`,
      },
    };
  });


/** Compare two numbers with >, < or =. The answer is the symbol; targetCount holds the larger. */
const compare = (skillId: string, pairs: Array<[number, number]>): GeneratedQuestion[] =>
  pairs.map(([first, second], index) => {
    const tens = (value: number) => Math.floor(value / 10);
    const explanation = first === second
      ? `${first} and ${second} have the same tens and the same ones, so they are equal.`
      : tens(first) !== tens(second)
        ? `${tens(first)} tens is ${tens(first) > tens(second) ? "more" : "less"} than ${tens(second)} tens, so ${first} ${first > second ? ">" : "<"} ${second}. The tens decide it before you ever look at the ones.`
        : `Both have ${tens(first)} tens, so the ones decide: ${first % 10} is ${first > second ? "more" : "less"} than ${second % 10}, so ${first} ${first > second ? ">" : "<"} ${second}.`;
    return {
      id: qid(skillId),
      title: `${first} ? ${second}`,
      instruction: "Which sign belongs between them? Compare the tens first.",
      technique: CountingTechnique.COMPARE_NUMBERS,
      skillId,
      difficulty: band(index, pairs.length),
      objectId: "star",
      targetCount: Math.max(first, second),
      config: { compareFirst: first, compareSecond: second, explanation },
    };
  });

const clock = (skillId: string, rows: Array<[number, 0 | 30]>): GeneratedQuestion[] =>
  rows.map(([hour, minute], index) => ({
    id: qid(skillId),
    // "Half past 2" as a heading was the answer, printed above the clock.
    title: `What time is it?`,
    instruction: "Read the clock. The short hand tells you the hour.",
    technique: CountingTechnique.CLOCK_READ,
    skillId,
    difficulty: band(index, rows.length),
    objectId: "star",
    targetCount: hour,
    config: {
      clockHour: hour,
      clockMinute: minute,
      explanation: minute === 30
        ? `Half past ${hour}. The long hand on 6 means half an hour has gone by, and the short hand has moved half way past the ${hour} — it does not wait on the ${hour} until the hour is over.`
        : `${hour} o'clock. The long hand points straight up at 12, which means no minutes have gone by yet, and the short hand points right at the ${hour}.`,
    },
  }));

const measure = (
  skillId: string,
  rows: Array<{ task: "measure" | "longest" | "shortest"; lengths: number[] }>,
): GeneratedQuestion[] =>
  rows.map((row, index) => {
    const answer = row.task === "measure"
      ? row.lengths[0]
      : row.lengths.indexOf(row.task === "longest" ? Math.max(...row.lengths) : Math.min(...row.lengths)) + 1;
    const labels = ["Red", "Blue", "Green"];
    return {
      id: qid(skillId),
      // Not `Measure ${lengths[0]} units` — that was the answer in the heading.
      title: row.task === "measure" ? `How long is the bar?` : `Find the ${row.task}`,
      instruction: row.task === "measure"
        ? "Count the units under the bar. How long is it?"
        : `Tap the ${row.task} bar.`,
      technique: CountingTechnique.MEASURE_LENGTH,
      skillId,
      difficulty: band(index, rows.length),
      objectId: "star",
      targetCount: answer,
      config: {
        measureTask: row.task,
        measureLengths: row.lengths,
        explanation: row.task === "measure"
          ? `${row.lengths[0]} units. Length is a count of units laid end to end with no gaps and no overlaps — so measuring is just careful counting.`
          : `${labels[answer - 1]} is the ${row.task}: it covers ${row.lengths[answer - 1]} units, ${row.task === "longest" ? "more" : "fewer"} than the others. Comparing lengths is comparing how many units fit.`,
      },
    };
  });

const chart = (
  skillId: string,
  rows: Array<{ kind: "count" | "total" | "more" | "most"; counts: number[]; focus?: number; against?: number }>,
): GeneratedQuestion[] =>
  rows.map((row, index) => {
    const focus = row.focus ?? 0;
    const against = row.against ?? 1;
    const answer = row.kind === "total" ? row.counts.reduce((a, b) => a + b, 0)
      : row.kind === "more" ? row.counts[focus] - row.counts[against]
      : row.kind === "most" ? row.counts.indexOf(Math.max(...row.counts)) + 1
      : row.counts[focus];
    const names = ["Apples", "Pears", "Plums"];
    const prompt = row.kind === "total" ? "How many altogether?"
      : row.kind === "more" ? `How many more ${names[focus]} than ${names[against]}?`
      : row.kind === "most" ? "Which group has the most?"
      : `How many ${names[focus]}?`;
    const explanation = row.kind === "total"
      ? `${row.counts.join(" + ")} = ${answer}. "Altogether" means every column, so none of them can be left out.`
      : row.kind === "more"
        ? `${row.counts[focus]} − ${row.counts[against]} = ${answer}. "How many more" is a comparison, and comparing is subtracting — pair them off and ${answer} are left over.`
        : row.kind === "most"
          ? `${names[answer - 1]}, with ${row.counts[answer - 1]}. The tallest column is the biggest number because every column counts one object per square.`
          : `${answer} ${names[focus]}. Count up that one column only — the chart keeps each group in its own column so they never get mixed up.`;
    return {
      id: qid(skillId),
      title: `Read the chart`,
      instruction: prompt,
      technique: CountingTechnique.DATA_CHART,
      skillId,
      difficulty: band(index, rows.length),
      objectId: "star",
      targetCount: answer,
      config: {
        dataKind: row.kind, dataCounts: row.counts,
        dataCategories: names.slice(0, row.counts.length), dataFocus: focus, dataAgainst: against,
        explanation,
      },
    };
  });

const shape = (
  skillId: string,
  rows: Array<{ task: "sides" | "corners" | "compose" | "shares"; shape: string; shares?: number }>,
): GeneratedQuestion[] => {
  const sides: Record<string, number> = { triangle: 3, square: 4, rectangle: 4, pentagon: 5, hexagon: 6, circle: 0 };
  const order = ["triangle", "square", "rectangle", "pentagon", "hexagon", "circle"];
  // Mirrors COMPOSED_FROM in ShapeLabCanvas. The piece count matters: two triangles make a
  // square, but it takes six to make a hexagon — a prompt that says "two" for both is wrong.
  const composed: Record<string, { part: string; pieces: number }> = {
    square: { part: "triangle", pieces: 2 },
    rectangle: { part: "square", pieces: 2 },
    hexagon: { part: "triangle", pieces: 6 },
  };
  const shareWord: Record<number, string> = { 2: "halves", 4: "fourths" };
  return rows.map((row, index) => {
    const build = composed[row.shape] ?? { part: "triangle", pieces: 2 };
    const shares = row.shares === 4 ? 4 : 2;
    const answer = row.task === "shares" ? shares
      : row.task === "compose" ? order.indexOf(build.part) + 1
      : sides[row.shape];
    const prompt = row.task === "sides" ? `How many sides does the ${row.shape} have?`
      : row.task === "corners" ? `How many corners does the ${row.shape} have?`
      : row.task === "compose" ? `This ${row.shape} is cut into ${build.pieces} equal pieces. What shape is each piece?`
      : `The ${row.shape} is cut into ${shares} equal parts. What is each part called?`;
    const explanation = row.task === "compose"
      ? `Each piece is a ${build.part} — ${build.pieces} of them fit together exactly to make a ${row.shape}, with no gaps and nothing sticking out.`
      : row.task === "shares"
        ? `${shares} equal parts are called ${shareWord[shares]}. They only count as ${shareWord[shares]} if the parts are the same size.`
        // "every shape has as many corners as sides" is not true of a circle, and a Grade 1
        // explanation is still allowed to be exact about what it is claiming.
        : `A ${row.shape} has ${sides[row.shape]} sides and ${sides[row.shape]} corners — a shape with straight sides always has as many corners as sides. That is true of every ${row.shape}, fat or thin, whichever way it is turned.`;
    return {
      id: qid(skillId),
      title: row.task === "compose" ? `Build the shape`
        : row.task === "shares" ? `Name the parts`
        : `Count the ${row.task}`,
      instruction: prompt,
      technique: CountingTechnique.SHAPE_LAB,
      skillId,
      difficulty: band(index, rows.length),
      objectId: "star",
      targetCount: answer,
      config: { shapeTask: row.task, shapeName: row.shape, shapeShares: shares, explanation },
    };
  });
};

// ── The curriculum, skill by skill ──────────────────────────────────────────────

export const GRADE_1_MATH_QUESTIONS: SkillQuestions[] = [
  // Unit 1 — Counting & Number Sense to 120
  {
    skillId: "count-read-write-120",
    conceptId: "number.counting.to-120",
    questions: [
      ...numberPath("count-read-write-120", "count_forward", [
        { start: 6, end: 11 }, { start: 27, end: 33 }, { start: 48, end: 54 },
      ]),
      ...numberPath("count-read-write-120", "find_number", [
        { start: 73, end: 73 }, { start: 108, end: 108 },
      ], "chart"),
    ],
  },
  {
    skillId: "count-on-any-number",
    conceptId: "number.counting.count-on",
    questions: [
      ...countOn("count-on-any-number", [[5, 3], [8, 4], [10, 5]]),
      ...numberPath("count-on-any-number", "count_forward", [
        { start: 36, end: 42 }, { start: 87, end: 93 },
      ]),
    ],
  },
  {
    skillId: "represent-quantities",
    conceptId: "number.counting.represent-quantity",
    questions: [
      ...counting("represent-quantities", CountingTechnique.SUBITIZE, [
        { count: 3 }, { count: 5 },
      ]),
      ...counting("represent-quantities", CountingTechnique.DIFFERENT_ARRANGEMENTS, [
        { count: 7, pattern: "circle" }, { count: 9, pattern: "grid" }, { count: 12, pattern: "scatter" },
      ]),
    ],
  },

  // Unit 2 — Addition & Subtraction Stories
  {
    skillId: "add-take-stories",
    conceptId: "operations.story.add-to-take-from",
    questions: story("add-take-stories", [
      { type: "add_to", unknown: "result", first: 4, second: 3, answer: 7, who: "Koda" },
      { type: "add_to", unknown: "change", first: 5, second: 4, answer: 4, who: "Mia" },
      { type: "take_from", unknown: "result", first: 9, second: 3, answer: 6, who: "Ben" },
      { type: "take_from", unknown: "change", first: 12, second: 5, answer: 5, who: "Ada" },
      { type: "add_to", unknown: "start", first: 6, second: 5, answer: 6, who: "Sam" },
    ]),
  },
  {
    skillId: "part-whole-stories",
    conceptId: "operations.story.part-whole",
    questions: story("part-whole-stories", [
      { type: "put_together", unknown: "result", first: 3, second: 4, answer: 7, who: "Koda" },
      { type: "put_together", unknown: "part", first: 6, second: 3, answer: 3, who: "Mia" },
      // `take_apart` only ever has a part unknown — the mat rejects anything else, so say so
      // here rather than letting a silent normalization decide what the question asks.
      { type: "take_apart", unknown: "part", first: 10, second: 4, answer: 6, who: "Ben" },
      { type: "put_together", unknown: "result", first: 8, second: 5, answer: 13, who: "Ada" },
      { type: "take_apart", unknown: "part", first: 15, second: 7, answer: 8, who: "Sam" },
    ]),
  },
  {
    skillId: "compare-stories",
    conceptId: "operations.story.compare",
    questions: story("compare-stories", [
      { type: "compare", first: 7, second: 4, answer: 3, who: "Koda" },
      { type: "compare", first: 9, second: 5, answer: 4, who: "Mia" },
      { type: "compare", first: 12, second: 8, answer: 4, who: "Ben" },
      { type: "compare", first: 14, second: 6, answer: 8, who: "Ada" },
      { type: "compare", first: 18, second: 11, answer: 7, who: "Sam" },
    ]),
  },
  {
    skillId: "add-three-numbers",
    conceptId: "operations.addition.three-addends",
    questions: story("add-three-numbers", [
      { type: "three_addends", first: 2, second: 3, third: 4, answer: 9, who: "Koda" },
      { type: "three_addends", first: 5, second: 2, third: 3, answer: 10, who: "Mia" },
      { type: "three_addends", first: 4, second: 4, third: 6, answer: 14, who: "Ben" },
      { type: "three_addends", first: 6, second: 5, third: 5, answer: 16, who: "Ada" },
      { type: "three_addends", first: 7, second: 6, third: 6, answer: 19, who: "Sam" },
    ]),
  },

  // Unit 3 — How Addition & Subtraction Work
  {
    skillId: "addition-properties",
    conceptId: "operations.addition.commutative",
    questions: [
      // Deliberate pairs: the same two addends both ways round, so the child meets the property.
      ...addition("addition-properties", CountingTechnique.ADDITION_SANDBOX,
        [[3, 6], [6, 3], [2, 8], [8, 2], [4, 5]],
        (a, b) => `${a} + ${b} = ${a + b}, and so does ${b} + ${a}. Swapping the two groups round never changes how many there are altogether — so learning one fact gives you two.`),
    ],
  },
  {
    skillId: "subtraction-missing-addend",
    conceptId: "operations.subtraction.think-addition",
    // "Think addition to subtract" *is* a missing addend, so it belongs on the equation mat
    // rather than on a typed worksheet. `5 + ? = 8` with both groups drawn is the strategy;
    // "8 − 5 = ?" with a note telling the child to think about it is not.
    questions: equation("subtraction-missing-addend", [
      { first: 5, second: 3, hide: "second", why: "5 + ? = 8, so ? is 3 — which also answers 8 − 5. Subtraction asks what is missing, so an addition fact you already know can answer it." },
      { first: 6, second: 4, hide: "second", why: "6 + ? = 10, so ? is 4 — which also answers 10 − 6. Every pair that makes 10 answers a subtraction from 10." },
      { first: 9, second: 3, hide: "second", why: "9 + ? = 12, so ? is 3 — which also answers 12 − 9. Counting up from 9 to 12 is quicker than counting back." },
      { first: 8, second: 7, hide: "second", why: "8 + ? = 15, so ? is 7 — which also answers 15 − 8. Adding on from the smaller number keeps the count short." },
      { first: 9, second: 8, hide: "second", why: "9 + ? = 17, so ? is 8 — which also answers 17 − 9. Add 1 to reach 10, then 7 more to reach 17: that is 8." },
    ]),
  },

  // Unit 4 — Addition & Subtraction Within 20
  {
    skillId: "counting-operation-connection",
    conceptId: "operations.counting.connect",
    questions: [
      ...countOn("counting-operation-connection", [[6, 3], [9, 4]]),
      ...countBack("counting-operation-connection", [[11, 3], [14, 5], [15, 6]]),
    ],
  },
  {
    skillId: "strategies-within-20",
    conceptId: "operations.addition.make-ten",
    questions: addition("strategies-within-20", CountingTechnique.ADDITION_SANDBOX,
      [[8, 4], [9, 5], [7, 6], [8, 7], [9, 8]],
      // The whole point of this skill is the strategy, not the sum, so the explanation walks
      // the make-a-ten move rather than restating the answer.
      (a, b) => `Make a ten first: move ${10 - a} from the ${b} across to turn ${a} into 10, and ${b - (10 - a)} are left. 10 + ${b - (10 - a)} = ${a + b}, which is much easier than counting on ${b} times.`),
  },
  {
    skillId: "fluency-within-10",
    conceptId: "operations.fluency.within-10",
    questions: [
      ...addition("fluency-within-10", CountingTechnique.ADDITION_SANDBOX, [[3, 4], [5, 2], [6, 3]]),
      ...subtraction("fluency-within-10", CountingTechnique.SUBTRACTION_SANDBOX, [[9, 4], [10, 7]]),
    ],
  },

  // Unit 5 — Equations & Unknowns
  {
    skillId: "meaning-of-equal",
    conceptId: "algebra.equality.equal-sign",
    // The mat shows both sides of the equation, so "what makes this true" is concrete.
    questions: [
      ...equation("meaning-of-equal", [
        { first: 6, second: 3, hide: "result" },
        { first: 4, second: 5, hide: "result" },
        { op: "subtract", first: 9, second: 4, hide: "result" },
      ]),
      // Judging a finished equation is the other half of 1.OA.D.7. A child who only ever sees
      // `a + b = ?` reads "=" as "work it out now"; `5 + 2 = 3 + 4` is what breaks that.
      ...judgeEquation("meaning-of-equal", [
        { first: 5, second: 2, claim: [3, 4] },
        { op: "subtract", first: 8, second: 2, claim: [5] },
      ]),
    ],
  },
  {
    skillId: "unknown-number",
    conceptId: "algebra.equality.unknown-number",
    questions: equation("unknown-number", [
      { first: 8, second: 3, hide: "second" },
      { first: 5, second: 4, hide: "first" },
      { op: "subtract", first: 13, second: 5, hide: "second" },
      { first: 6, second: 8, hide: "second" },
      { op: "subtract", first: 12, second: 5, hide: "first" },
    ]),
  },

  // Unit 6 — Tens, Ones & Two-Digit Numbers
  {
    skillId: "bundle-ten",
    conceptId: "number.place-value.make-a-ten",
    questions: groupTens("bundle-ten", [11, 12, 13, 15, 20]),
  },
  {
    skillId: "teen-numbers",
    conceptId: "number.place-value.teen-numbers",
    questions: [
      ...groupTens("teen-numbers", [14, 16, 18]),
      // `read_number` rather than `build_number`: a child who can only build 17 when told
      // "17" has not shown they can read one ten and seven ones as seventeen.
      ...placeValue("teen-numbers", "read_number", [17, 19]),
    ],
  },
  {
    skillId: "multiples-of-ten",
    conceptId: "number.place-value.multiples-of-ten",
    questions: [
      ...placeValue("multiples-of-ten", "build_number", [30, 40, 60]),
      ...placeValue("multiples-of-ten", "read_number", [80, 90]),
    ],
  },
  {
    skillId: "compare-two-digit",
    conceptId: "number.place-value.compare-two-digit",
    questions: compare("compare-two-digit", [[42, 24], [57, 75], [38, 83], [61, 16], [45, 45]]),
  },

  // Unit 7 — Add & Subtract with Place Value
  {
    skillId: "add-within-100",
    conceptId: "number.place-value.add-within-100",
    questions: addition("add-within-100", CountingTechnique.ADDITION_COLUMN,
      [[23, 4], [35, 20], [47, 30], [52, 6], [64, 20]],
      (a, b) => b % 10 === 0
        ? `${a} + ${b} = ${a + b}. Adding whole tens only changes the tens: ${Math.floor(a / 10)} tens plus ${b / 10} tens is ${Math.floor((a + b) / 10)} tens, and the ${a % 10} ones never move.`
        : `${a} + ${b} = ${a + b}. Adding ones only changes the ones: ${a % 10} + ${b} = ${(a % 10) + b}, and the ${Math.floor(a / 10)} tens stay exactly as they were.`),
  },
  {
    skillId: "ten-more-less",
    conceptId: "number.place-value.ten-more-ten-less",
    questions: [
      ...numberPath("ten-more-less", "ten_more", [{ start: 34, end: 44 }, { start: 57, end: 67 }], "chart"),
      ...numberPath("ten-more-less", "ten_less", [{ start: 64, end: 54 }, { start: 82, end: 72 }, { start: 45, end: 35 }], "chart"),
    ],
  },
  {
    skillId: "subtract-tens",
    conceptId: "number.place-value.subtract-multiples-of-ten",
    questions: subtraction("subtract-tens", CountingTechnique.SUBTRACTION_COLUMN,
      [[50, 20], [70, 30], [60, 40], [90, 50], [80, 60]],
      (m, s) => `${m} − ${s} = ${m - s}. Think in tens: ${m / 10} tens take away ${s / 10} tens leaves ${(m - s) / 10} tens. The ones column is all zeros, so there is nothing to regroup.`),
  },

  // ── Units 8-11: no manipulative yet. Choice questions until the canvases exist. ──
  {
    skillId: "compare-order-length",
    conceptId: "measurement.length.compare",
    questions: measure("compare-order-length", [
      { task: "longest", lengths: [3, 6, 4] },
      { task: "shortest", lengths: [5, 2, 7] },
      { task: "longest", lengths: [8, 4, 6] },
      { task: "shortest", lengths: [9, 3, 5] },
      { task: "longest", lengths: [2, 11, 7] },
    ]),
  },
  {
    skillId: "measure-length-units",
    conceptId: "measurement.length.units",
    questions: measure("measure-length-units", [
      { task: "measure", lengths: [3] }, { task: "measure", lengths: [5] },
      { task: "measure", lengths: [6] }, { task: "measure", lengths: [8] },
      { task: "measure", lengths: [10] },
    ]),
  },
  {
    skillId: "time-hour",
    conceptId: "measurement.time.hour",
    questions: clock("time-hour", [[3, 0], [7, 0], [9, 0], [11, 0], [5, 0]]),
  },
  {
    skillId: "time-half-hour",
    conceptId: "measurement.time.half-hour",
    questions: clock("time-half-hour", [[2, 30], [4, 30], [8, 30], [1, 30], [10, 30]]),
  },
  {
    skillId: "organize-data",
    conceptId: "data.categories.organize",
    questions: chart("organize-data", [
      { kind: "count", counts: [3, 4, 2], focus: 0 },
      { kind: "count", counts: [5, 1, 6], focus: 2 },
      { kind: "total", counts: [3, 5, 1] },
      { kind: "total", counts: [4, 4, 2] },
      { kind: "most", counts: [2, 6, 3] },
    ]),
  },
  {
    skillId: "interpret-data",
    conceptId: "data.categories.interpret",
    questions: chart("interpret-data", [
      { kind: "more", counts: [6, 2, 4], focus: 0, against: 1 },
      { kind: "more", counts: [7, 3, 5], focus: 0, against: 1 },
      { kind: "more", counts: [9, 5, 2], focus: 0, against: 2 },
      { kind: "total", counts: [8, 4, 3] },
      { kind: "most", counts: [4, 9, 6] },
    ]),
  },
  {
    skillId: "shape-attributes",
    conceptId: "geometry.shapes.attributes",
    questions: shape("shape-attributes", [
      { task: "sides", shape: "triangle" }, { task: "corners", shape: "square" },
      { task: "sides", shape: "pentagon" }, { task: "sides", shape: "hexagon" },
      { task: "corners", shape: "rectangle" },
    ]),
  },
  {
    skillId: "compose-shapes",
    conceptId: "geometry.shapes.compose",
    questions: shape("compose-shapes", [
      { task: "compose", shape: "square" }, { task: "compose", shape: "rectangle" },
      { task: "compose", shape: "hexagon" }, { task: "sides", shape: "square" },
      { task: "corners", shape: "hexagon" },
    ]),
  },
  {
    skillId: "equal-shares",
    conceptId: "geometry.fractions.equal-shares",
    questions: shape("equal-shares", [
      { task: "shares", shape: "circle", shares: 2 }, { task: "shares", shape: "circle", shares: 4 },
      { task: "shares", shape: "rectangle", shares: 2 }, { task: "shares", shape: "square", shares: 4 },
      { task: "shares", shape: "rectangle", shares: 4 },
    ]),
  },
];
