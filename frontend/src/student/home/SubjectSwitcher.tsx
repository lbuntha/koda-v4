import React from "react";
import { BookOpen, FlaskConical, LoaderCircle } from "lucide-react";
import type { LearnerSubject } from "../../api/course";
import { Button } from "../../components/ui";

interface Props {
  subjects: LearnerSubject[];
  activeSubjectId: string | null;
  loading?: boolean;
  onChange: (subjectId: string) => void;
  className?: string;
}

const subjectIcon = (subject: LearnerSubject) => {
  const value = `${subject.id} ${subject.name}`.toLowerCase();
  return value.includes("science") ? FlaskConical : BookOpen;
};

export const SubjectSwitcher: React.FC<Props> = ({ subjects, activeSubjectId, loading, onChange, className = "" }) => {
  if (subjects.length < 2) return null;
  return (
    <div className={`flex items-center gap-2 overflow-x-auto py-1 ${className}`} role="tablist" aria-label="Learning subject">
      <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-[#8792A5] sm:inline dark:text-[#9AA3B5]">Learn</span>
      {subjects.map(subject => {
        const Icon = subjectIcon(subject);
        const active = subject.id === activeSubjectId;
        return (
          <Button
            key={subject.id}
            type="button"
            role="tab"
            variant="ghost"
            aria-selected={active}
            disabled={!subject.ready || loading}
            onClick={() => onChange(subject.id)}
            className={`h-9 shrink-0 rounded-full px-3 text-xs font-extrabold ${active ? "bg-[#EEE9FF] text-[#6844EA] hover:bg-[#E8E0FF] dark:bg-violet-400/15 dark:text-[#CDBEFF]" : "bg-white/75 text-[#657086] hover:bg-white hover:text-[#6844EA] dark:bg-white/[0.055] dark:text-[#B3BBC9] dark:hover:bg-white/10"}`}
          >
            {loading && active ? <LoaderCircle size={14} className="animate-spin" /> : <Icon size={14} style={{ color: active ? subject.color : undefined }} />}
            {subject.name}
          </Button>
        );
      })}
    </div>
  );
};
