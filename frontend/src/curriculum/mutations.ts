/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure edits over a CurriculumTree — same style as types.ts's
 * auditCurriculum/computeSkillCoverage: no CountingQuestion import, ever
 * (see the "two hard boundaries" note in the build plan). Every function
 * returns a NEW tree; none mutate the tree passed in.
 */

import { CurriculumTree, Grade, Subject, Unit, Skill, DEFAULT_MIN_QUESTIONS } from "./types";

/** Same shape as analyticsLogger.ts's genId — short, prefixed, collision-safe enough for local, single-teacher use. */
const genId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const nextOrder = (items: { order: number }[]) =>
  items.length ? Math.max(...items.map(i => i.order)) + 1 : 1;

export function addGrade(tree: CurriculumTree, label: string): CurriculumTree {
  const grade: Grade = { id: genId("grade"), label, order: nextOrder(tree.grades) };
  return { ...tree, grades: [...tree.grades, grade] };
}

export function addSubject(tree: CurriculumTree, gradeId: string, label: string): CurriculumTree {
  const subject: Subject = { id: genId("subject"), gradeId, label, order: nextOrder(tree.subjects.filter(s => s.gradeId === gradeId)) };
  return { ...tree, subjects: [...tree.subjects, subject] };
}

export function addUnit(tree: CurriculumTree, subjectId: string, label: string): CurriculumTree {
  const unit: Unit = { id: genId("unit"), subjectId, label, order: nextOrder(tree.units.filter(u => u.subjectId === subjectId)) };
  return { ...tree, units: [...tree.units, unit] };
}

export function addSkill(
  tree: CurriculumTree,
  unitId: string,
  input: { label: string; description?: string; standardRef?: string; minQuestions?: number }
): CurriculumTree {
  const skill: Skill = {
    id: genId("skill"),
    unitId,
    label: input.label,
    description: input.description,
    standardRef: input.standardRef,
    minQuestions: input.minQuestions ?? DEFAULT_MIN_QUESTIONS,
    order: nextOrder(tree.skills.filter(s => s.unitId === unitId)),
  };
  return { ...tree, skills: [...tree.skills, skill] };
}

export function renameUnit(tree: CurriculumTree, unitId: string, label: string): CurriculumTree {
  return { ...tree, units: tree.units.map(u => (u.id === unitId ? { ...u, label } : u)) };
}

export function updateSkill(
  tree: CurriculumTree,
  skillId: string,
  patch: Partial<Omit<Skill, "id" | "unitId">>
): CurriculumTree {
  return { ...tree, skills: tree.skills.map(s => (s.id === skillId ? { ...s, ...patch } : s)) };
}

/** orderedUnitIds must be exactly the unit ids belonging to subjectId, in the desired order. */
export function reorderUnits(tree: CurriculumTree, subjectId: string, orderedUnitIds: string[]): CurriculumTree {
  const orderOf = new Map(orderedUnitIds.map((id, i) => [id, i + 1]));
  return {
    ...tree,
    units: tree.units.map(u => (u.subjectId === subjectId && orderOf.has(u.id) ? { ...u, order: orderOf.get(u.id)! } : u)),
  };
}

/** orderedSkillIds must be exactly the skill ids belonging to unitId, in the desired order. */
export function reorderSkills(tree: CurriculumTree, unitId: string, orderedSkillIds: string[]): CurriculumTree {
  const orderOf = new Map(orderedSkillIds.map((id, i) => [id, i + 1]));
  return {
    ...tree,
    skills: tree.skills.map(s => (s.unitId === unitId && orderOf.has(s.id) ? { ...s, order: orderOf.get(s.id)! } : s)),
  };
}

/** Cascades: also drops every skill that belonged to this unit. */
export function removeUnit(tree: CurriculumTree, unitId: string): CurriculumTree {
  return {
    ...tree,
    units: tree.units.filter(u => u.id !== unitId),
    skills: tree.skills.filter(s => s.unitId !== unitId),
  };
}

export function removeSkill(tree: CurriculumTree, skillId: string): CurriculumTree {
  return { ...tree, skills: tree.skills.filter(s => s.id !== skillId) };
}
