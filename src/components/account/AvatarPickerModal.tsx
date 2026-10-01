import React, { useEffect, useState } from "react";
import { useT } from "../../lib/i18n";

import { ApiError } from "../../lib/sync";
import { UIButton, UIModal } from "../ui";
import { AvatarArtChoices } from "./AvatarArtChoices";

interface AvatarPickerModalProps {
  isOpen: boolean;
  currentSeed?: string;
  onClose: () => void;
  onSave: (seed: string) => Promise<void>;
}

/** Self-service Art and DiceBear picker shared by adult, student and child accounts. */
export const AvatarPickerModal: React.FC<AvatarPickerModalProps> = ({
  isOpen,
  currentSeed,
  onClose,
  onSave,
}) => {
  const [selected, setSelected] = useState(currentSeed ?? "");
  const { t } = useT();
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
      title={t("avatar.title")}
      footer={(
        <>
          <UIButton variant="secondary" onClick={onClose}>{t("common.cancel")}</UIButton>
          <UIButton variant="primary" isLoading={saving} disabled={!selected} onClick={() => void save()}>
            {t("avatar.use")}
          </UIButton>
        </>
      )}
    >
      <p className="mb-4 text-sm text-body">
        {t("avatar.note")}
      </p>
      <AvatarArtChoices currentSeed={currentSeed} selectedSeed={selected} onSelect={setSelected} />
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    </UIModal>
  );
};
