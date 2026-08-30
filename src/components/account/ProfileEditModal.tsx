import React, { useEffect, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";

import { diceBearAvatar, newAvatarSeed } from "../../lib/avatar";
import { ApiError } from "../../lib/sync";
import { copyText } from "../../utils/clipboard";
import { UIAvatar, UIButton, UIModal } from "../ui";
import { themeSystem } from "../../lib/themeSystem";

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

const choices = (current?: string): string[] => [
  ...(current ? [current] : []),
  ...Array.from({ length: current ? 7 : 8 }, () => newAvatarSeed()),
];

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
  const [seeds, setSeeds] = useState<string[]>(() => choices(currentSeed));
  const [selected, setSelected] = useState(currentSeed ?? seeds[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedSeed, setCopiedSeed] = useState<string | null>(null);

  // Reopening after a change elsewhere must show the change, not the draft the
  // last open left behind.
  useEffect(() => {
    if (!isOpen) return;
    const next = choices(currentSeed);
    setName(currentName);
    setSeeds(next);
    setSelected(currentSeed ?? next[0]);
    setError(null);
    setCopiedSeed(null);
  }, [currentName, currentSeed, isOpen]);

  const copyAvatarSvg = async (seed: string) => {
    try {
      const response = await fetch(diceBearAvatar(seed));
      if (!response.ok) throw new Error("Avatar SVG unavailable");
      const copied = await copyText(await response.text());
      if (!copied) throw new Error("Clipboard unavailable");
      setCopiedSeed(seed);
      window.setTimeout(() => setCopiedSeed((current) => (current === seed ? null : current)), 1600);
    } catch {
      setError("Could not copy this avatar SVG. Try again while connected.");
    }
  };

  const save = async () => {
    if (!name.trim() || saving) return;
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
      footer={
        <>
          <UIButton variant="secondary" onClick={onClose}>
            Cancel
          </UIButton>
          <UIButton
            variant="primary"
            isLoading={saving}
            disabled={!name.trim()}
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
          <div className="grid grid-cols-4 gap-3">
            {seeds.map((seed) => (
              <div key={seed} className="relative aspect-square">
                <button
                  type="button"
                  aria-label="Choose this avatar"
                  aria-pressed={selected === seed}
                  onClick={() => setSelected(seed)}
                  className={`h-full w-full overflow-hidden rounded-2xl border-2 p-1 transition ${
                    selected === seed
                      ? "border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/40"
                      : "border-line bg-surface hover:border-indigo-300"
                  }`}
                >
                  <UIAvatar name="Avatar choice" seed={seed} size="fill" decorative />
                </button>
                <button
                  type="button"
                  aria-label={copiedSeed === seed ? "Avatar SVG copied" : "Copy avatar SVG"}
                  title={copiedSeed === seed ? "Copied" : "Copy SVG"}
                  onClick={(event) => {
                    event.stopPropagation();
                    void copyAvatarSvg(seed);
                  }}
                  className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-700 bg-indigo-600 text-white shadow-md hover:bg-indigo-500 dark:border-indigo-300 dark:bg-indigo-500"
                >
                  {copiedSeed === seed ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
          <UIButton
            variant="secondary"
            size="sm"
            icon={<RefreshCw />}
            onClick={() => {
              const next = choices();
              setSeeds(next);
              setSelected(next[0]);
            }}
          >
            Show new choices
          </UIButton>
        </div>

        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    </UIModal>
  );
};
