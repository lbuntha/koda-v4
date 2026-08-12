import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "../../ui/Button";

interface FlexibleStudentControlsProps {
  mode: string;
  isDark: boolean;
  options: string[];
  selectedChoice: string | null;
  textValue: string;
  feedbackMsg: string | null;
  tappedCount: number;
  totalItemsCount: number;
  onChoiceClick: (choice: string) => void;
  onTextChange: (value: string) => void;
  onTextSubmit: (e: React.FormEvent) => void;
}

export const FlexibleStudentControls: React.FC<FlexibleStudentControlsProps> = ({
  mode,
  isDark,
  options,
  selectedChoice,
  textValue,
  feedbackMsg,
  tappedCount,
  totalItemsCount,
  onChoiceClick,
  onTextChange,
  onTextSubmit
}) => {
  return (
    /*
      Above the stage, and never squeezed by it.

      Two things conspired to make these unclickable. The stage above is
      `flex-1` *and* carries a pixel `min-h`, so when the card is short it wins
      the height fight and grows over the row it is supposed to sit above — and
      it is positioned with `z-10`, while this row was unpositioned at `z-auto`.
      A positioned ancestor beats a later sibling regardless of document order,
      so the stage's own box painted on top of the answer buttons and swallowed
      every click aimed at them. Nothing looked wrong: the buttons were fully
      visible underneath it.

      `shrink-0` keeps the row at its natural height whatever the stage wants,
      and `relative z-20` puts it back above. Both are needed — either alone
      leaves the other half of the bug in place.
    */
    <div className="relative z-20 shrink-0 mt-4 w-full flex flex-col items-center justify-center gap-3 animate-fade-in transition-colors duration-300 border-0 bg-transparent shadow-none p-0">
      {/* Multiple Choice Mode */}
      {mode === "multichoice" && (
        <div className="w-full text-center">
          <span className={`text-[10px] font-bold uppercase tracking-wider font-mono block mb-2
            ${isDark ? "text-slate-400" : "text-slate-400"}
          `}>
            Select the correct answer:
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {options.map((choice) => (
              <Button
                key={choice}
                onClick={() => onChoiceClick(choice)}
                variant={selectedChoice === choice ? "default" : "outline"}
                className={`min-w-[60px] font-extrabold text-base px-4 py-2 cursor-pointer shadow-sm transition-all hover:scale-105 active:scale-95
                  ${isDark && selectedChoice !== choice ? "border-slate-650 bg-slate-700/50 text-white hover:bg-slate-700" : ""}
                `}
              >
                {choice}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Text/Number Input Mode */}
      {mode === "textinput" && (
        <form onSubmit={onTextSubmit} className="w-full max-w-sm flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={textValue}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Enter your answer here..."
              className={`w-full px-4 py-2 text-sm font-bold border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm
                ${isDark ? "bg-slate-700 border-slate-600 text-white placeholder-slate-450" : "bg-white border-slate-200"}
              `}
            />
          </div>
          <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 px-4 rounded-xl cursor-pointer shadow-sm">
            Check <ArrowRight size={14} className="ml-1" />
          </Button>
        </form>
      )}

      {/* Drag Match Help Text */}
      {mode === "dragmatch" && (
        <div className="text-center">
          <span className={`text-[10px] font-extrabold uppercase font-mono tracking-widest block
            ${isDark ? "text-indigo-400" : "text-indigo-650 text-indigo-600"}
          `}>
            Drag-and-Drop Sort Activity
          </span>
          <p className={`text-xs font-bold mt-1.5
            ${isDark ? "text-slate-400" : "text-slate-500"}
          `}>
            Drag each item to its matching container to complete the activity!
          </p>
        </div>
      )}

      {/* Tap-to-Count Help Text */}
      {mode === "tapcount" && (
        <div className="text-center">
          <span className={`text-[10px] font-extrabold uppercase font-mono tracking-widest block
            ${isDark ? "text-emerald-400" : "text-emerald-600"}
          `}>
            Interactive Click-to-Count
          </span>
          <p className={`text-xs font-bold mt-1.5
            ${isDark ? "text-slate-400" : "text-slate-500"}
          `}>
            Tap on every emoji once to count them in order: {tappedCount} of {totalItemsCount} counted
          </p>
        </div>
      )}

      {/* Shared Feedback Area */}
      {feedbackMsg && (
        <div className={`text-xs font-extrabold px-4 py-1.5 rounded-lg border animate-pulse text-center
          ${isDark
            ? "text-indigo-300 bg-indigo-950/30 border-indigo-900/40"
            : "text-indigo-600 bg-indigo-50/50 border-indigo-100/50"
          }
        `}>
          {feedbackMsg}
        </div>
      )}
    </div>
  );
};
