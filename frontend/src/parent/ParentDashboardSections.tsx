import React from "react";
import { Plus } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import type { Child } from "../api/family";
import { Button, Card } from "../components/ui";
import { FamilySummary } from "./FamilySummary";
import { FamilyCodeCard } from "./FamilyCodeCard";
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
  familyCode?: string;
}

export const ParentOverview: React.FC<OverviewProps> = ({ childCount, summaries, summariesByChild, profiles, summariesLoading, showSummary, onAdd, onOpenProgress, childrenGrid, familyCode }) => (
  <div className="space-y-5">
    {/* 1st Row: Family Summary */}
    {showSummary && (
      <FamilySummary summaries={summaries} loading={summariesLoading} expectedProfiles={childCount} className="mt-0" />
    )}

    <div className="grid items-start gap-5">
      {/* Primary learning area */}
      <Card variant="standard" className="min-w-0 p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#0E0B55] dark:text-white">My children</h2>
            <p className="mt-1 text-xs font-medium text-[#6D6997] dark:text-[#8F99AD]">{childCount} learner profile{childCount === 1 ? "" : "s"}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="rounded-full text-xs font-semibold text-[#534AB7] dark:text-[#CDBEFF]"><Plus size={15} /> Add child</Button>
        </div>
        {childrenGrid}
      </Card>

    </div>

    {(showSummary || familyCode) && (
      <div className="grid items-start gap-5">
        {showSummary && (
          <RecentActivity profiles={profiles} summaries={summariesByChild} loading={summariesLoading} onOpenProgress={onOpenProgress} />
        )}
        {familyCode && <FamilyCodeCard code={familyCode} />}
      </div>
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
