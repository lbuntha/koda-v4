import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { newAvatarSeed } from "../../lib/avatar";
import { ApiError } from "../../lib/sync";
import { UIAvatar, UIButton, UIModal } from "../ui";

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentSeed?: string;
  onClose: () => void;
  onSave: (seed: string) => Promise<void>;
}

const choices = (current?: string): string[] => [
  ...(current ? [current] : []),
  ...Array.from({ length: current ? 7 : 8 }, () => newAvatarSeed()),
];

/** Self-service DiceBear picker shared by adult, student and child accounts. */
export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentSeed,
  onClose,
  onSave,
}) => {
  const [seeds, setSeeds] = useState<string[]>(() => choices(currentSeed));
  const [selected, setSelected] = useState(currentSeed ?? seeds[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const next = choices(currentSeed);
    setSeeds(next);
    setSelected(currentSeed ?? next[0]);
    setError(null);
  }, [currentSeed, isOpen]);

  const refresh = () => {
    const next = choices();
    setSeeds(next);
    setSelected(next[0]);
    setError(null);
  };

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(selected);
      onClose();
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <UIModal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose your avatar"
      footer={(
        <>
          <UIButton variant="secondary" onClick={onClose}>Cancel</UIButton>
          <UIButton variant="primary" isLoading={saving} onClick={() => void save()}>
            Use this avatar
          </UIButton>
        </>
      )}
    >
      <p className="mb-4 text-sm text-body">
        Pick a character that feels like you. Your choice follows your account on every device.
      </p>
      <div className="grid grid-cols-4 gap-3">
        {seeds.map((seed) => (
          <button
            key={seed}
            type="button"
            aria-label="Choose this avatar"
            aria-pressed={selected === seed}
            onClick={() => setSelected(seed)}
            className={`aspect-square overflow-hidden rounded-2xl border-2 p-1 transition ${
              selected === seed
                ? "border-[#534AB7] bg-[#F2EFFF] shadow-sm"
                : "border-[#E8E4F6] bg-white hover:border-[#B8AFE8]"
            }`}
          >
            <UIAvatar name="Avatar choice" seed={seed} size="fill" decorative />
          </button>
        ))}
      </div>
      <UIButton
        className="mt-4"
        variant="secondary"
        size="sm"
        icon={<RefreshCw />}
        onClick={refresh}
      >
        Show new choices
      </UIButton>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </UIModal>
  );
};
