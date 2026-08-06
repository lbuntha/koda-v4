import React from "react";
import { ArrowRight, BarChart3, GraduationCap, LockOpen, Pencil, Play, Sparkles, Trash2 } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import type { Child } from "../api/family";
import type { SubjectCatalogItem } from "../api/academic";
import type { CurriculumPromotion } from "../api/promotions";
import { KidAvatar } from "../components/KidAvatar";
import { Button, Card, CardContent, Skeleton, Spinner } from "../components/ui";
import { PROFILE_TONE_CLASS, profileToneFor } from "./profileTone";

interface Props {
  child: Child;
  subjects?: SubjectCatalogItem[];
  summary?: AnalyticsSummary;
  loadingSummary?: boolean;
  showRemove?: boolean;
  /** Launching a child session is two round trips, so the button owns the wait. */
  playing?: boolean;
  onPlay: () => void;
  onEdit: () => void;
  onProgress: () => void;
  onRemove: () => void;
  onUnlockPin?: () => void;
  promotions?: CurriculumPromotion[];
  onApprovePromotion?: (item: CurriculumPromotion) => void;
}

const label = (value?: string | null) =>
  (value || "Not set").replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase());

/** Skeleton card placeholder for progressive loading */
export const ParentChildCardSkeleton: React.FC = () => (
  <Card className="overflow-hidden border-[#E7E3F6] bg-white shadow-[0_6px_24px_rgba(83,74,183,0.06)] dark:border-white/10 dark:bg-[#161B2E]">
    <CardContent className="flex min-h-48 flex-col p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Skeleton className="h-14 w-14 shrink-0" shape="circle" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" shape="line" />
            <div className="flex gap-1">
              <Skeleton className="h-8 w-8" shape="block" />
              <Skeleton className="h-8 w-8" shape="block" />
            </div>
          </div>
          <Skeleton className="h-3 w-20" shape="line" />
        </div>
      </div>

      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-6 w-20" shape="line" />
        <Skeleton className="h-6 w-24" shape="line" />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" shape="line" />
          <Skeleton className="h-3 w-12" shape="line" />
        </div>
        <Skeleton className="h-2 w-full" shape="line" />
      </div>

      <Skeleton className="mt-4 h-11 w-full" shape="block" />
    </CardContent>
  </Card>
);

export const ParentChildCard: React.FC<Props> = ({
  child,
  subjects = [],
  summary,
  loadingSummary,
  showRemove,
  playing = false,
  onPlay,
  onEdit,
  onProgress,
  onRemove,
  onUnlockPin,
  promotions = [],
  onApprovePromotion,
}) => {
  const tone = PROFILE_TONE_CLASS[profileToneFor(child.id)];
  const mastered = summary?.rank.mastered ?? 0;
  const assigned = summary?.rank.assignedSkills ?? 0;
  const progress = assigned > 0 ? Math.min(100, Math.round((mastered / assigned) * 100)) : 0;
  const pinLocked = Boolean(child.pin_locked_until && new Date(child.pin_locked_until).getTime() > Date.now());
  const subjectIds = child.learning_goals?.length ? child.learning_goals : child.primary_subject ? [child.primary_subject] : [];
  const subjectName = (key: string) => subjects.find(subject => subject.key === key)?.name ?? label(key.replace(/^grade[-_]\d+[-_]?/i, ""));

  const completedPromotions = promotions.filter(p => p.status === "completed");
  const now = Date.now();
  const pendingPromotions = promotions.filter(p => p.status === "pending" || (p.status === "deferred" && (!p.deferredUntil || Date.parse(p.deferredUntil) <= now)));
  const latestCompleted = completedPromotions[0];
  const latestPending = pendingPromotions[0];

  return (
    <Card className="overflow-hidden border-[#E7E3F6] bg-white shadow-[0_6px_24px_rgba(83,74,183,0.06)] transition-all hover:shadow-[0_8px_30px_rgba(83,74,183,0.12)] dark:border-white/10 dark:bg-[#161B2E]">
      <CardContent className="flex min-h-48 flex-col p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="relative shrink-0">
            <span className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${tone}`}>
              <KidAvatar avatar={child.avatar ?? undefined} className="h-12 w-12 text-3xl" />
            </span>
            {(latestCompleted || latestPending) && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-900 shadow-md ring-2 ring-white dark:ring-[#1a1d36]" title={latestCompleted ? "Promoted" : "Ready for promotion"}>
                <Sparkles size={11} className="fill-current" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-black text-[#0E0B55] dark:text-white">{child.name}</h3>
                <div className="mt-0.5 flex items-center flex-wrap gap-1.5">
                  <span className="truncate text-xs font-bold text-[#6D6997] dark:text-[#9AA3B5]">{label(child.grade_level)}</span>
                  {latestCompleted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30">
                      <Sparkles size={10} className="fill-emerald-500 text-emerald-600" /> Promoted
                    </span>
                  )}
                  {latestPending && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700 ring-1 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
                      <GraduationCap size={11} className="text-amber-600" /> Promotable
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onProgress}
                  aria-label={`View ${child.name}'s progress`}
                  className="h-10 w-10 min-h-[40px] min-w-[40px] touch-manipulation rounded-xl text-[#6D6997] hover:bg-[#F3F0FF] hover:text-[#534AB7] active:scale-95 dark:text-[#AFA6C8] dark:hover:bg-white/10"
                >
                  <BarChart3 size={18} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onEdit}
                  aria-label={`Edit ${child.name}`}
                  className="h-10 w-10 min-h-[40px] min-w-[40px] touch-manipulation rounded-xl text-[#6D6997] hover:bg-[#F3F0FF] hover:text-[#534AB7] active:scale-95 dark:text-[#AFA6C8] dark:hover:bg-white/10"
                >
                  <Pencil size={17} />
                </Button>
                {showRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    aria-label={`Remove ${child.name}`}
                    className="h-10 w-10 min-h-[40px] min-w-[40px] touch-manipulation rounded-xl text-[#8D89AE] hover:bg-rose-50 hover:text-rose-600 active:scale-95 dark:text-[#AFA6C8] dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
                  >
                    <Trash2 size={17} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {subjectIds.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label={`${child.name}'s subjects`}>
            {subjectIds.map((key, index) => {
              const isSubjectPromoted = completedPromotions.some(p => p.subjectId === key || p.toSubjectId === key);
              return (
                <span key={key} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${isSubjectPromoted ? "bg-emerald-100 text-emerald-800 border border-emerald-300/60 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30" : index === 0 ? "bg-[#F3F0FF] text-[#534AB7] dark:bg-violet-400/15 dark:text-[#CDBEFF]" : "bg-[#F7F6FB] text-[#6D6997] dark:bg-white/[0.07] dark:text-[#B3BBC9]"}`}>
                  {subjectName(key)}
                  {isSubjectPromoted ? <Sparkles size={10} className="fill-emerald-500 text-emerald-600" /> : index === 0 ? " · Primary" : ""}
                </span>
              );
            })}
          </div>
        )}

        {latestPending && (
          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 px-3 py-2 border border-amber-500/25 dark:border-amber-400/25 dark:bg-amber-400/10">
            <span className="truncate text-xs font-extrabold text-amber-900 dark:text-amber-200">
              ⭐ Ready for {latestPending.toGradeName || "Next Grade"}
            </span>
            {onApprovePromotion && (
              <Button
                type="button"
                size="sm"
                onClick={() => onApprovePromotion(latestPending)}
                className="shrink-0 min-h-[36px] touch-manipulation rounded-lg bg-[#534AB7] text-xs font-black text-white hover:bg-[#453DA0] active:scale-95 px-3 h-8 shadow-sm"
              >
                Approve
              </Button>
            )}
          </div>
        )}

        <div className="mt-3">
          {loadingSummary ? (
            <div className="space-y-2">
              <Skeleton shape="line" className="w-2/3" />
              <Skeleton shape="line" className="h-2" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 text-xs font-extrabold">
                <span className="text-[#6D6997] dark:text-[#B3BBC9]">Skills mastered</span>
                <span className="text-[#534AB7] dark:text-[#CDBEFF]">{mastered}/{assigned}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#EEEAF8] dark:bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-[#7C6DD8] to-[#534AB7] transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] font-bold text-[#6D6997] dark:text-[#8F99AD]">
                <span>{summary?.lessonsCompleted ?? 0} completed</span>
                <span>{summary?.xpEarned ?? 0} XP</span>
              </div>
            </>
          )}
        </div>

        {pinLocked && onUnlockPin && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onUnlockPin}
            className="mt-3 w-full min-h-[40px] touch-manipulation text-rose-600 dark:text-rose-300 active:scale-98"
          >
            <LockOpen size={14} /> Unlock child PIN
          </Button>
        )}

        <button
          type="button"
          onClick={onPlay}
          disabled={playing}
          aria-busy={playing}
          className="group mt-4 flex min-h-[46px] w-full touch-manipulation cursor-pointer items-center justify-between rounded-xl bg-[#F3F0FF] px-4 py-2.5 text-xs font-extrabold text-[#534AB7] shadow-sm transition-all hover:bg-[#EAE4FE] active:scale-[0.98] active:bg-[#E2DAFE] disabled:cursor-wait disabled:active:scale-100 dark:bg-violet-400/15 dark:text-[#CDBEFF] dark:hover:bg-violet-400/25 dark:active:bg-violet-400/30"
        >
          <span className="flex items-center gap-2.5">
            {/* Same 28px footprint either way, so the row does not jump when the wait starts. */}
            <span className="flex h-7 w-7 items-center justify-center">
              {playing ? (
                <Spinner size="md" variant="violet" label={`Opening ${child.name}'s lesson`} />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#534AB7] text-white shadow-sm transition-transform group-hover:scale-105 dark:bg-[#6844EA]">
                  <Play size={12} className="ml-0.5 fill-current" />
                </span>
              )}
            </span>
            <span className="text-sm font-black">{playing ? "Opening lesson…" : "Continue learning"}</span>
          </span>
          {playing
            ? null
            : <ArrowRight size={16} className="transition-transform group-hover:translate-x-1 text-[#534AB7] dark:text-[#CDBEFF]" />}
        </button>
      </CardContent>
    </Card>
  );
};
