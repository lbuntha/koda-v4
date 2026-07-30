import React from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";
import { KODA_KID_AVATARS, type KodaKidAvatarId } from "../parent/onboarding/LearnerPortrait";
import { KidAvatar } from "./KidAvatar";

interface Props {
  value?: string | null;
  onChange: (avatar: KodaKidAvatarId) => void;
  className?: string;
}

/** Offline-safe avatar choices shared by onboarding and the learner profile menu. */
export const KodaAvatarPicker: React.FC<Props> = ({ value, onChange, className }) => (
  <div className={cn("grid grid-cols-4 gap-3", className)} role="radiogroup" aria-label="Choose a Koda avatar">
    {KODA_KID_AVATARS.map((avatar, index) => {
      const selected = value === avatar;
      return (
        <button
          key={avatar}
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={`Koda avatar ${index + 1}`}
          onClick={() => onChange(avatar)}
          className={cn(
            "relative aspect-square overflow-hidden rounded-2xl bg-slate-100 p-1 transition-all hover:-translate-y-0.5 hover:bg-[#F0EBFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7252D8] dark:bg-white/5 dark:hover:bg-white/10",
            selected && "ring-3 ring-[#7252D8] shadow-md shadow-violet-900/15 dark:ring-[#BDA9FF]",
          )}
        >
          <KidAvatar avatar={avatar} className="h-full w-full" />
          {selected && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#7252D8] text-white ring-2 ring-white dark:bg-[#BDA9FF] dark:text-[#241A48] dark:ring-[#1B1737]"><Check size={12} strokeWidth={3} /></span>}
        </button>
      );
    })}
  </div>
);
