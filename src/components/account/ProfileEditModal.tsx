import React, { useEffect, useState } from "react";

import { ApiError } from "../../lib/sync";
import { UIButton, UIModal } from "../ui";
import { themeSystem } from "../../lib/themeSystem";
import { AvatarArtChoices } from "./AvatarArtChoices";

export interface ProfileEditModalProps {
  isOpen: boolean;
  /** What the name field starts on — the learner's name for a child. */
  currentName: string;
  currentSeed?: string;
  /** Names the field for whoever is editing: "Your name", "Child's name". */
  nameLabel?: string;
  onClose: () => void;
  onSave: (patch: { displayName: string; avatarSeed: string }) => Promise<void>;
}

const field =
  themeSystem.field("lg", "w-full");

/**
 * The pencil on the profile banner.
 *
 * Name and face in one dialogue with one Save, because they are one thought —
 * `AvatarPickerModal` stays as it is for the sidebar menu, where changing the
 * face is the whole errand and a name field would be in the way.
 */
export const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  isOpen,
  currentName,
  currentSeed,
  nameLabel = "Display name",
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(currentName);
  const [selected, setSelected] = useState(currentSeed ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reopening after a change elsewhere must show the change, not the draft the
  // last open left behind.
  useEffect(() => {
    if (!isOpen) return;
    setName(currentName);
    setSelected(currentSeed ?? "");
    setError(null);
  }, [currentName, currentSeed, isOpen]);

  const save = async () => {
    if (!name.trim() || !selected || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({ displayName: name.trim(), avatarSeed: selected });
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
      title="Edit profile"
      tone="plain"
      footer={
        <>
          <UIButton variant="secondary" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton
            variant="primary"
            isLoading={saving}
            disabled={!name.trim() || !selected}
            onClick={() => void save()}
          >
            Save profile
          </UIButton>
        </>
      }
    >
      <div className="space-y-5">
        <label className="block space-y-1.5">
          <span className="koda-admin-label text-ink">{nameLabel}</span>
          <input
            className={field}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
          />
        </label>

        <div className="space-y-3">
          <span className="koda-admin-label block text-ink">Avatar</span>
          <AvatarArtChoices currentSeed={currentSeed} selectedSeed={selected} onSelect={setSelected} />
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </UIModal>
  );
};
