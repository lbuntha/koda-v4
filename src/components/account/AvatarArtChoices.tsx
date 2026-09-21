import React, { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { useArtCategory } from "../../assets/svg";
import { artAvatarId, artAvatarSeed, newAvatarSeed } from "../../lib/avatar";
import { UIAvatar, UIButton } from "../ui";

interface AvatarArtChoicesProps {
  currentSeed?: string;
  selectedSeed?: string;
  onSelect: (seed: string) => void;
}

const labelOf = (id: string): string =>
  id
    .replace(/^avatar-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Avatar";

const diceBearChoices = (currentSeed?: string): string[] => {
  const current = currentSeed && !artAvatarId(currentSeed) ? [currentSeed] : [];
  return [
    ...current,
    ...Array.from({ length: current.length ? 7 : 8 }, () => newAvatarSeed()),
  ];
};

interface ChoiceGridProps {
  choices: Array<{ seed: string; label: string }>;
  selectedSeed?: string;
  onSelect: (seed: string) => void;
  label: string;
}

const ChoiceGrid: React.FC<ChoiceGridProps> = ({ choices, selectedSeed, onSelect, label }) => (
  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4" role="radiogroup" aria-label={label}>
    {choices.map((choice) => {
      const selected = selectedSeed === choice.seed;
      return (
        <button
          key={choice.seed}
          type="button"
          role="radio"
          aria-checked={selected}
          aria-label={`Choose ${choice.label}`}
          onClick={() => onSelect(choice.seed)}
          className={`min-w-0 rounded-2xl border-2 p-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300/50 ${selected ? "border-[#534AB7] bg-[#F2EFFF] dark:border-indigo-400 dark:bg-indigo-950/40" : "border-[#E8E4F6] bg-white hover:border-[#B8AFE8] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-600"}`}
        >
          <span className="mx-auto block aspect-square w-full max-w-20">
            <UIAvatar name={choice.label} seed={choice.seed} size="fill" decorative />
          </span>
          <span className="mt-1 block truncate text-center text-xs font-semibold text-ink">
            {choice.label}
          </span>
        </button>
      );
    })}
  </div>
);

/** Art and classic DiceBear avatar choices shared by Profile and the account menu. */
export const AvatarArtChoices: React.FC<AvatarArtChoicesProps> = ({
  currentSeed,
  selectedSeed,
  onSelect,
}) => {
  const artIds = useArtCategory("avatars");
  const artChoices = useMemo(
    () => artIds.map((id) => ({ seed: artAvatarSeed(id), label: labelOf(id) })),
    [artIds],
  );
  const [diceSeeds, setDiceSeeds] = useState<string[]>(() => diceBearChoices(currentSeed));

  useEffect(() => {
    setDiceSeeds(diceBearChoices(currentSeed));
  }, [currentSeed]);

  const classicChoices = diceSeeds.map((seed, index) => ({
    seed,
    label: seed === currentSeed ? "Current avatar" : `Classic ${index + 1}`,
  }));

  return (
    <div className="space-y-5">
      {artChoices.length > 0 && (
        <section className="space-y-2.5" aria-labelledby="koda-art-avatars">
          <h3 id="koda-art-avatars" className="koda-admin-label text-ink">Koda Art</h3>
          <ChoiceGrid
            choices={artChoices}
            selectedSeed={selectedSeed}
            onSelect={onSelect}
            label="Koda Art avatars"
          />
        </section>
      )}

      <section className="space-y-2.5" aria-labelledby="classic-avatars">
        <div className="flex items-center justify-between gap-3">
          <h3 id="classic-avatars" className="koda-admin-label text-ink">Classic avatars</h3>
          <UIButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw />}
            onClick={() => setDiceSeeds(diceBearChoices())}
          >
            New choices
          </UIButton>
        </div>
        <ChoiceGrid
          choices={classicChoices}
          selectedSeed={selectedSeed}
          onSelect={onSelect}
          label="Classic avatars"
        />
      </section>
    </div>
  );
};
