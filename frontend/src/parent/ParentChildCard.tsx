import React from "react";
import { BarChart3, LockOpen, Pencil, Play, Trash2 } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import type { Child } from "../api/family";
import type { SubjectCatalogItem } from "../api/academic";
import { KidAvatar } from "../components/KidAvatar";
import { Button, Card, CardContent, Skeleton } from "../components/ui";
import { PROFILE_TONE_CLASS, profileToneFor } from "./profileTone";

interface Props {
  child: Child;
  subjects?: SubjectCatalogItem[];
  summary?: AnalyticsSummary;
  loadingSummary?: boolean;
  showRemove?: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onProgress: () => void;
  onRemove: () => void;
  onUnlockPin?: () => void;
}

const label = (value?: string | null) =>
  (value || "Not set").replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());

export const ParentChildCard: React.FC<Props> = ({
  child,
  subjects = [],
  summary,
  loadingSummary,
  showRemove,
  onPlay,
  onEdit,
  onProgress,
  onRemove,
  onUnlockPin,
}) => {
  const tone = PROFILE_TONE_CLASS[profileToneFor(child.id)];
  const mastered = summary?.rank.mastered ?? 0;
  const assigned = summary?.rank.assignedSkills ?? 0;
  const progress = assigned > 0 ? Math.min(100, Math.round((mastered / assigned) * 100)) : 0;
  const pinLocked = Boolean(child.pin_locked_until && new Date(child.pin_locked_until).getTime() > Date.now());
  const subjectIds = child.learning_goals?.length ? child.learning_goals : child.primary_subject ? [child.primary_subject] : [];
  const subjectName = (key: string) => subjects.find(subject => subject.key === key)?.name ?? label(key.replace(/^grade[-_]\d+[-_]?/i, ""));

  return (
    <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-[0_12px_34px_-24px_rgba(39,51,74,0.5)] dark:bg-white/[0.045] dark:shadow-none">
      <CardContent className="flex min-h-48 flex-col p-4">
        <div className="flex items-start gap-3">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${tone}`}>
            <KidAvatar avatar={child.avatar ?? undefined} className="h-12 w-12 text-3xl" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-[#27334A] dark:text-white">{child.name}</h3>
                <p className="mt-0.5 truncate text-xs font-bold text-[#8792A5] dark:text-[#9AA3B5]">{label(child.grade_level)}</p>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button type="button" variant="ghost" size="icon" onClick={onProgress} aria-label={`View ${child.name}'s progress`} className="h-8 w-8 rounded-xl text-[#7C72A0] hover:text-[#6844EA] dark:text-[#AFA6C8]">
                  <BarChart3 size={16} />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label={`Edit ${child.name}`} className="h-8 w-8 rounded-xl text-[#7C72A0] hover:text-[#6844EA] dark:text-[#AFA6C8]">
                  <Pencil size={15} />
                </Button>
                {showRemove && (
                  <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label={`Remove ${child.name}`} className="h-8 w-8 rounded-xl text-[#9A91AD] hover:text-rose-600 dark:text-[#AFA6C8] dark:hover:text-rose-300">
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {subjectIds.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label={`${child.name}'s subjects`}>
            {subjectIds.map((key, index) => (
              <span key={key} className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${index === 0 ? "bg-[#EEE9FF] text-[#6844EA] dark:bg-violet-400/15 dark:text-[#CDBEFF]" : "bg-[#F1F4F8] text-[#657086] dark:bg-white/[0.07] dark:text-[#B3BBC9]"}`}>
                {subjectName(key)}{index === 0 ? " · Primary" : ""}
              </span>
            ))}
          </div>
        )}

        <div className="mt-3">
          {loadingSummary ? (
            <div className="space-y-2"><Skeleton shape="line" className="w-2/3" /><Skeleton shape="line" className="h-1.5" /></div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-xs font-extrabold">
                <span className="text-[#657086] dark:text-[#B3BBC9]">Skills mastered</span>
                <span className="text-[#6844EA] dark:text-[#CDBEFF]">{mastered}/{assigned}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E9EDF4] dark:bg-white/10">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#7A5AF0,#4C8CF5)]" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] font-bold text-[#8A95A8] dark:text-[#8F99AD]">
                <span>{summary?.lessonsCompleted ?? 0} completed</span>
                <span>{summary?.xpEarned ?? 0} XP</span>
              </div>
            </>
          )}
        </div>

        {pinLocked && onUnlockPin && (
          <Button type="button" variant="ghost" size="xs" onClick={onUnlockPin} className="mt-3 w-full text-rose-600 dark:text-rose-300">
            <LockOpen size={12} /> Unlock child PIN
          </Button>
        )}

        <Button type="button" onClick={onPlay} className="mt-3 h-9 w-full rounded-xl bg-[#7252D8] text-xs font-extrabold hover:bg-[#6546CC]">
          <Play size={15} className="fill-current" /> Continue learning
        </Button>
      </CardContent>
    </Card>
  );
};
