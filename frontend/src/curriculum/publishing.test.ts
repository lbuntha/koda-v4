import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Assignment } from "../api/assignments";
import { activeAssignmentsToUpgrade } from "./publishing";

const assignment = (overrides: Partial<Assignment>): Assignment => ({
  id: "a1",
  ownerId: "owner",
  studentId: "student",
  curriculumId: "curriculum-a",
  releaseId: "old-release",
  gradeId: "g1",
  scope: { kind: "all", ids: [] },
  mode: "scheduled",
  schedule: null,
  priority: 100,
  placementRequired: false,
  status: "active",
  createdAt: "2026-07-30T00:00:00Z",
  updatedAt: "2026-07-30T00:00:00Z",
  ...overrides,
});

describe("activeAssignmentsToUpgrade", () => {
  it("selects active learners on an older release of this curriculum", () => {
    const rows = [
      assignment({ id: "upgrade" }),
      assignment({ id: "already-current", releaseId: "new-release" }),
      assignment({ id: "paused", status: "paused" }),
      assignment({ id: "other", curriculumId: "curriculum-b" }),
    ];
    assert.deepEqual(
      activeAssignmentsToUpgrade(rows, "curriculum-a", "new-release").map(row => row.id),
      ["upgrade"],
    );
  });
});
