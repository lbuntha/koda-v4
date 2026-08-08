import React from "react";
import { Trophy } from "lucide-react";
import type { MasteryLevel } from "../../api/course";
import { Button, Dialog } from "../../components/ui";
import { CountingAsset } from "../../components/Assets";
import { useAppSettings } from "../../settings/AppSettingsContext";
import { levelName } from "./kinds";
import { CelebrationEffects } from "./shared";

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
export const LevelUpDialog: React.FC<Props> = ({ levelUp, onDismiss }) => {
  const { settings } = useAppSettings();
  const masteryAsset = levelUp?.level === "not_started"
    ? undefined
    : settings.mastery_gate_assets[levelUp?.level ?? "beginner"];

  return (
    <Dialog isOpen={levelUp !== null} onClose={onDismiss}>
      {levelUp && (
      <div className="koda-celebration-card relative isolate overflow-hidden py-3 text-center">
        <CelebrationEffects tone="trophy" />
        <div className="relative z-10">
          <span className="koda-celebration-icon mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-50 text-amber-500 dark:bg-amber-400/15 dark:text-amber-300">
            {masteryAsset ? (
              <CountingAsset
                type="custom_svg"
                customSvgMarkup={masteryAsset.markup}
                scale={masteryAsset.scale}
                size={42}
                className="koda-celebration-icon-art"
              />
            ) : (
              <Trophy className="koda-celebration-icon-art" size={31} />
            )}
          </span>
          <div className="koda-celebration-copy">
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-[#6B57D8] dark:text-[#B7A7FF]">Level up</p>
            <h2 className="mt-2 text-2xl font-bold text-[#17152F] dark:text-[#E7E5F7]">{levelName(levelUp.level)}</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-[#716C8C] dark:text-[#9A94B8]">
              Your work on <strong>{levelUp.skillLabel}</strong> moved you from {levelName(levelUp.previousLevel)} to {levelName(levelUp.level)}.
            </p>
          </div>
          <Button className="koda-celebration-cta mt-6 w-full" onClick={onDismiss}>Keep learning</Button>
        </div>
      </div>
      )}
    </Dialog>
  );
};
