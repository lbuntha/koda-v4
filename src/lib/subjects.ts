import { useMemo, useSyncExternalStore } from "react";
import { System } from "./sync/system";

export const SUBJECT_SETTING = "learning.subjects";
export interface Subject { id: string; name: string }
export interface SubjectCatalog { subjects: Subject[]; assignments: Record<string, string> }
export const DEFAULT_SUBJECTS: SubjectCatalog = {
  subjects: [{ id: "math", name: "Math" }, { id: "thinking", name: "Thinking" }],
  assignments: { counting: "math", addition: "math", subtraction: "math", observation: "thinking" },
};

export function validateSubjects(catalog: SubjectCatalog): string | null {
  if (!Array.isArray(catalog.subjects) || catalog.subjects.length > 100) return "Use up to 100 subjects.";
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const subject of catalog.subjects) {
    if (!subject || typeof subject.id !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(subject.id) || ids.has(subject.id)) return "Each subject needs a unique ID.";
    if (typeof subject.name !== "string" || !subject.name.trim() || subject.name.trim().length > 60) return "Subject names must be 1–60 characters.";
    const name = subject.name.trim().toLowerCase();
    if (names.has(name)) return "Subject names must be unique.";
    ids.add(subject.id);
    names.add(name);
  }
  if (!catalog.assignments || typeof catalog.assignments !== "object" || Array.isArray(catalog.assignments)) return "Choose subjects for your skills.";
  if (Object.values(catalog.assignments).some((id) => typeof id !== "string" || !ids.has(id))) return "Reassign skills before removing their subject.";
  return null;
}

export function parseSubjects(value: unknown): SubjectCatalog {
  try {
    const parsed = JSON.parse(String(value)) as SubjectCatalog;
    return validateSubjects(parsed) ? DEFAULT_SUBJECTS : parsed;
  } catch {
    return DEFAULT_SUBJECTS;
  }
}

export function useSubjects(): SubjectCatalog {
  const settings = useSyncExternalStore(System.subscribe, System.snapshot);
  return useMemo(() => parseSubjects(settings[SUBJECT_SETTING]), [settings]);
}

export function subjectForSkill(catalog: SubjectCatalog, skillId: string): Subject | undefined {
  return catalog.subjects.find((subject) => subject.id === catalog.assignments[skillId]);
}
