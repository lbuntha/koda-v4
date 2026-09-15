import { describe, expect, it } from "vitest";
import cases from "../../../server/tests/fixtures/mastery_cases.json";
import type { ConceptTotals } from "./learningLog";
import { masteryFrom } from "./mastery";

/**
 * The app and the server must judge a concept the same way.
 *
 * `services/mastery.py` is a second implementation of `masteryFrom`, written so
 * a parent can be told about a lesson the moment it lands. This fixture is the
 * contract between them: `test_progress_notifications.py` asserts every case
 * against the Python, and this asserts the same cases against the TypeScript.
 */
const empty: ConceptTotals = {
  conceptKey: "c",
  skillIds: [],
  questionsAnswered: 0,
  correctFirstTry: 0,
  supportsUsed: 0,
  lessonsCompleted: 0,
  lessonsAbandoned: 0,
  totalResponseMs: 0,
  errors: {},
  practisedOn: [],
  lastSeenTs: "2026-08-16T00:00:00Z",
};

describe("mastery parity with the server", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(masteryFrom({ ...empty, ...c.totals } as ConceptTotals).status).toBe(c.status);
  });
});
