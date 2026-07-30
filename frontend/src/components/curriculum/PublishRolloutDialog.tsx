import React, { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import {
  CurriculumReleaseImpact,
  CurriculumRolloutStrategy,
} from "../../api/curriculum";
import { Badge, Button, Card, Dialog } from "../ui";
import { cn } from "../../lib/utils";

interface PublishRolloutDialogProps {
  isOpen: boolean;
  impact: CurriculumReleaseImpact | null;
  gradeLabel: string;
  subjectLabel: string;
  publishing: boolean;
  onClose: () => void;
  onPublish: (strategy: CurriculumRolloutStrategy) => void;
}

const impactCopy = {
  initial: {
    label: "First release",
    badge: "success" as const,
    title: "Ready for the first learners",
    description: "This creates the first immutable release for this subject.",
  },
  patch: {
    label: "Safe update",
    badge: "success" as const,
    title: "No learning-path changes detected",
    description: "Labels, artwork, instructions, or question content changed without changing the skill path.",
  },
  minor: {
    label: "Path extension",
    badge: "warning" as const,
    title: "New learning content was added",
    description: "Existing skill IDs remain intact, but current learners would see a longer path.",
  },
  major: {
    label: "Disruptive change",
    badge: "destructive" as const,
    title: "The current learning path changed",
    description: "Skills were removed, moved, reordered, or had sequencing rules changed.",
  },
};

export const PublishRolloutDialog: React.FC<PublishRolloutDialogProps> = ({
  isOpen,
  impact,
  gradeLabel,
  subjectLabel,
  publishing,
  onClose,
  onPublish,
}) => {
  const [strategy, setStrategy] = useState<CurriculumRolloutStrategy>("new_learners");

  useEffect(() => {
    if (!impact || !isOpen) return;
    setStrategy(impact.level === "patch" || impact.level === "initial" ? "active_learners" : "new_learners");
  }, [impact, isOpen]);

  if (!impact) return null;
  const copy = impactCopy[impact.level];
  const activeBlocked = impact.level === "major";
  const totalChanges = impact.addedSkills.length + impact.removedSkills.length + impact.structuralChanges.length;

  return (
    <Dialog isOpen={isOpen} onClose={publishing ? () => undefined : onClose} maxWidthClassName="max-w-xl">
      <div className="pr-8">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#0E0B55] dark:text-[#F2F0FF]">Publish &amp; rollout</h2>
          <Badge variant={copy.badge}>{copy.label}</Badge>
        </div>
        <p className="text-xs text-[#6D6997] dark:text-[#AAA6C8]">
          {gradeLabel} · {subjectLabel}
        </p>
      </div>

      <Card className="mt-5 p-4">
        <div className="flex gap-3">
          <div className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            activeBlocked ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15",
          )}>
            {activeBlocked ? <TriangleAlert size={20} /> : <ShieldCheck size={20} />}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#17153D] dark:text-[#EEEAFE]">{copy.title}</h3>
            <p className="mt-1 text-xs leading-5 text-[#777391] dark:text-[#AAA6C8]">{copy.description}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#F7F5FF] p-3 dark:bg-white/5">
          <div><div className="text-base font-semibold text-[#17153D] dark:text-white">{impact.addedSkills.length}</div><div className="text-[10px] text-[#777391]">skills added</div></div>
          <div><div className="text-base font-semibold text-[#17153D] dark:text-white">{impact.removedSkills.length}</div><div className="text-[10px] text-[#777391]">skills removed</div></div>
          <div><div className="text-base font-semibold text-[#17153D] dark:text-white">{impact.structuralChanges.length}</div><div className="text-[10px] text-[#777391]">path changes</div></div>
        </div>
        {impact.affectedLearners > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-rose-600">
            <TriangleAlert size={13} /> {impact.affectedLearners} active learner{impact.affectedLearners === 1 ? " has" : "s have"} progress on removed skills.
          </p>
        )}
      </Card>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8E89A8]">Who receives this release?</legend>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setStrategy("new_learners")}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors",
              strategy === "new_learners" ? "bg-[#EEE9FF] ring-1 ring-[#7654E8] dark:bg-[#7654E8]/20" : "bg-[#F8F7FC] hover:bg-[#F3F1FA] dark:bg-white/5",
            )}
          >
            <CheckCircle2 size={18} className={strategy === "new_learners" ? "text-[#6D48DA]" : "text-[#AAA6BD]"} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-[#17153D] dark:text-white">New learners only</span>
              <span className="block text-[11px] leading-4 text-[#777391]">Current learners stay on the release they started.</span>
            </span>
            <Badge variant="success">Safest</Badge>
          </button>

          <button
            type="button"
            disabled={activeBlocked}
            onClick={() => setStrategy("active_learners")}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
              strategy === "active_learners" ? "bg-[#EEE9FF] ring-1 ring-[#7654E8] dark:bg-[#7654E8]/20" : "bg-[#F8F7FC] hover:bg-[#F3F1FA] dark:bg-white/5",
            )}
          >
            <Users size={18} className={strategy === "active_learners" ? "text-[#6D48DA]" : "text-[#AAA6BD]"} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-[#17153D] dark:text-white">New and active learners</span>
              <span className="block text-[11px] leading-4 text-[#777391]">
                {activeBlocked ? "Unavailable because this update changes the current path." : `${impact.activeLearners} active learner${impact.activeLearners === 1 ? "" : "s"} will move to the new release.`}
              </span>
            </span>
          </button>
        </div>
      </fieldset>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-[#ECE9F5] pt-4 dark:border-white/10">
        <p className="text-[10px] leading-4 text-[#8E89A8]">
          {totalChanges === 0 ? "A new immutable release will be recorded." : `${totalChanges} curriculum change${totalChanges === 1 ? "" : "s"} detected.`}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" disabled={publishing} onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={publishing} loadingText="Publishing…" onClick={() => onPublish(strategy)}>
            Publish release <ArrowRight size={14} />
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
