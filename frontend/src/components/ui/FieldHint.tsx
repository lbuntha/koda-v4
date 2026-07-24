import React from "react";
import { Info } from "lucide-react";
import { cn } from "../../lib/utils";

interface FieldHintProps {
  text: string;
  label?: string;
  className?: string;
}

/** Compact, keyboard-accessible explanation for dense admin configuration fields. */
export const FieldHint: React.FC<FieldHintProps> = ({ text, label = "About this setting", className }) => {
  const hintId = React.useId();

  return (
    <span className={cn("group relative inline-flex shrink-0", className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={hintId}
        className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full text-[#8D89AE] transition-colors hover:bg-[#F1EDFF] hover:text-[#534AB7] focus-visible:bg-[#F1EDFF] focus-visible:text-[#534AB7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C6DD8]/30"
      >
        <Info size={13} />
      </button>
      <span
        id={hintId}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-[calc(100%+0.4rem)] left-1/2 z-30 w-56 -translate-x-1/2 rounded-xl border border-[#DED8F3] bg-[#17143D] px-3 py-2 text-left text-[11px] font-normal leading-4 text-white opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {text}
        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-[#17143D]" />
      </span>
    </span>
  );
};
