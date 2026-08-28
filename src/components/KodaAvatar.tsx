import React from "react";
import { motion } from "motion/react";
import { Sparkles, Volume2, Mic } from "lucide-react";

interface KodaAvatarProps {
  state: "thinking" | "speaking" | "listening" | "cheering" | "idle";
  isVoiceActive?: boolean;
}

export const KodaAvatar: React.FC<KodaAvatarProps> = ({ state, isVoiceActive }) => {
  return (
    <div className="relative flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-md backdrop-blur-sm">
      {/* Glow aura */}
      <div
        className={`absolute -inset-0.5 rounded-2xl blur-md opacity-25 transition duration-500 ${
          state === "cheering"
            ? "bg-gradient-to-r from-emerald-500 to-amber-500 animate-pulse"
            : state === "speaking"
            ? "bg-gradient-to-r from-cyan-400 to-blue-500 animate-pulse"
            : state === "thinking"
            ? "bg-gradient-to-r from-purple-500 to-pink-500 animate-spin"
            : "bg-cyan-500/10"
        }`}
      />

      {/* Main Avatar Diamond / Orb */}
      <motion.div
        animate={
          state === "speaking"
            ? { scale: [1, 1.05, 1], rotate: [0, 1.5, -1.5, 0] }
            : state === "cheering"
            ? { y: [0, -4, 0], scale: [1, 1.08, 1] }
            : { y: [0, -2, 0] }
        }
        transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
        className="relative z-10 w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 p-0.5 shadow-md flex items-center justify-center overflow-hidden"
      >
        <div className="w-full h-full bg-slate-950 rounded-[14px] flex flex-col items-center justify-center relative p-1">
          {/* Eyes */}
          <div className="flex items-center gap-1.5 mb-1">
            <motion.div
              animate={state === "thinking" ? { scaleY: [1, 0.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
            />
            <motion.div
              animate={state === "thinking" ? { scaleY: [1, 0.2, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]"
            />
          </div>

          {/* Mouth */}
          {state === "cheering" ? (
            <div className="w-3.5 h-1.5 border-b-2 border-emerald-400 rounded-full" />
          ) : state === "speaking" ? (
            <motion.div
              animate={{ height: [2, 5, 2] }}
              transition={{ repeat: Infinity, duration: 0.3 }}
              className="w-3 bg-cyan-400 rounded-full"
            />
          ) : (
            <div className="w-2.5 h-0.5 bg-cyan-400/80 rounded-full" />
          )}

          {/* Sparkle icon overlay */}
          <Sparkles className="absolute top-1 right-1 w-2.5 h-2.5 text-cyan-400 opacity-90" />
        </div>
      </motion.div>

      {/* Info Label */}
      <div className="flex flex-col z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-bold text-white tracking-tight">Koda</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded-md border border-cyan-800/60">
            AI Math Coach
          </span>
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 font-medium">
          {state === "speaking" && (
            <span className="flex items-center gap-1 text-cyan-400 text-xs">
              <Volume2 className="w-3 h-3 animate-pulse" /> Explaining concept...
            </span>
          )}
          {state === "thinking" && (
            <span className="text-purple-300 text-xs">Thinking of a guiding hint...</span>
          )}
          {state === "listening" && (
            <span className="flex items-center gap-1 text-emerald-400 text-xs">
              <Mic className="w-3 h-3 animate-pulse" /> Listening to you...
            </span>
          )}
          {state === "cheering" && (
            <span className="text-emerald-400 font-bold text-xs">Great intuition! Keep going!</span>
          )}
          {state === "idle" && (
            <span className="text-slate-400 text-xs">Ready to explore with you</span>
          )}
        </div>
      </div>
    </div>
  );
};
