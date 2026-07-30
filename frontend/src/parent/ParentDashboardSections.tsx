import React from "react";
import { Plus } from "lucide-react";
import type { AnalyticsSummary } from "../api/analytics";
import { Button } from "../components/ui";
import { FamilySummary } from "./FamilySummary";

interface OverviewProps {
  firstName: string;
  childCount: number;
  summaries: AnalyticsSummary[];
  summariesLoading: boolean;
  showSummary: boolean;
  onAdd: () => void;
  childrenGrid: React.ReactNode;
}

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export const ParentOverview: React.FC<OverviewProps> = ({ firstName, childCount, summaries, summariesLoading, showSummary, onAdd, childrenGrid }) => (
  <>
    <section>
      <h2 className="text-2xl font-black tracking-tight text-[#27334A] sm:text-3xl dark:text-white">{greeting()}, {firstName}! <span aria-hidden>👋</span></h2>
      <p className="mt-2 text-sm font-bold text-[#8792A5] dark:text-[#8F99AD]">Here’s how your family is doing today.</p>
    </section>
    <section className="mt-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-[#27334A] dark:text-white">My children</h2>
          <p className="mt-1 text-xs font-bold text-[#8792A5] dark:text-[#8F99AD]">{childCount} learner profile{childCount === 1 ? "" : "s"}</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd} className="rounded-full text-xs font-extrabold text-[#6844EA] dark:text-[#CDBEFF]"><Plus size={15} /> Add child</Button>
      </div>
      {childrenGrid}
    </section>
    {showSummary && <FamilySummary summaries={summaries} loading={summariesLoading} />}
  </>
);

interface ChildrenPageProps {
  onAdd: () => void;
  childrenGrid: React.ReactNode;
}

export const ParentChildrenPage: React.FC<ChildrenPageProps> = ({ onAdd, childrenGrid }) => (
  <section>
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-[#27334A] sm:text-3xl dark:text-white">Manage children</h2>
        <p className="mt-2 text-sm font-bold text-[#8792A5] dark:text-[#8F99AD]">Edit profiles, review progress, or remove a learner.</p>
      </div>
      <Button type="button" onClick={onAdd} className="rounded-xl bg-[#7252D8] text-xs font-extrabold hover:bg-[#6546CC]"><Plus size={16} /> Add child</Button>
    </div>
    <div className="mt-7">{childrenGrid}</div>
  </section>
);
