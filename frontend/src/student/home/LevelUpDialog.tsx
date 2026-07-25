import React from "react";
import { Trophy } from "lucide-react";
import type { MasteryLevel } from "../../api/course";
import { Button, Dialog } from "../../components/ui";
import { levelName } from "./kinds";

export interface LevelUp {
  skillLabel: string;
  previousLevel: MasteryLevel;
  level: MasteryLevel;
}

interface Props {
  levelUp: LevelUp | null;
  onDismiss: () => void;
}

/** Celebration beat shown when practice promotes a skill. */
export const LevelUpDialog: React.FC<Props> = ({ levelUp, onDismiss }) => (
  <Dialog isOpen={levelUp !== null} onClose={onDismiss}>
    {levelUp && (
      <div className="py-3 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-500 dark:bg-amber-400/15 dark:text-amber-300"><Trophy size={31} /></span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#6B57D8] dark:text-[#B7A7FF]">Level up</p>
        <h2 className="mt-2 text-2xl font-bold text-[#17152F] dark:text-[#E7E5F7]">{levelName(levelUp.level)}</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#716C8C] dark:text-[#9A94B8]">
          Your work on <strong>{levelUp.skillLabel}</strong> moved you from {levelName(levelUp.previousLevel)} to {levelName(levelUp.level)}.
        </p>
        <Button className="mt-6 w-full" onClick={onDismiss}>Keep learning</Button>
      </div>
    )}
  </Dialog>
);
