import React from "react";
import { ArrowRight, CheckCircle2, GraduationCap } from "lucide-react";
import type { CurriculumPromotion } from "../api/promotions";
import { Button, Card } from "../components/ui";

interface Props {
  promotions: CurriculumPromotion[];
  loading: boolean;
  updatingId: string | null;
  error?: string | null;
  onApprove: (item: CurriculumPromotion) => void;
  onDefer: (item: CurriculumPromotion) => void;
}

export const PromotionSection: React.FC<Props> = ({ promotions, loading, updatingId, error, onApprove, onDefer }) => {
  const now = Date.now();
  const actionable = promotions.filter(item =>
    item.status === "pending"
    || (item.status === "deferred" && (!item.deferredUntil || Date.parse(item.deferredUntil) <= now))
  );
  if (!loading && actionable.length === 0 && !error) return null;

  return (
    <section className="mt-6" aria-labelledby="promotion-heading">
      <div className="mb-3">
        <h2 id="promotion-heading" className="text-lg font-semibold text-[#27334A] dark:text-white">Ready for what’s next</h2>
        <p className="mt-0.5 text-xs text-[#8792A5] dark:text-[#9AA4B7]">Completed subjects wait for your approval before the next curriculum begins.</p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{error}</p>}
        {loading ? (
          <Card className="h-36 animate-pulse border-[#E7E3F6] bg-white/70 dark:border-white/10 dark:bg-white/5" />
        ) : actionable.map(item => (
          <Card key={item.id} className="border-[#DDD6F7] bg-white p-4 shadow-[0_6px_20px_rgba(83,74,183,0.06)] dark:border-white/10 dark:bg-[#17192A]">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF9F2] text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300">
                <CheckCircle2 size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#27334A] dark:text-white">{item.studentName} completed {item.fromCurriculumTitle}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-[#6D6997] dark:text-[#A9A3C0]">
                  <span>{item.fromGradeName} {item.subjectName}</span>
                  {item.toGradeName && item.toSubjectName && (
                    <><ArrowRight size={11} /><span>{item.toGradeName} {item.toSubjectName}</span></>
                  )}
                </div>
              </div>
              <GraduationCap size={18} className="shrink-0 text-[#7C6DD8]" />
            </div>
            {item.successorReady ? (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" size="xs" onClick={() => onDefer(item)} disabled={updatingId === item.id}>
                  Keep practising
                </Button>
                <Button type="button" size="xs" onClick={() => onApprove(item)} loading={updatingId === item.id} loadingText="Promoting...">
                  Promote to {item.toGradeName}
                </Button>
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                The next curriculum has not been configured yet. Learning history remains safe.
              </p>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
};
