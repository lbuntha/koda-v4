import React from "react";

export interface DotProgressIndicatorProps {
  current: number; // 0-indexed current step
  total: number;   // Total steps
  isDark?: boolean;
  showCounter?: boolean;
  className?: string;
  maxDots?: number;
}

export const DotProgressIndicator: React.FC<DotProgressIndicatorProps> = ({
  current,
  total,
  isDark = false,
  showCounter = true,
  className = "",
  maxDots = 15,
}) => {
  if (total <= 1) return null;

  return (
    <div className={`flex flex-col items-center justify-center min-w-0 ${className}`}>
      <div className="flex max-w-full items-center gap-1.5 overflow-x-auto px-1.5 py-1 sm:gap-2 scrollbar-none">
        {total <= maxDots ? (
          Array.from({ length: total }).map((_, i) => {
            const isCompleted = i < current;
            const isCurrent = i === current;
            return (
              <div
                key={i}
                className={`transition-all duration-300 ${
                  isCurrent
                    ? "w-6 sm:w-7 h-2.5 sm:h-3 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full shadow-md shadow-indigo-500/30 ring-2 ring-indigo-400/40"
                    : isCompleted
                    ? "w-2.5 sm:w-3 h-2.5 sm:h-3 bg-indigo-500 dark:bg-violet-400 rounded-full"
                    : "w-2.5 sm:w-3 h-2.5 sm:h-3 bg-slate-200 dark:bg-white/15 rounded-full"
                }`}
                title={`Step ${i + 1} of ${total}`}
              />
            );
          })
        ) : (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const active = Math.floor((current / total) * 5) === i;
              return (
                <div
                  key={i}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    active
                      ? "w-6 bg-gradient-to-r from-indigo-500 to-violet-600 shadow-sm"
                      : "w-2.5 bg-slate-200 dark:bg-white/15"
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
      {showCounter && (
        <span className={`text-[10px] sm:text-[11px] font-black font-mono tracking-tight ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>
          {current + 1} / {total}
        </span>
      )}
    </div>
  );
};
