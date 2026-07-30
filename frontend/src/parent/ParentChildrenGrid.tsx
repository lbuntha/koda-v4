import React from "react";
import { Plus } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import type { Child } from "../api/family";
import { Button, Card, CardContent, Spinner } from "../components/ui";
import { ParentChildCard } from "./ParentChildCard";

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
}

const AddChildCard: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
  <Card className="min-h-56 rounded-3xl border border-dashed border-[#D9DDEA] bg-white/45 shadow-none dark:border-white/10 dark:bg-white/[0.02]">
    <CardContent className="flex h-full min-h-56 flex-col items-center justify-center p-5 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F0EBFF] text-[#7252D8] dark:bg-violet-400/15 dark:text-[#CDBEFF]"><Plus size={25} /></span>
      <p className="mt-4 text-sm font-black text-[#344057] dark:text-white">Add a child</p>
      <p className="mt-1.5 text-xs font-bold text-[#8A95A8] dark:text-[#8F99AD]">Create another learner profile.</p>
      <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="mt-4 rounded-full text-xs font-extrabold text-[#6844EA] dark:text-[#CDBEFF]">Add child</Button>
    </CardContent>
  </Card>
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
}) => {
  if (loading) return <div className="flex justify-center py-20"><Spinner label="Loading children" className="text-[#7252D8]" /></div>;
  if (error) return <div className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{error}</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {profiles.map(child => (
        <ParentChildCard
          key={child.id}
          child={child}
          summary={summaries[child.id]}
          loadingSummary={loadingSummaries}
          showRemove={allowRemove}
          onPlay={() => onPlay(child)}
          onEdit={() => onEdit(child)}
          onProgress={() => onProgress(child)}
          onRemove={() => onRemove(child)}
          onUnlockPin={() => onUnlockPin(child)}
        />
      ))}
      <AddChildCard onAdd={onAdd} />
    </div>
  );
};
