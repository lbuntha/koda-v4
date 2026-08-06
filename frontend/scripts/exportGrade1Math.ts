/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Verify and export every Grade 1 Mathematics question for the backend seed.
 *
 *     npm run export:grade1-math
 *
 * Nothing here trusts the recipes. Each generated question is checked against the same
 * constraints the studio and the server apply, and a failure exits non-zero so a bad question
 * cannot reach a child:
 *
 *   • the skill exists in `grade1MathTemplate.ts` — a typo'd skill id would author a question
 *     nothing can serve, and every skill must end up with enough questions to meet minQuestions;
 *   • `targetCount` is inside the technique's authored range, read from the component's own AI
 *     schema rather than restated here;
 *   • the answer the app derives from config equals the answer the question claims — this is
 *     the check that catches "3 + 4" labelled as 8;
 *   • choice questions carry an answer that is actually one of the offered options;
 *   • the title does not contain the answer — `GameLauncher` renders it as the page `<h1>`,
 *     so "Count 12" and "Half past 2" were handing the answer to the child on arrival;
 *   • every question explains itself, and the explanation is not a copy of the prompt;
 *   • concept ids are well-formed and unique, because a release freezes them forever;
 *   • no two questions are identical.
 *
 * Commit the output; the seed reads it and never reaches into the frontend.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { GRADE_1_MATH_QUESTIONS, type GeneratedQuestion } from "../src/curriculum/grade1MathQuestions";
import { createGrade1MathTemplate } from "../src/curriculum/grade1MathTemplate";
import { CONCEPT_ID_PATTERN } from "../src/curriculum/types";
import { SCHEMA_REGISTRY } from "../src/components/studio/ai-generator/schemas";
import { solvedSelection } from "../src/student/answerSelection";
import type { CountingQuestion } from "../src/types";

const OUTPUT = resolve(import.meta.dirname, "../../backend/scripts/data/grade1_math_questions.json");
const TREE_OUTPUT = resolve(import.meta.dirname, "../../backend/scripts/data/grade1_math_tree.json");

const template = createGrade1MathTemplate({
  gradeId: "grade-1", gradeLabel: "Grade 1", gradeOrder: 1,
  subjectId: "grade-1-math", subjectLabel: "Mathematics", subjectOrder: 1,
});
/**
 * The template prefixes every id (`g1-math-skill-count-read-write-120`) while the recipes name
 * the skill plainly. Resolve here rather than repeating the prefix in 30 recipes, where one
 * typo would silently author questions for a skill that does not exist.
 */
const SKILL_PREFIX = "g1-math-skill-";
const skillsById = new Map(template.skills.map(skill => [skill.id, skill]));
const resolveSkillId = (recipeSkillId: string) => `${SKILL_PREFIX}${recipeSkillId}`;
const schemaFor = (technique: string) => SCHEMA_REGISTRY.find(s => s.technique === technique);

/** Answers the app can derive from config alone. Choice questions carry a private key instead. */
const derivable = (question: GeneratedQuestion) =>
  solvedSelection(question as unknown as CountingQuestion);

/**
 * Techniques whose title is the problem written out — an equation with the unknown shown as
 * "?", or a comparison. Numbers there are the question, not the answer.
 */
const TITLE_MAY_HOLD_NUMBERS = new Set<string>([
  "EQUATION_MAT", "COMPARE_NUMBERS", "ADDITION_SANDBOX", "SUBTRACTION_SANDBOX",
  "ADDITION_COLUMN", "SUBTRACTION_COLUMN", "COUNT_ON", "COUNT_BACK",
]);

function problemsWith(question: GeneratedQuestion, conceptId: string): string[] {
  const problems: string[] = [];

  if (!skillsById.has(question.skillId)) {
    problems.push(`skill "${question.skillId}" is not in the Grade 1 Maths template`);
  }

  const schema = schemaFor(question.technique);
  if (!schema) {
    problems.push(`${question.technique} has no schema — retired component?`);
  } else {
    const { min, max } = schema.topLevelFields.targetCount;
    if (question.targetCount < min || question.targetCount > max) {
      problems.push(`targetCount ${question.targetCount} outside ${question.technique} range ${min}-${max}`);
    }
  }

  const derived = derivable(question);
  if (derived !== null && Number(derived) !== question.targetCount) {
    problems.push(`config solves to ${derived} but the question claims ${question.targetCount}`);
  }

  const config = question.config as Record<string, any>;
  if (!Number.isInteger(config.answerChoiceSlot) || config.answerChoiceSlot < 0 || config.answerChoiceSlot > 3) {
    problems.push("answerChoiceSlot must be an integer from 0 to 3");
  }
  if (config.flexibleMode === "multichoice") {
    const options: string[] = config.flexibleOptions ?? [];
    if (options.length < 2) problems.push("multichoice question has fewer than two options");
    if (!options.includes(config.flexibleCorrectAnswer)) {
      problems.push(`correct answer "${config.flexibleCorrectAnswer}" is not one of the options`);
    }
  }
  if (config.flexibleMode === "textinput" && !config.flexibleCorrectAnswer) {
    problems.push("text question has no answer key");
  }

  // The title is the page heading, above the canvas. A bare number in it that happens to be
  // the answer is the answer, printed. Techniques whose title is the equation itself are
  // exempt: "8 + ? = 11" contains no answer, and "42 ? 24" is the question.
  if (!TITLE_MAY_HOLD_NUMBERS.has(question.technique)) {
    const numbers: string[] = question.title.match(/\d+/g) ?? [];
    if (numbers.includes(String(question.targetCount))) {
      problems.push(`title "${question.title}" contains the answer ${question.targetCount}`);
    }
  }

  const explanation = String(config.explanation ?? "").trim();
  if (!explanation) {
    problems.push("no explanation — nothing is shown to the child after they solve it");
  } else if (explanation === question.instruction.trim() || explanation === question.title.trim()) {
    problems.push("the explanation just repeats the question");
  }

  if (!CONCEPT_ID_PATTERN.test(conceptId)) {
    problems.push(`concept id "${conceptId}" is not a dotted lowercase name`);
  }

  return problems;
}

const rows = GRADE_1_MATH_QUESTIONS.flatMap((skill, skillIndex) =>
  skill.questions.map((raw, questionIndex) => {
    const question = {
      ...raw,
      skillId: resolveSkillId(raw.skillId),
      config: {
        ...raw.config,
        // Every skill rotates A/B/C/D, while the duplicated slot in a five-question bank
        // shifts to the next letter for the next skill. This balances the whole curriculum,
        // not merely each individual activity.
        answerChoiceSlot: (questionIndex + skillIndex) % 4,
      },
    };
    return {
    ...question,
    conceptId: skill.conceptId,
    needsCanvas: skill.needsCanvas ?? false,
    problems: problemsWith(question, skill.conceptId),
  };
  }),
);

// ── Curriculum-wide checks ──────────────────────────────────────────────────────

const seenConcept = new Map<string, string>();
for (const skill of GRADE_1_MATH_QUESTIONS) {
  const owner = seenConcept.get(skill.conceptId);
  if (owner) {
    for (const row of rows.filter(r => r.skillId === resolveSkillId(skill.skillId))) {
      row.problems.push(`concept id "${skill.conceptId}" already used by "${owner}"`);
    }
  }
  seenConcept.set(skill.conceptId, skill.skillId);
}

const seenQuestion = new Map<string, string>();
for (const row of rows) {
  // The same signature the studio's own de-duplication uses (questionOps.ts). Config alone
  // is not enough: five true/false questions differ only in their prompt, which lives in the
  // title, and five ten-frame boards differ only in targetCount.
  const fingerprint = `${row.skillId}:${row.technique}:${row.title}:${row.objectId}:${row.targetCount}:${JSON.stringify(row.config)}`;
  const owner = seenQuestion.get(fingerprint);
  if (owner) row.problems.push(`identical to ${owner}`);
  else seenQuestion.set(fingerprint, row.id);
}

const shortfalls: string[] = [];
for (const [skillId, skill] of skillsById) {
  const skillRows = rows.filter(row => row.skillId === skillId);
  const authored = skillRows.filter(row => row.problems.length === 0).length;
  if (authored < skill.minQuestions) {
    shortfalls.push(`${skillId}: ${authored}/${skill.minQuestions} usable questions`);
  }
  const slots = new Set(skillRows.map(row => row.config.answerChoiceSlot));
  if (skillRows.length >= 4 && slots.size < 4) {
    shortfalls.push(`${skillId}: correct answers do not cover all four choice slots`);
  }
}

const slotCounts = [0, 1, 2, 3].map(slot =>
  rows.filter(row => row.config.answerChoiceSlot === slot).length,
);
if (Math.max(...slotCounts) - Math.min(...slotCounts) > 1) {
  shortfalls.push(`curriculum answer slots are imbalanced: ${slotCounts.join("/")}`);
}

// The tree travels with the questions so the seed has one source of truth for both. Concept
// ids are stamped on here rather than in the template, because they belong to the content
// recipes: the template says what the skill *is*, the recipes say what it teaches.
const conceptBySkillId = new Map(
  GRADE_1_MATH_QUESTIONS.map(skill => [resolveSkillId(skill.skillId), skill.conceptId]),
);
const treeOut = {
  ...template,
  skills: template.skills.map(skill => ({
    ...skill,
    ...(conceptBySkillId.has(skill.id) ? { conceptId: conceptBySkillId.get(skill.id) } : {}),
  })),
};

mkdirSync(dirname(TREE_OUTPUT), { recursive: true });
writeFileSync(TREE_OUTPUT, JSON.stringify(treeOut, null, 2) + "\n", "utf-8");

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(
  rows.map(({ problems, ...row }) => ({ ...row, usable: problems.length === 0, problems })),
  null, 2) + "\n", "utf-8");

const broken = rows.filter(row => row.problems.length > 0);
const skillsCovered = new Set(rows.filter(r => r.problems.length === 0).map(r => r.skillId)).size;
console.log(
  `wrote ${rows.length} questions across ${skillsCovered}/${skillsById.size} skills `
  + `(${rows.length - broken.length} usable) -> ${OUTPUT}`,
);
for (const row of broken) {
  console.warn(`  BAD ${row.id} [${row.skillId}]`);
  for (const problem of row.problems) console.warn(`      ${problem}`);
}
for (const shortfall of shortfalls) console.warn(`  SHORT ${shortfall}`);
if (broken.length > 0 || shortfalls.length > 0) process.exitCode = 1;
