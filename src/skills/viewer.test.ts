import { describe, expect, it } from "vitest";
import { skill as counting } from "./counting";
import { hiddenReason } from "./registry";
import { ageFromBirthYear, viewerForSession, type Viewer } from "./viewer";

const preview: Viewer = { age: 6, isDeveloper: false, showAllSkills: false };

describe("learner audience viewer", () => {
  it("derives learner age from the server-backed birth year", () => {
    expect(ageFromBirthYear(2018, 2026)).toBe(8);
    const viewer = viewerForSession(
      { learnerBirthYear: 2018, platformRole: "none" } as never,
      preview,
    );
    expect(viewer.age).toBe(new Date().getFullYear() - 2018);
    expect(viewer.showAllSkills).toBe(false);
  });

  it("lets an admin inspect every skill regardless of age or publication", () => {
    const admin = viewerForSession({ platformRole: "admin" } as never, {
      ...preview,
      age: 99,
    });
    expect(admin.showAllSkills).toBe(true);
    expect(hiddenReason(counting, admin)).toBeNull();
  });

  it("does not give a developer the admin age bypass", () => {
    const developer = viewerForSession({ platformRole: "developer" } as never, {
      ...preview,
      age: 99,
    });
    expect(developer.isDeveloper).toBe(true);
    expect(developer.showAllSkills).toBe(false);
    expect(hiddenReason(counting, developer)).toBe("outside-age-range");
  });
});
