import React, { useMemo } from "react";

import { useArtCategory } from "../../assets/svg";
import { artAvatarId, artAvatarSeed } from "../../lib/avatar";
import { UIAvatar } from "../ui";

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

/** One Art-backed avatar grid shared by Profile and the account menu. */
export const AvatarArtChoices: React.FC<AvatarArtChoicesProps> = ({
  currentSeed,
  selectedSeed,
  onSelect,
}) => {
  const artIds = useArtCategory("avatars");
  const choices = useMemo(() => {
    const fromArt = artIds.map((id) => ({ id, seed: artAvatarSeed(id), label: labelOf(id) }));
    if (!currentSeed || fromArt.some((choice) => choice.seed === currentSeed)) return fromArt;
    return [
      {
        id: artAvatarId(currentSeed) ?? currentSeed,
        seed: currentSeed,
        label: "Current avatar",
      },
      ...fromArt,
    ];
  }, [artIds, currentSeed]);

  if (choices.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-surface-muted p-5 text-center">
        <p className="koda-admin-label text-ink">No avatar artwork yet</p>
        <p className="mt-1 text-xs text-muted">Add artwork to the Avatars category in Art.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5" role="radiogroup" aria-label="Avatar artwork">
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
};
