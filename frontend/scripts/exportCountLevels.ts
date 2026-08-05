/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Export the counting ladder for the backend seed, refusing to emit a level that would not
 * work for a child.
 *
 *     npm run export:count-levels
 *
 * Liquid Sort's export plays every board with the hint solver and drops the ones that cannot
 * be finished, because a level nobody can complete sits unfinished on a learner's path
 * forever. Counting has no solver, so the equivalent checks are:
 *
 *   1. the count is inside the range the technique's own AI schema validates to — the same
 *      constraint the studio enforces, read from the schema rather than restated here, so a
 *      canvas can never be asked for a board it would reject;
 *   2. the answer the app itself would report for a solved activity (`solvedSelection`, which
 *      is what GameLauncher submits) equals the level's stated target — this is what catches a
 *      config whose parts do not add up, e.g. baseCount 5 + extraCount 3 labelled as 9;
 *   3. no two levels are the same question wearing a different label;
 *   4. the ladder never steps backwards inside a tier.
 *
 * Commit the output; the seed reads it and never reaches into the frontend.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { COUNT_CURRICULUM_LEVELS, TIER_ORDER, type CountLevel } from "../src/components/canvases/countLevels";
import { SCHEMA_REGISTRY } from "../src/components/studio/ai-generator/schemas";
import { solvedSelection } from "../src/student/answerSelection";
import type { CountingQuestion } from "../src/types";

const OUTPUT = resolve(import.meta.dirname, "../../backend/scripts/data/count_levels.json");

/** The question this level becomes — the same shape the studio would have authored. */
function toQuestion(level: CountLevel): CountingQuestion {
  return {
    id: level.id.replace("count_", "q-count-"),
    technique: level.technique,
    title: level.label,
    instruction: "Count them all, then tell me how many.",
    objectId: "apple",
    targetCount: level.targetCount,
    config: { ...level.config },
  } as CountingQuestion;
}

const schemaFor = (technique: string) =>
  SCHEMA_REGISTRY.find(schema => schema.technique === technique);

function problemsWith(level: CountLevel): string[] {
  const problems: string[] = [];

  const schema = schemaFor(level.technique);
  if (!schema) {
    problems.push(`no AI schema registered for ${level.technique} — is it a retired component?`);
  } else {
    const { min, max } = schema.topLevelFields.targetCount;
    if (level.targetCount < min || level.targetCount > max) {
      problems.push(
        `count ${level.targetCount} is outside ${level.technique}'s authored range ${min}-${max}`,
      );
    }
  }

  // What the app would report when a child finishes this activity. A level whose config
  // disagrees with its target would be marked wrong for the right answer.
  const reported = solvedSelection(toQuestion(level));
  if (reported === null) {
    problems.push(`${level.technique} reports no derived answer — it cannot be graded from config`);
  } else if (Number(reported) !== level.targetCount) {
    problems.push(`config solves to ${reported} but the level claims ${level.targetCount}`);
  }

  return problems;
}

const levels = COUNT_CURRICULUM_LEVELS.map(level => ({
  id: level.id,
  label: level.label,
  rationale: level.rationale,
  tier: level.tier,
  technique: level.technique,
  targetCount: level.targetCount,
  config: level.config,
  problems: problemsWith(level),
}));

// ── Ladder-wide checks ──────────────────────────────────────────────────────────

const seen = new Map<string, string>();
for (const level of levels) {
  const fingerprint = `${level.technique}:${level.targetCount}:${JSON.stringify(level.config)}`;
  const owner = seen.get(fingerprint);
  if (owner) level.problems.push(`identical to ${owner}`);
  else seen.set(fingerprint, level.id);
}

// Counts must climb within one technique, not across the whole tier. Counting *back* from
// twelve is harder than counting *on* to fourteen, so comparing their raw counts across a
// change of strategy flags a ladder that is actually ordered correctly. Within a single
// technique the count is the difficulty, and there the rule holds.
for (const tier of TIER_ORDER) {
  for (const technique of new Set(levels.map(level => level.technique))) {
    const run = levels.filter(level => level.tier === tier && level.technique === technique);
    for (let i = 1; i < run.length; i++) {
      if (run[i].targetCount < run[i - 1].targetCount) {
        run[i].problems.push(
          `ladder goes backwards within ${technique}: ${run[i].targetCount} follows ${run[i - 1].targetCount}`,
        );
      }
    }
  }
}

const tierRank = (tier: string) => TIER_ORDER.indexOf(tier as any);
for (let i = 1; i < levels.length; i++) {
  if (tierRank(levels[i].tier) < tierRank(levels[i - 1].tier)) {
    levels[i].problems.push(`tier ${levels[i].tier} follows ${levels[i - 1].tier}`);
  }
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(levels.map(({ problems, ...level }) => ({
  ...level,
  usable: problems.length === 0,
  problems,
})), null, 2) + "\n", "utf-8");

const broken = levels.filter(level => level.problems.length > 0);
console.log(`wrote ${levels.length} levels (${levels.length - broken.length} usable) -> ${OUTPUT}`);
for (const level of broken) {
  console.warn(`  UNUSABLE ${level.id} (${level.label})`);
  for (const problem of level.problems) console.warn(`             ${problem}`);
}
if (broken.length > 0) process.exitCode = 1;
