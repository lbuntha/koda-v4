import React from "react";
import { Plus } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import type { Child } from "../api/family";
import { Button } from "../components/ui";
import { FamilySummary } from "./FamilySummary";
import { RecentActivity } from "./RecentActivity";
import type { CurriculumPromotion } from "../api/promotions";
import { PromotionSection } from "./PromotionSection";

interface OverviewProps {
  childCount: number;
  summaries: AnalyticsSummary[];
  summariesByChild: Record<string, AnalyticsSummary>;
  profiles: Child[];
  summariesLoading: boolean;
  showSummary: boolean;
  onAdd: () => void;
  onOpenProgress: (child: Child) => void;
  childrenGrid: React.ReactNode;
  promotions: CurriculumPromotion[];
  promotionsLoading: boolean;
  updatingPromotionId: string | null;
  promotionError: string | null;
  onApprovePromotion: (item: CurriculumPromotion) => void;
  onDeferPromotion: (item: CurriculumPromotion) => void;
}

export const ParentOverview: React.FC<OverviewProps> = ({ childCount, summaries, summariesByChild, profiles, summariesLoading, showSummary, onAdd, onOpenProgress, childrenGrid, promotions, promotionsLoading, updatingPromotionId, promotionError, onApprovePromotion, onDeferPromotion }) => (
  <>
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[#27334A] dark:text-white">My children</h2>
          <p className="mt-1 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">{childCount} learner profile{childCount === 1 ? "" : "s"}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="rounded-full text-xs font-extrabold text-[#6844EA] dark:text-[#CDBEFF]"><Plus size={15} /> Add child</Button>
      </div>
      {childrenGrid}
    </section>
    <PromotionSection
      promotions={promotions}
      loading={promotionsLoading}
      updatingId={updatingPromotionId}
      error={promotionError}
      onApprove={onApprovePromotion}
      onDefer={onDeferPromotion}
    />
    {showSummary && (
      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.75fr)]">
        <FamilySummary summaries={summaries} loading={summariesLoading} expectedProfiles={childCount} className="mt-0" />
        <RecentActivity profiles={profiles} summaries={summariesByChild} loading={summariesLoading} onOpenProgress={onOpenProgress} />
      </div>
    )}
  </>
);

interface ChildrenPageProps {
  onAdd: () => void;
  childrenGrid: React.ReactNode;
}

export const ParentChildrenPage: React.FC<ChildrenPageProps> = ({ onAdd, childrenGrid }) => (
  <section>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-[#27334A] dark:text-white">Manage children</h2>
        <p className="mt-1 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">Edit profiles, review progress, or remove a learner.</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="rounded-full text-xs font-extrabold text-[#6844EA] dark:text-[#CDBEFF]"><Plus size={15} /> Add child</Button>
    </div>
    <div className="mt-4">{childrenGrid}</div>
  </section>
);
