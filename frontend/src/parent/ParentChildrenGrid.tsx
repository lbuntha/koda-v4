import React from "react";
import { Plus } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import type { Child } from "../api/family";
import type { CurriculumPromotion } from "../api/promotions";
import { useAcademicCatalog } from "../components/academic";
import { ParentChildCard, ParentChildCardSkeleton } from "./ParentChildCard";

interface Props {
  profiles: Child[];
  summaries: Record<string, AnalyticsSummary>;
  loading: boolean;
  loadingSummaries: boolean;
  error: string | null;
  allowRemove?: boolean;
  onAdd: () => void;
  onPlay: (child: Child) => void;
  onEdit: (child: Child) => void;
  onProgress: (child: Child) => void;
  onRemove: (child: Child) => void;
  onUnlockPin: (child: Child) => void;
  promotions?: CurriculumPromotion[];
  onApprovePromotion?: (item: CurriculumPromotion) => void;
}

const AddChildCard: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <button
    type="button"
    onClick={onAdd}
    className="group flex min-h-[180px] w-full touch-manipulation cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#DCD5FA] bg-white/60 p-5 text-center transition-all hover:border-[#7C6DD8] hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7252D8]/30 dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-violet-300/35 dark:hover:bg-white/[0.045]"
  >
    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F3F0FF] text-[#534AB7] transition-transform group-hover:scale-105 dark:bg-violet-400/15 dark:text-[#CDBEFF]">
      <Plus size={24} />
    </span>
    <p className="mt-3 text-sm font-black text-[#0E0B55] dark:text-white">New learner profile</p>
    <p className="mt-1 text-xs font-bold text-[#6D6997] dark:text-[#8F99AD]">Set up another child.</p>
  </button>
);

export const ParentChildrenGrid: React.FC<Props> = ({
  profiles,
  summaries,
  loading,
  loadingSummaries,
  error,
  allowRemove,
  onAdd,
  onPlay,
  onEdit,
  onProgress,
  onRemove,
  onUnlockPin,
  promotions = [],
  onApprovePromotion,
}) => {
  const { subjects } = useAcademicCatalog();

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ParentChildCardSkeleton />
        <ParentChildCardSkeleton />
        <ParentChildCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
        {error}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {profiles.map(child => (
        <ParentChildCard
          key={child.id}
          child={child}
          subjects={subjects}
          summary={summaries[child.id]}
          loadingSummary={loadingSummaries}
          showRemove={allowRemove}
          onPlay={() => onPlay(child)}
          onEdit={() => onEdit(child)}
          onProgress={() => onProgress(child)}
          onRemove={() => onRemove(child)}
          onUnlockPin={() => onUnlockPin(child)}
          promotions={promotions.filter(p => p.studentId === child.id)}
          onApprovePromotion={onApprovePromotion}
        />
      ))}
      <AddChildCard onAdd={onAdd} />
    </div>
  );
};
