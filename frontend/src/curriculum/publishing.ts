import type { Assignment } from "../api/assignments";

/** Only live learners move automatically; historical and paused work stays pinned. */
export const activeAssignmentsToUpgrade = (
  assignments: Assignment[],
  curriculumId: string,
  releaseId: string,
): Assignment[] => assignments.filter(assignment =>
  assignment.curriculumId === curriculumId
  && assignment.status === "active"
  && assignment.releaseId !== releaseId,
);
