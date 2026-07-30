import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  History,
  Layers,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { academicApi, AcademicCatalog } from "../../api/academic";
import type { CurriculumAuditEvent, CurriculumOwner } from "../../api/curriculum";
import { curriculumApi } from "../../api/curriculum";
import {
  curriculumRewards,
  type AchievementIcon,
  type AchievementMetric,
  type CurriculumRewards,
  type CurriculumTree,
  type Grade,
  type Subject,
} from "../../curriculum/types";
import type { CurriculumPersistenceStatus } from "../../curriculum/useCurriculumTree";
import { Badge, Button, Drawer, Input, Label, Select, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from "../ui";

export type CurriculumDetailsTab = "metadata" | "history";

interface MetadataDraft {
  title: string;
  description: string;
  version: string;
  primaryGradeId: string;
  primarySubjectId: string;
  published: boolean;
  grades: Grade[];
  subjects: Subject[];
  rewards: CurriculumRewards;
}

interface CurriculumDetailsDrawerProps {
  curriculumId?: string;
  isOpen: boolean;
  initialTab: CurriculumDetailsTab;
  onClose: () => void;
  tree: CurriculumTree;
  owner: CurriculumOwner | null;
  revision: number;
  createdAt: string | null;
  updatedAt: string | null;
  published: boolean;
  persistenceStatus: CurriculumPersistenceStatus;
  onSave: (draft: MetadataDraft) => void;
}

const actionLabels: Record<string, string> = {
  created: "Curriculum created",
  metadata_updated: "Metadata updated",
  published: "Curriculum published",
  unpublished: "Curriculum returned to draft",
  archived: "Curriculum archived",
  restored: "Curriculum restored",
  unit_added: "Unit added",
  unit_updated: "Unit updated",
  unit_removed: "Unit removed",
  skill_added: "Skill added",
  skill_updated: "Skill updated",
  skill_removed: "Skill removed",
  scope_updated: "Grade or subject scope updated",
  worksheet_assignment_changed: "Worksheet assignment changed",
  saved: "Curriculum saved",
};

const dateLabel = (value: string | null | undefined) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
};

const itemLabels = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (!item || typeof item !== "object") return "";
    const row = item as Record<string, unknown>;
    return String(row.label || row.title || row.id || row.questionId || "");
  }).filter(Boolean);
};

const eventDetail = (event: CurriculumAuditEvent): string => {
  const summary = event.summary || {};
  const fields = Array.isArray(summary.changedFields) ? summary.changedFields.map(String) : [];
  if (fields.length) return `Changed ${fields.join(", ")}`;
  const items = itemLabels(summary.items);
  if (items.length) return items.join(", ");
  const assignments = itemLabels(summary.assignments);
  if (assignments.length) return `${assignments.length} worksheet${assignments.length === 1 ? "" : "s"}: ${assignments.join(", ")}`;
  if (event.action === "published") return "Status changed to Published";
  if (event.action === "unpublished") return "Status changed to Draft";
  if (event.action === "created") return "Initial curriculum structure and metadata saved";
  return `Revision ${event.revision}`;
};

/**
 * A collapsed group: its header carries the values, so the drawer reads as five short lines
 * until you open the one you came to change. `issue` forces the body open and swaps the
 * chevron for a flag — a collapsed section must never hide a value that blocks saving.
 */
const Section: React.FC<{
  icon: LucideIcon;
  title: string;
  summary: string;
  open: boolean;
  issue?: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ icon: Icon, title, summary, open, issue, onToggle, children }) => (
  <section className="overflow-hidden rounded-xl border border-[#E7E3F6] bg-white">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open || Boolean(issue)}
      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-[#FBFAFF]"
    >
      <Icon size={14} className="shrink-0 text-[#534AB7]" />
      <span className="shrink-0 text-xs font-semibold text-[#0E0B55]">{title}</span>
      <span className="min-w-0 flex-1 truncate text-[10px] text-[#6D6997]">{summary}</span>
      {issue ? (
        <Badge variant="warning" className="shrink-0">Check</Badge>
      ) : open ? (
        <ChevronUp size={13} className="shrink-0 text-[#8D89AE]" />
      ) : (
        <ChevronDown size={13} className="shrink-0 text-[#8D89AE]" />
      )}
    </button>
    {(open || issue) && <div className="border-t border-[#EEEAF8] p-3">{children}</div>}
  </section>
);

const makeDraft = (tree: CurriculumTree, published: boolean): MetadataDraft => {
  const primaryGradeId = tree.primaryGradeId || tree.grades[0]?.id || "";
  const primarySubjectId = tree.primarySubjectId
    || tree.subjects.find(subject => subject.gradeId === primaryGradeId)?.id
    || "";
  return {
    title: tree.title || "",
    description: tree.description || "",
    version: tree.version || "1.0",
    primaryGradeId,
    primarySubjectId,
    published,
    grades: tree.grades,
    subjects: tree.subjects,
    rewards: curriculumRewards(tree),
  };
};

export const CurriculumDetailsDrawer: React.FC<CurriculumDetailsDrawerProps> = ({
  curriculumId,
  isOpen,
  initialTab,
  onClose,
  tree,
  owner,
  revision,
  createdAt,
  updatedAt,
  published,
  persistenceStatus,
  onSave,
}) => {
  const [tab, setTab] = useState<CurriculumDetailsTab>(initialTab);
  const [draft, setDraft] = useState<MetadataDraft>(() => makeDraft(tree, published));
  const [submitted, setSubmitted] = useState(false);
  const [observedSaving, setObservedSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [events, setEvents] = useState<CurriculumAuditEvent[]>([]);
  const [catalog, setCatalog] = useState<AcademicCatalog>({ grades: [], subjects: [] });
  // An empty catalog and a catalog that failed to load look identical on screen — both render
  // no chips — but mean opposite things. Without this the author reads "no grades exist".
  const [catalogError, setCatalogError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) =>
    setOpenSections(current => ({ ...current, [key]: !current[key] }));

  const availableSubjects = useMemo(
    () => draft.subjects.filter(subject => subject.gradeId === draft.primaryGradeId),
    [draft.subjects, draft.primaryGradeId],
  );

  const lockedSubjectIds = useMemo(() => new Set(tree.units.map(unit => unit.subjectId)), [tree.units]);
  const lockedGradeIds = useMemo(() => new Set(tree.subjects.filter(subject => lockedSubjectIds.has(subject.id)).map(subject => subject.gradeId)), [tree.subjects, lockedSubjectIds]);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setDraft(makeDraft(tree, published));
    setSubmitted(false);
    setObservedSaving(false);
    setSaveError(null);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || tab !== "metadata") return;
    let cancelled = false;
    setCatalogError(false);
    void academicApi.list().then(
      response => { if (!cancelled) setCatalog(response); },
      () => { if (!cancelled) setCatalogError(true); },
    );
    return () => { cancelled = true; };
  }, [isOpen, tab]);

  useEffect(() => {
    if (!submitted) return;
    if (persistenceStatus === "saving") setObservedSaving(true);
    if (observedSaving && persistenceStatus === "saved") {
      setSubmitted(false);
      setObservedSaving(false);
      onClose();
    } else if (observedSaving && persistenceStatus === "error") {
      setSubmitted(false);
      setObservedSaving(false);
      setSaveError("The server could not save these changes. Your local cache is still available.");
    }
  }, [submitted, observedSaving, persistenceStatus, onClose]);

  useEffect(() => {
    if (!isOpen || tab !== "history") return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);
    void curriculumApi.audit(100, curriculumId).then(
      response => { if (!cancelled) setEvents(response.events); },
      cause => { if (!cancelled) setHistoryError(cause instanceof Error ? cause.message : "Unable to load audit history"); },
    ).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, tab, revision, curriculumId]);

  const unchanged = JSON.stringify(draft) === JSON.stringify(makeDraft(tree, published));
  const rewardValues = [
    draft.rewards.xp.correctAnswer,
    draft.rewards.xp.firstTryBonus,
    draft.rewards.xp.activityCompletion,
  ];
  const rewardsInvalid = (
    !draft.rewards.quest.label.trim()
    || !Number.isInteger(draft.rewards.quest.activitiesPerSession)
    || draft.rewards.quest.activitiesPerSession < 1
    || draft.rewards.quest.activitiesPerSession > 5
    || rewardValues.some(value => !Number.isInteger(value) || value < 0 || value > 100)
    || !Number.isInteger(draft.rewards.level.xpPerLevel)
    || draft.rewards.level.xpPerLevel < 1
    || draft.rewards.level.xpPerLevel > 10_000
  );
  const achievementsInvalid = draft.rewards.achievements.some(achievement => (
    !achievement.id
    || !achievement.label.trim()
    || !achievement.description.trim()
    || !Number.isInteger(achievement.target)
    || achievement.target < 1
    || achievement.target > 10_000
  )) || new Set(draft.rewards.achievements.map(achievement => achievement.id)).size !== draft.rewards.achievements.length;
  const invalid = (
    !draft.title.trim()
    || !draft.version.trim()
    || !draft.primaryGradeId
    || !draft.primarySubjectId
    || rewardsInvalid
    || achievementsInvalid
  );

  const scopeSummary = [
    draft.grades.map(grade => grade.label).join(", ") || "No grades",
    draft.subjects.map(subject => subject.label).join(", ") || "No subjects",
  ].join(" · ");
  const rewardsSummary = [
    draft.rewards.quest.label || "No quest label",
    `${draft.rewards.quest.activitiesPerSession} activities`,
    `${draft.rewards.level.xpPerLevel || 0} XP per level`,
  ].join(" · ");
  const achievementsSummary = draft.rewards.achievements.length === 0
    ? "No badges configured"
    : `${draft.rewards.achievements.length} badge${draft.rewards.achievements.length === 1 ? "" : "s"}`;
  const ownershipSummary = `${owner?.name || "Local owner"} · updated ${dateLabel(updatedAt)}`;

  const addAchievement = () => {
    const existingIds = new Set(draft.rewards.achievements.map(achievement => achievement.id));
    let sequence = draft.rewards.achievements.length + 1;
    while (existingIds.has(`award-${sequence}`)) sequence += 1;
    setDraft(current => ({
      ...current,
      rewards: {
        ...current.rewards,
        achievements: [
          ...current.rewards.achievements,
          {
            id: `award-${sequence}`,
            label: "",
            description: "",
            metric: "lessonsCompleted",
            target: 1,
            icon: "star",
            accent: "purple",
          },
        ],
      },
    }));
  };

  const handleSave = () => {
    if (invalid) return;
    if (unchanged) {
      onClose();
      return;
    }
    setSaveError(null);
    setSubmitted(true);
    setObservedSaving(false);
    onSave({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
      version: draft.version.trim(),
    });
  };

  const toggleGrade = (gradeId: string) => {
    const included = draft.grades.some(grade => grade.id === gradeId);
    if (included && lockedGradeIds.has(gradeId)) return;
    if (included) {
      const grades = draft.grades.filter(grade => grade.id !== gradeId);
      const subjects = draft.subjects.filter(subject => subject.gradeId !== gradeId);
      const primaryGradeId = draft.primaryGradeId === gradeId ? grades[0]?.id || "" : draft.primaryGradeId;
      const primarySubjectId = subjects.some(subject => subject.id === draft.primarySubjectId)
        ? draft.primarySubjectId
        : subjects.find(subject => subject.gradeId === primaryGradeId)?.id || "";
      setDraft(current => ({ ...current, grades, subjects, primaryGradeId, primarySubjectId }));
      return;
    }
    const item = catalog.grades.find(grade => grade.key === gradeId);
    if (!item) return;
    const grade: Grade = { id: item.key, label: item.name, order: item.order, description: item.description, ageRange: item.age_range, code: item.code, active: item.active };
    setDraft(current => ({ ...current, grades: [...current.grades, grade].sort((a, b) => a.order - b.order), primaryGradeId: current.primaryGradeId || grade.id }));
  };

  const toggleSubject = (subjectId: string) => {
    const included = draft.subjects.some(subject => subject.id === subjectId);
    if (included && lockedSubjectIds.has(subjectId)) return;
    if (included) {
      const subjects = draft.subjects.filter(subject => subject.id !== subjectId);
      const primarySubjectId = draft.primarySubjectId === subjectId
        ? subjects.find(subject => subject.gradeId === draft.primaryGradeId)?.id || ""
        : draft.primarySubjectId;
      setDraft(current => ({ ...current, subjects, primarySubjectId }));
      return;
    }
    const item = catalog.subjects.find(subject => subject.key === subjectId);
    if (!item || !draft.grades.some(grade => grade.id === item.grade_id)) return;
    const subject: Subject = { id: item.key, gradeId: item.grade_id, label: item.name, order: item.order, description: item.description, code: item.code, icon: item.icon, color: item.color, active: item.active };
    setDraft(current => ({ ...current, subjects: [...current.subjects, subject].sort((a, b) => a.order - b.order), primarySubjectId: current.primarySubjectId || subject.id }));
  };

  // `Tabs` has to sit outside `Drawer` so its context reaches both the fixed tab bar and the
  // scrolling body. It must not become a box while doing so: this component is a child of the
  // studio's row layout, and a plain wrapper div would take a flex slot and squash the page.
  // `contents` keeps the provider without generating any layout, and the drawer stays fixed.
  if (!isOpen) return null;

  return (
    <Tabs
      value={tab}
      onValueChange={value => setTab(value as CurriculumDetailsTab)}
      variant="underline"
      className="contents"
    >
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title="Curriculum details"
        widthClassName="w-full sm:w-[500px]"
        subHeader={
          <TabsList aria-label="Curriculum details sections">
            <TabsTrigger value="metadata"><FileText size={14} /> Metadata</TabsTrigger>
            <TabsTrigger value="history"><History size={14} /> Audit history</TabsTrigger>
          </TabsList>
        }
      >
        <TabsContent value="metadata" className="flex min-h-full flex-col">
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="curriculum-title">Title</Label>
                <Input id="curriculum-title" value={draft.title} maxLength={160} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Primary Mathematics" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="curriculum-description">Description</Label>
                <Textarea id="curriculum-description" rows={2} maxLength={2000} value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} placeholder="Purpose, learning scope, and intended learners" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="curriculum-grade">Primary grade</Label>
                <Select
                  id="curriculum-grade"
                  value={draft.primaryGradeId}
                  onChange={event => {
                    const primaryGradeId = event.target.value;
                    const primarySubjectId = draft.subjects.find(subject => subject.gradeId === primaryGradeId)?.id || "";
                    setDraft(current => ({ ...current, primaryGradeId, primarySubjectId }));
                  }}
                >
                  {draft.grades.map(grade => <option key={grade.id} value={grade.id}>{grade.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="curriculum-subject">Primary subject</Label>
                <Select id="curriculum-subject" value={draft.primarySubjectId} onChange={event => setDraft(current => ({ ...current, primarySubjectId: event.target.value }))}>
                  {availableSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.label}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="curriculum-version">Version</Label>
                <Input id="curriculum-version" value={draft.version} maxLength={40} onChange={event => setDraft(current => ({ ...current, version: event.target.value }))} placeholder="1.0" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="curriculum-status">Status</Label>
                <Select id="curriculum-status" value={draft.published ? "published" : "draft"} onChange={event => setDraft(current => ({ ...current, published: event.target.value === "published" }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </Select>
              </div>
            </div>

            <Section
              icon={Layers}
              title="Scope"
              summary={scopeSummary}
              open={Boolean(openSections.scope)}
              onToggle={() => toggleSection("scope")}
            >
              <p className="mb-2.5 text-[10px] leading-relaxed text-[#6D6997]">Choose every grade and subject included in this curriculum. Contexts already used by units stay locked.</p>
              {catalogError && (
                <p className="mb-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-semibold text-amber-800">
                  Couldn’t load the grade and subject list. Reopen this drawer to try again —
                  the choices below may be incomplete until then.
                </p>
              )}
              <Label>Grades</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {catalog.grades.filter(item => item.active).map(item => {
                  const active = draft.grades.some(grade => grade.id === item.key);
                  const locked = active && lockedGradeIds.has(item.key);
                  return <button key={item.key} type="button" aria-pressed={active} onClick={() => toggleGrade(item.key)} title={locked ? "This grade contains units and cannot be removed" : undefined} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${active ? "border-[#534AB7] bg-[#534AB7] text-white" : "border-[#E7E3F6] bg-white text-[#6D6997] hover:border-[#7C6DD8]"} ${locked ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}>{item.name}</button>;
                })}
              </div>
              <Label className="mt-3 block">Subjects</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {catalog.subjects.filter(item => item.active && draft.grades.some(grade => grade.id === item.grade_id)).map(item => {
                  const active = draft.subjects.some(subject => subject.id === item.key);
                  const locked = active && lockedSubjectIds.has(item.key);
                  return <button key={item.key} type="button" aria-pressed={active} onClick={() => toggleSubject(item.key)} title={locked ? "This subject contains units and cannot be removed" : undefined} className={`rounded-full border px-2.5 py-1.5 text-[10px] font-medium transition-colors ${active ? "border-[#534AB7] bg-[#F3F0FF] text-[#534AB7]" : "border-[#E7E3F6] bg-white text-[#6D6997] hover:border-[#7C6DD8]"} ${locked ? "cursor-not-allowed opacity-75" : "cursor-pointer"}`}>{item.name}</button>;
                })}
              </div>
            </Section>

            <Section
              icon={Zap}
              title="Quest and XP"
              summary={rewardsSummary}
              issue={rewardsInvalid}
              open={Boolean(openSections.rewards)}
              onToggle={() => toggleSection("rewards")}
            >
              <p className="mb-2.5 text-[10px] leading-relaxed text-[#6D6997]">
                Released values drive the learner quest and parent reward reporting.
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="quest-label">Quest label</Label>
                  <Input
                    id="quest-label"
                    maxLength={80}
                    value={draft.rewards.quest.label}
                    onChange={event => setDraft(current => ({
                      ...current,
                      rewards: {
                        ...current.rewards,
                        quest: { ...current.rewards.quest, label: event.target.value },
                      },
                    }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quest-activities">Activities / stars</Label>
                  <Input
                    id="quest-activities"
                    type="number"
                    min={1}
                    max={5}
                    value={draft.rewards.quest.activitiesPerSession}
                    onChange={event => setDraft(current => ({
                      ...current,
                      rewards: {
                        ...current.rewards,
                        quest: {
                          ...current.rewards.quest,
                          activitiesPerSession: Number(event.target.value),
                        },
                      },
                    }))}
                  />
                </div>
              </div>
              <p className="mt-3 border-t border-[#EEEAF8] pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#8D89AE]">
                XP awards
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {([
                  ["correctAnswer", "Correct"],
                  ["firstTryBonus", "First try"],
                  ["activityCompletion", "Completion"],
                ] as const).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`xp-${field}`}>{label}</Label>
                    <Input
                      id={`xp-${field}`}
                      type="number"
                      min={0}
                      max={100}
                      value={draft.rewards.xp[field]}
                      onChange={event => setDraft(current => ({
                        ...current,
                        rewards: {
                          ...current.rewards,
                          xp: { ...current.rewards.xp, [field]: Number(event.target.value) },
                        },
                      }))}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2.5 space-y-1.5">
                <Label htmlFor="xp-per-level">XP needed for each level</Label>
                <Input
                  id="xp-per-level"
                  type="number"
                  min={1}
                  max={10000}
                  value={draft.rewards.level.xpPerLevel || ""}
                  placeholder="Required"
                  onChange={event => setDraft(current => ({
                    ...current,
                    rewards: {
                      ...current.rewards,
                      level: { xpPerLevel: Number(event.target.value) },
                    },
                  }))}
                />
              </div>
              {rewardsInvalid && (
                <p className="mt-2.5 text-[11px] font-medium text-rose-600">
                  Enter a quest label, 1–5 activities, XP awards from 0–100, and an admin level threshold from 1–10,000.
                </p>
              )}
            </Section>

            <Section
              icon={Star}
              title="Achievements"
              summary={achievementsSummary}
              issue={achievementsInvalid}
              open={Boolean(openSections.achievements)}
              onToggle={() => toggleSection("achievements")}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] leading-relaxed text-[#6D6997]">
                  Admin-authored rules calculated from verified learner practice.
                </p>
                <Button
                  type="button"
                  size="xs"
                  className="shrink-0"
                  onClick={addAchievement}
                  disabled={draft.rewards.achievements.length >= 12}
                >
                  <Plus size={12} /> Add
                </Button>
              </div>

              {draft.rewards.achievements.length === 0 ? (
                <div className="mt-2.5 rounded-xl border border-dashed border-[#D8D1ED] bg-[#FBFAFF] px-4 py-4 text-center">
                  <p className="koda-admin-label text-[#6D6997]">No achievements configured. Learners will not see or earn badges.</p>
                </div>
              ) : (
                <div className="mt-2.5 space-y-2">
                  {draft.rewards.achievements.map((achievement, index) => (
                    <div key={achievement.id} className="rounded-xl border border-[#E7E3F6] bg-[#FBFAFF] p-2.5">
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`achievement-label-${achievement.id}`}>Badge name</Label>
                          <Input
                            id={`achievement-label-${achievement.id}`}
                            maxLength={80}
                            value={achievement.label}
                            placeholder="e.g. Math Champ"
                            onChange={event => setDraft(current => ({
                              ...current,
                              rewards: {
                                ...current.rewards,
                                achievements: current.rewards.achievements.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, label: event.target.value } : item
                                ),
                              },
                            }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`achievement-description-${achievement.id}`}>How to earn it</Label>
                          <Input
                            id={`achievement-description-${achievement.id}`}
                            maxLength={200}
                            value={achievement.description}
                            placeholder="Explain the milestone"
                            onChange={event => setDraft(current => ({
                              ...current,
                              rewards: {
                                ...current.rewards,
                                achievements: current.rewards.achievements.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, description: event.target.value } : item
                                ),
                              },
                            }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`achievement-metric-${achievement.id}`}>Verified metric</Label>
                          <Select
                            id={`achievement-metric-${achievement.id}`}
                            value={achievement.metric}
                            onChange={event => setDraft(current => ({
                              ...current,
                              rewards: {
                                ...current.rewards,
                                achievements: current.rewards.achievements.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, metric: event.target.value as AchievementMetric }
                                    : item
                                ),
                              },
                            }))}
                          >
                            <option value="lessonsCompleted">Practices completed</option>
                            <option value="firstTryCorrect">First-try answers</option>
                            <option value="xpEarned">XP earned</option>
                            <option value="proficientSkills">Proficient skills</option>
                            <option value="masteredSkills">Mastered skills</option>
                            <option value="streakDays">Best practice streak</option>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`achievement-target-${achievement.id}`}>Target</Label>
                          <Input
                            id={`achievement-target-${achievement.id}`}
                            type="number"
                            min={1}
                            max={10000}
                            value={achievement.target}
                            onChange={event => setDraft(current => ({
                              ...current,
                              rewards: {
                                ...current.rewards,
                                achievements: current.rewards.achievements.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, target: Number(event.target.value) } : item
                                ),
                              },
                            }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`achievement-icon-${achievement.id}`}>Icon</Label>
                          <Select
                            id={`achievement-icon-${achievement.id}`}
                            value={achievement.icon}
                            onChange={event => setDraft(current => ({
                              ...current,
                              rewards: {
                                ...current.rewards,
                                achievements: current.rewards.achievements.map((item, itemIndex) =>
                                  itemIndex === index
                                    ? { ...item, icon: event.target.value as AchievementIcon }
                                    : item
                                ),
                              },
                            }))}
                          >
                            {["star", "medal", "award", "trophy", "gem", "flame"].map(icon => (
                              <option key={icon} value={icon}>{icon}</option>
                            ))}
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`achievement-accent-${achievement.id}`}>Color</Label>
                          <div className="flex gap-2">
                            <Select
                              id={`achievement-accent-${achievement.id}`}
                              value={achievement.accent}
                              onChange={event => setDraft(current => ({
                                ...current,
                                rewards: {
                                  ...current.rewards,
                                  achievements: current.rewards.achievements.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, accent: event.target.value as typeof achievement.accent }
                                      : item
                                  ),
                                },
                              }))}
                            >
                              {["purple", "blue", "green", "amber", "pink"].map(accent => (
                                <option key={accent} value={accent}>{accent}</option>
                              ))}
                            </Select>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              aria-label={`Remove ${achievement.label || "achievement"}`}
                              onClick={() => setDraft(current => ({
                                ...current,
                                rewards: {
                                  ...current.rewards,
                                  achievements: current.rewards.achievements.filter((_, itemIndex) => itemIndex !== index),
                                },
                              }))}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {achievementsInvalid && (
                <p className="mt-2.5 text-[11px] font-medium text-rose-600">
                  Every achievement needs a name, explanation, and whole-number target from 1–10,000.
                </p>
              )}
            </Section>

            <Section
              icon={ShieldCheck}
              title="Ownership"
              summary={ownershipSummary}
              open={Boolean(openSections.ownership)}
              onToggle={() => toggleSection("ownership")}
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#534AB7]"><UserRound size={16} /></span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800">{owner?.name || "Local curriculum owner"}</p>
                  <p className="truncate text-[11px] text-[#6D6997]">{owner?.email || "Server ownership appears after sign-in"}</p>
                </div>
                {owner?.role && <Badge className="ml-auto capitalize">{owner.role}</Badge>}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-3 border-t border-[#EEEAF8] pt-2.5 text-[10px] text-[#6D6997]">
                <div><span className="block font-medium text-slate-600">Created</span>{dateLabel(createdAt)}</div>
                <div><span className="block font-medium text-slate-600">Updated</span>{dateLabel(updatedAt)}</div>
              </div>
            </Section>
          </div>

          {saveError && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{saveError}</p>}

          {/* Sticky action bar: the save button stays reachable however long the form runs. */}
          <div className="sticky bottom-0 -mx-5 mt-auto flex items-center justify-between gap-3 border-t border-[#E7E3F6] bg-white px-5 pb-1 pt-3">
            <p className="text-[10px] text-[#6D6997]">Revision {revision}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onClose} disabled={submitted}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={invalid || submitted} loading={submitted} loadingText="Saving...">Save</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          {historyLoading ? (
            <div className="space-y-3" role="status" aria-label="Loading curriculum audit history">
              {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-20 w-full" />)}
            </div>
          ) : historyError ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{historyError}</p>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center text-[#6D6997]">
              <History size={24} className="mb-2 text-[#8D89AE]" />
              <p className="text-sm font-medium text-[#0E0B55]">No audit events yet</p>
              <p className="mt-1 text-xs">Changes will appear after the curriculum is saved.</p>
            </div>
          ) : (
            <ol className="space-y-2">
              {events.map((event, index) => (
                <li key={event.id || `${event.occurred_at}-${index}`} className="rounded-xl border border-[#E7E3F6] bg-white p-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#534AB7]"><Clock3 size={13} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#0E0B55]">{actionLabels[event.action] || event.action.replaceAll("_", " ")}</p>
                        <Badge variant="default">r{event.revision}</Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-[#6D6997]">{eventDetail(event)}</p>
                      <p className="mt-1 text-[10px] text-[#8D89AE]">{event.actor?.name || "System"} · {dateLabel(event.occurred_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>
      </Drawer>
    </Tabs>
  );
};
