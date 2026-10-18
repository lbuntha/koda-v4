/**
 * Rebus Rush with nothing to play yet.
 *
 * Children only play what an admin has published, and a device keeps the last
 * list it was given. So "nothing" is one of two honest states: this device has
 * never been able to download the list (it needs to be online once), or it has
 * and there is nothing published. Each says which, and the first can try again.
 */

import React, { useState } from "react";
import { ArrowLeft, CloudDownload, RefreshCw } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { refreshBank } from "../bankStore";

export const RebusEmpty: React.FC<{ loaded: boolean; onBack?(): void }> = ({ loaded, onBack }) => {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const retry = async () => {
    setBusy(true);
    await refreshBank({ force: true });
    setBusy(false);
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-20">
      {onBack && (
        <div>
          <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onBack}>
            {t("rebus.back")}
          </UIButton>
        </div>
      )}
      <div className={themeSystem.card("default", `${themeSystem.spacing.card} flex flex-col items-center gap-3 text-center`)}>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
          <CloudDownload className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className={themeSystem.typography("h3")}>{loaded ? t("rebus.nothingYetTitle") : t("rebus.needsDownloadTitle")}</h2>
        <p className={themeSystem.typography("body-sm")}>{loaded ? t("rebus.nothingYetText") : t("rebus.needsDownloadText")}</p>
        <UIButton icon={<RefreshCw />} isLoading={busy} disabled={busy} onClick={() => void retry()}>
          {busy ? t("rebus.gettingPuzzles") : t("rebus.retry")}
        </UIButton>
      </div>
    </div>
  );
};
