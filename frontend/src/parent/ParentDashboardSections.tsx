import React from "react";
import { Plus } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import type { Child } from "../api/family";
import { Button } from "../components/ui";
import { FamilySummary } from "./FamilySummary";
import { RecentActivity } from "./RecentActivity";

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
}

export const ParentOverview: React.FC<OverviewProps> = ({ childCount, summaries, summariesByChild, profiles, summariesLoading, showSummary, onAdd, onOpenProgress, childrenGrid }) => (
  <div className="space-y-6">
    {/* 1st Row: Family Summary */}
    {showSummary && (
      <FamilySummary summaries={summaries} loading={summariesLoading} expectedProfiles={childCount} className="mt-0" />
    )}

    {/* 2nd Row: My Children */}
    <section>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[#0E0B55] dark:text-white">My children</h2>
          <p className="mt-1 text-xs font-bold text-[#6D6997] dark:text-[#8F99AD]">{childCount} learner profile{childCount === 1 ? "" : "s"}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="rounded-full text-xs font-extrabold text-[#534AB7] dark:text-[#CDBEFF]"><Plus size={15} /> Add child</Button>
      </div>
      {childrenGrid}
    </section>

    {/* 3rd Row: Recent Activity */}
    {showSummary && (
      <RecentActivity profiles={profiles} summaries={summariesByChild} loading={summariesLoading} onOpenProgress={onOpenProgress} />
    )}
  </div>
);

interface ChildrenPageProps {
  onAdd: () => void;
  childrenGrid: React.ReactNode;
}

export const ParentChildrenPage: React.FC<ChildrenPageProps> = ({ onAdd, childrenGrid }) => (
  <section>
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-[#0E0B55] dark:text-white">Manage children</h2>
        <p className="mt-1 text-xs font-bold text-[#6D6997] dark:text-[#8F99AD]">Edit profiles, review progress, or remove a learner.</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="rounded-full text-xs font-extrabold text-[#534AB7] dark:text-[#CDBEFF]"><Plus size={15} /> Add child</Button>
    </div>
    <div className="mt-4">{childrenGrid}</div>
  </section>
);
