import React from "react";
import { BookOpen, FlaskConical, LoaderCircle } from "lucide-react";
import type { LearnerSubject } from "../../api/course";
import { Button } from "../../components/ui";
import { CountingAsset } from "../../components/Assets";

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

const SubjectIcon: React.FC<{ subject: LearnerSubject; active: boolean }> = ({ subject, active }) => {
  if (subject.iconAsset?.markup) {
    return (
      <span className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden" aria-hidden="true">
        <CountingAsset
          type="custom_svg"
          customSvgMarkup={subject.iconAsset.markup}
          size={14}
          scale={subject.iconAsset.scale}
        />
      </span>
    );
  }
  const Icon = subjectIcon(subject);
  return <Icon size={14} style={{ color: active ? subject.color : undefined }} aria-hidden="true" />;
};

export const SubjectSwitcher: React.FC<Props> = ({ subjects, activeSubjectId, loading, onChange, className = "" }) => {
  if (subjects.length < 2) return null;
  return (
    <div className={`flex items-center gap-2 overflow-x-auto py-1 ${className}`} role="tablist" aria-label="Learning subject">
      <span className="hidden shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-[#8792A5] sm:inline dark:text-[#9AA3B5]">Learn</span>
      {subjects.map(subject => {
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
            className={`h-9 shrink-0 rounded-full border-2 px-3 text-xs font-extrabold ${active ? "border-[#DED4FF] bg-[#F3EFFF] text-[#6844EA] shadow-[0_3px_0_#DED4FF] hover:bg-[#ECE6FF] dark:border-violet-400/20 dark:bg-violet-400/15 dark:text-[#CDBEFF] dark:shadow-[0_3px_0_#302852]" : "border-transparent bg-transparent text-[#657086] hover:border-[#EEE9FA] hover:bg-[#FAF8FF] hover:text-[#6844EA] dark:bg-transparent dark:text-[#B3BBC9] dark:hover:border-white/10 dark:hover:bg-white/10"}`}
          >
            {loading && active ? <LoaderCircle size={14} className="animate-spin" /> : <SubjectIcon subject={subject} active={active} />}
            {subject.name}
          </Button>
        );
      })}
    </div>
  );
};
