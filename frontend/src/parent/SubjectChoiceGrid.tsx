import React from "react";
import { BookOpen, Check, Clock3 } from "lucide-react";
import type { SubjectCatalogItem } from "../api/academic";

interface Props {
  subjects: SubjectCatalogItem[];
  selected: string[];
  onChange: (selected: string[]) => void;
  compact?: boolean;
}

export const SubjectChoiceGrid: React.FC<Props> = ({ subjects, selected, onChange, compact = false }) => {
  const toggle = (subject: SubjectCatalogItem) => {
    if (!subject.content_ready && !selected.includes(subject.key)) return;
    if (selected.includes(subject.key)) {
      if (selected.length === 1) return;
      onChange(selected.filter(item => item !== subject.key));
    } else {
      onChange([...selected, subject.key]);
    }
  };

  if (subjects.length === 0) {
    return <p className="rounded-2xl bg-amber-50 p-4 text-center text-xs font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">No subjects are configured for this grade yet.</p>;
  }

  return (
    <div className={`grid gap-2.5 ${compact ? "sm:grid-cols-2" : "mx-auto max-w-xl sm:grid-cols-2"}`}>
      {subjects.map(subject => {
        const active = selected.includes(subject.key);
        const ready = Boolean(subject.content_ready);
        return (
          <button
            key={subject.key}
            type="button"
            disabled={!ready && !active}
            onClick={() => toggle(subject)}
            aria-pressed={active}
            className={`flex items-center gap-3 rounded-2xl text-left transition-all ${compact ? "p-3" : "p-4"} ${
              active
                ? "bg-[#EEE9FF] ring-2 ring-[#7252D8] dark:bg-violet-400/15 dark:ring-[#BDA9FF]"
                : ready
                  ? "bg-slate-50 hover:bg-[#F6F3FF] dark:bg-white/5 dark:hover:bg-white/10"
                  : "cursor-not-allowed bg-slate-50/70 opacity-65 dark:bg-white/[0.025]"
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: ready ? subject.color || "#7252D8" : "#AAB2C2" }}>
              <BookOpen size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-black text-[#334057] dark:text-white">{subject.name}</span>
              <span className={`mt-0.5 block text-[10px] font-extrabold ${ready ? "text-emerald-600 dark:text-emerald-300" : "text-[#8A95A8] dark:text-[#8F99AD]"}`}>
                {ready ? (active && selected[0] === subject.key ? "Primary subject" : "Ready to learn") : active ? "Remove unavailable subject" : "Content coming soon"}
              </span>
            </span>
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${active ? "bg-[#7252D8] text-white" : ready ? "bg-white text-transparent dark:bg-white/10" : "bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-400"}`}>
              {ready ? <Check size={13} strokeWidth={3} /> : <Clock3 size={12} />}
            </span>
          </button>
        );
      })}
    </div>
  );
};
