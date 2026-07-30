import React from "react";
import { CheckCircle2, ChevronDown, Lock, Play, RotateCcw } from "lucide-react";
import type { CurriculumPath, PathUnit } from "../../../api/course";
import { Button, Card, CardContent, Tabs, TabsList, TabsTrigger } from "../../../components/ui";
import { unitAccentTone, unitIcon } from "../../../curriculum/unitPresentation";

interface Props {
  paths: CurriculumPath[];
  playableSkillIds: ReadonlySet<string>;
  thumbnailBySkillId: ReadonlyMap<string, string | undefined>;
  onStartSkill: (skillId: string) => void;
}

interface SkillUnitView {
  id: string;
  subject: string;
  unit: PathUnit;
  completed: number;
  total: number;
  percentage: number;
}

const buildUnits = (paths: CurriculumPath[]): SkillUnitView[] => paths.flatMap(path =>
  path.units.map(unit => {
    const total = unit.skills.length;
    const completed = unit.skills.filter(skill => skill.status === "completed").length;
    return {
      id: `${path.assignmentId}:${unit.unitId ?? unit.unitLabel}`,
      subject: unit.subjectLabel?.trim() || "Skills",
      unit,
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }),
);

/** Browse every assigned curriculum unit by its real subject and completion state. */
export const SkillsExplorerSection: React.FC<Props> = ({
  paths,
  playableSkillIds,
  thumbnailBySkillId,
  onStartSkill,
}) => {
  const units = buildUnits(paths);
  const subjects = ["All", ...new Set(units.map(unit => unit.subject))];
  const [activeSubject, setActiveSubject] = React.useState("All");
  const [expandedUnitId, setExpandedUnitId] = React.useState<string | null>(null);
  const [showAllSkills, setShowAllSkills] = React.useState(false);
  const visibleUnits = activeSubject === "All"
    ? units
    : units.filter(unit => unit.subject === activeSubject);

  if (units.length === 0) return null;

  return (
    <section
      id="kid-skills"
      className="mt-6"
    >
      <header>
        <h2 className="text-base font-black text-[#27334A] sm:text-lg dark:text-white">Explore all skills</h2>
        <p className="mt-0.5 text-[10px] font-bold text-[#8792A5] sm:text-[11px] dark:text-[#8F99AD]">
          Browse your assigned subjects and see what you have completed.
        </p>
      </header>

      <Tabs
        value={activeSubject}
        variant="learner"
        className="mt-4"
        onValueChange={subject => {
          setActiveSubject(subject);
          setExpandedUnitId(null);
          setShowAllSkills(false);
        }}
      >
        <TabsList aria-label="Subjects" className="[scrollbar-width:none]">
          {subjects.map(subject => (
            <TabsTrigger key={subject} value={subject}>{subject}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mt-4 space-y-2.5">
        {visibleUnits.map(entry => {
          const fallbackSeed = entry.unit.unitId ?? entry.unit.unitLabel;
          const Icon = unitIcon(entry.unit.unitIcon ?? undefined, fallbackSeed);
          const summary = entry.unit.skills.slice(0, 2).map(skill => skill.skillLabel).join(" · ");
          const nextSkill = entry.unit.skills.find(skill =>
            skill.status !== "completed" && playableSkillIds.has(skill.skillId),
          ) ?? entry.unit.skills.find(skill => playableSkillIds.has(skill.skillId));
          const unitComplete = entry.completed === entry.total && entry.total > 0;
          const expanded = expandedUnitId === entry.id;
          const nextIndex = nextSkill ? entry.unit.skills.findIndex(skill => skill.skillId === nextSkill.skillId) : -1;
          const collapsedSkills = nextIndex >= 6
            ? [...entry.unit.skills.slice(0, 5), entry.unit.skills[nextIndex]]
            : entry.unit.skills.slice(0, 6);
          const displayedSkills = showAllSkills && expanded ? entry.unit.skills : collapsedSkills;
          return (
            <Card key={entry.id} className={`overflow-hidden rounded-2xl border-0 bg-white shadow-none transition-colors dark:bg-white/[0.035] ${expanded ? "bg-[#FCFBFF] dark:bg-white/[0.05]" : ""}`}>
              <Button
                type="button"
                variant="ghost"
                aria-expanded={expanded}
                aria-controls={`unit-skills-${entry.id}`}
                onClick={() => {
                  setExpandedUnitId(current => current === entry.id ? null : entry.id);
                  setShowAllSkills(false);
                }}
                className="grid h-auto w-full items-center gap-3 rounded-none px-3.5 py-3 text-left shadow-none hover:bg-[#FBFAFF] sm:grid-cols-[3rem_minmax(0,1fr)_minmax(13rem,18rem)] sm:px-4 dark:hover:bg-white/[0.04]"
              >
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${unitAccentTone(entry.unit.unitAccent ?? undefined, fallbackSeed)}`}>
                  <Icon size={22} strokeWidth={2.3} />
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <h3 className="truncate text-sm font-black text-[#28334A] sm:text-base dark:text-[#F2EEFF]">{entry.unit.unitLabel}</h3>
                    {activeSubject === "All" && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wide text-[#8D78D7] dark:text-[#AFA0E8]">{entry.subject}</span>
                    )}
                  </div>
                  {summary && <p className="mt-0.5 truncate text-[10px] font-semibold text-[#8A95A8] sm:text-[11px] dark:text-[#8F99AD]">{summary}</p>}
                  <p className="mt-1 text-[10px] font-extrabold text-[#68758A] dark:text-[#A8B0C1]">
                    {entry.completed}/{entry.total} skill{entry.total === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex items-center gap-3 sm:justify-end">
                  <div className="min-w-0 flex-1 sm:max-w-44">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[#E7EBF2] dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#9A72F3] to-[#7452D9] transition-all duration-500"
                        style={{ width: `${entry.percentage}%` }}
                      />
                    </div>
                    <p className="mt-1 truncate text-right text-[9px] font-extrabold text-[#756B89] dark:text-[#AAA1C2]">
                      {nextSkill ? `${unitComplete ? "Practice" : "Next"}: ${nextSkill.skillLabel}` : "No playable skills"}
                    </p>
                  </div>
                  <span className="w-9 text-right text-[11px] font-black text-[#5E6677] dark:text-[#C5CBDA]">{entry.percentage}%</span>
                  <ChevronDown size={18} className={`shrink-0 text-[#7966C8] transition-transform ${expanded ? "rotate-180" : ""}`} />
                </div>
              </Button>

              {expanded && (
                <CardContent id={`unit-skills-${entry.id}`} className="bg-[#F5F2FF] p-3 sm:p-4 dark:bg-violet-400/[0.06]">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {displayedSkills.map(skill => {
                      const playable = playableSkillIds.has(skill.skillId);
                      const recommended = nextSkill?.skillId === skill.skillId;
                      const completed = skill.status === "completed";
                      const position = entry.unit.skills.findIndex(candidate => candidate.skillId === skill.skillId) + 1;
                      const thumbnail = thumbnailBySkillId.get(skill.skillId);
                      const action = completed ? "Practice again" : skill.status === "in_progress" ? "Continue" : "Start";
                      return (
                        <Button
                          key={skill.skillId}
                          type="button"
                          variant="ghost"
                          disabled={!playable}
                          onClick={() => onStartSkill(skill.skillId)}
                          className={`h-auto min-h-16 justify-start gap-3 rounded-xl border-0 px-3 py-2.5 text-left shadow-none ${
                            recommended
                              ? "bg-[#E7DFFF] hover:bg-[#DED3FF] dark:bg-violet-400/20 dark:hover:bg-violet-400/25"
                              : "bg-white/80 hover:bg-white dark:bg-white/[0.035] dark:hover:bg-white/[0.08]"
                          } disabled:cursor-not-allowed disabled:opacity-55`}
                        >
                          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#6844EA] dark:bg-white/10 dark:text-[#CDBEFF]">
                            {thumbnail ? (
                              <img src={thumbnail} alt="" className="h-8 w-8 object-contain" />
                            ) : playable ? (
                              <span className="text-[11px] font-black">{position}</span>
                            ) : (
                              <Lock size={14} />
                            )}
                            {completed && (
                              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-[#342A57]">
                                <CheckCircle2 size={11} strokeWidth={3} />
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-[11px] font-black text-[#313B52] sm:text-xs dark:text-[#F2EEFF]">{skill.skillLabel}</span>
                              {recommended && <span className="rounded-full bg-[#7252D8] px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-white">Recommended</span>}
                            </span>
                            <span className="mt-0.5 block text-[9px] font-extrabold text-[#7C7390] dark:text-[#9F97B5]">{playable ? action : "Not available yet"}</span>
                          </span>
                          {playable && (completed ? <RotateCcw size={14} className="shrink-0 text-emerald-600" /> : <Play size={14} className="shrink-0 fill-current text-[#6844EA]" />)}
                        </Button>
                      );
                    })}
                  </div>

                  {entry.total > 6 && (
                    <div className="mt-3 flex justify-center">
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowAllSkills(value => !value)} className="rounded-full px-4 text-[10px] font-extrabold text-[#6844EA] dark:text-[#CDBEFF]">
                        {showAllSkills ? "Show fewer skills" : `Show all ${entry.total} skills`}
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
};
