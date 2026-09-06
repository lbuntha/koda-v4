import { describe, expect, it } from "vitest";
import { DEFAULT_SUBJECTS, parseSubjects, subjectForSkill, validateSubjects } from "./subjects";

describe("admin subject lookup", () => {
  it("groups the three math skills and classifies Observation on first use", () => {
    const catalog = parseSubjects(undefined);
    for (const id of ["counting", "addition", "subtraction"]) {
      expect(subjectForSkill(catalog, id)?.name).toBe("Math");
    }
    expect(subjectForSkill(catalog, "observation")?.name).toBe("Thinking");
  });
  it("keeps admin renames and assignments when reading the offline cache", () => {
    const catalog = parseSubjects(JSON.stringify({ subjects: [{ id: "math", name: "Mathematics" }], assignments: { observation: "math" } }));
    expect(subjectForSkill(catalog, "observation")?.name).toBe("Mathematics");
    expect(subjectForSkill(catalog, "counting")).toBeUndefined();
  });
  it("allows removing all subjects without resurrecting defaults", () => {
    expect(parseSubjects('{"subjects":[],"assignments":{}}').subjects).toEqual([]);
  });
  it("rejects duplicate names and dangling assignments", () => {
    expect(validateSubjects({ subjects: [{ id: "one", name: "Math" }, { id: "two", name: " math " }], assignments: {} })).toMatch(/unique/);
    expect(validateSubjects({ subjects: [], assignments: { counting: "math" } })).toMatch(/Reassign/);
  });
  it("recovers safely from a damaged offline cache", () => {
    for (const value of ["bad json", "null", '{"subjects":[null]}']) {
      expect(parseSubjects(value)).toEqual(DEFAULT_SUBJECTS);
    }
  });
});
