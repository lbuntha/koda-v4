import React, { useState } from "react";
import { Target, CheckCircle2, Flame, Trophy, Edit2, ChevronDown } from "lucide-react";
import { playSound } from "../utils/audio";

interface DailyStudyGoalProps {
  dailySolved: number;
  dailyGoal: number;
  onUpdateGoal: (newGoal: number) => void;
}

export const DailyStudyGoal: React.FC<DailyStudyGoalProps> = ({
  dailySolved,
  dailyGoal,
  onUpdateGoal,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const percentage = Math.min(100, Math.round((dailySolved / dailyGoal) * 100));
  const isCompleted = dailySolved >= dailyGoal;

  // SVG circle calculation
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const goalOptions = [3, 5, 8, 10, 15];

  return (
    <div className="relative flex items-center gap-2 bg-transparent text-xs">
      {/* Circular Progress Ring */}
      <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
        <svg className="w-7 h-7 transform -rotate-90">
          {/* Background Track Circle */}
          <circle
            cx="14"
            cy="14"
            r={radius}
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="3"
            fill="transparent"
          />
          {/* Animated Progress Circle */}
          <circle
            cx="14"
            cy="14"
            r={radius}
            stroke={isCompleted ? "#34d399" : "#22d3ee"}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Icon/Text */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isCompleted ? (
            <Trophy className="w-3 h-3 text-emerald-400" />
          ) : (
            <span className="text-[9px] font-bold text-cyan-400 font-mono">
              {percentage}%
            </span>
          )}
        </div>
      </div>

      {/* Goal Status & Details */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-bold text-slate-200 font-mono">
          {dailySolved}/{dailyGoal}
        </span>
        <button
          onClick={() => {
            playSound("pop");
            setIsEditing(!isEditing);
          }}
          className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-0.5 transition"
          title="Change daily goal"
        >
          <span>Goal</span>
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Goal Edit Selector Dropdown */}
      {isEditing && (
        <div className="absolute right-0 top-10 z-50 w-44 bg-slate-900 border border-slate-800 rounded-xl p-2.5 shadow-2xl backdrop-blur-md animate-fadeIn font-sans">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-2 flex items-center justify-between">
            <span>Set Daily Target</span>
            <Edit2 className="w-3 h-3 text-cyan-400" />
          </div>
          <div className="grid grid-cols-5 gap-1 font-mono">
            {goalOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  playSound("pop");
                  onUpdateGoal(opt);
                  setIsEditing(false);
                }}
                className={`py-1 rounded-lg text-xs font-bold transition ${
                  dailyGoal === opt
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 leading-tight">
            Target daily problems for steady mastery.
          </p>
        </div>
      )}
    </div>
  );
};
