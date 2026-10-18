/**
 * The Rebus Rush card on the Think shelf: the door into the game.
 *
 * Drawn from the same card and badge as every other tile, so it reads as part
 * of the shelf rather than an advertisement for itself.
 */

import React from "react";
import { Puzzle } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge } from "../../components/ui";

export const RebusEntry: React.FC<{ onOpen(): void }> = ({ onOpen }) => {
  const { t } = useT();
  return (
    <button type="button" onClick={onOpen} className={themeSystem.card("interactive", "flex w-full items-center gap-4 p-4 text-left")}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
        <Puzzle className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-ink">{t("rebus.entryTitle")}</span>
        <span className="block text-sm text-body">{t("rebus.entryText")}</span>
      </span>
      <UIBadge variant="primary">{t("rebus.new")}</UIBadge>
    </button>
  );
};
