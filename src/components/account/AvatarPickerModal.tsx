import React, { useEffect, useState } from "react";

import { ApiError } from "../../lib/sync";
import { UIButton, UIModal } from "../ui";
import { AvatarArtChoices } from "./AvatarArtChoices";

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentSeed?: string;
  onClose: () => void;
  onSave: (seed: string) => Promise<void>;
}

/** Self-service Art-library picker shared by adult, student and child accounts. */
export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentSeed,
  onClose,
  onSave,
}) => {
  const [selected, setSelected] = useState(currentSeed ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(currentSeed ?? "");
    setError(null);
  }, [currentSeed, isOpen]);

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
          <UIButton variant="primary" isLoading={saving} disabled={!selected} onClick={() => void save()}>
            Use this avatar
          </UIButton>
        </>
      )}
    >
      <p className="mb-4 text-sm text-body">
        Pick a character from Koda Art. Your choice follows your account on every device.
      </p>
      <AvatarArtChoices currentSeed={currentSeed} selectedSeed={selected} onSelect={setSelected} />
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </UIModal>
  );
};
