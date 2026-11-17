import React from "react";
import { EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { UIButton, UIModal } from "./ui";
import { useT } from "../lib/i18n";
import type { InstallKind } from "../lib/install";

/**
 * The steps for a browser that cannot install from our button: Safari on
 * iPhone/iPad, an in-app browser, or a phone browser with no prompt to give.
 * A one-tap install never reaches here; the browser's own box covers it.
 */
export const InstallAppSheet: React.FC<{ kind: InstallKind | null; onClose: () => void }> = ({ kind, onClose }) => {
  const { t } = useT();
  const steps: { icon: React.ReactNode; text: string }[] =
    kind === "ios"
      ? [
          { icon: <Share />, text: t("install.iosStep1") },
          { icon: <SquarePlus />, text: t("install.iosStep2") },
        ]
      : kind === "in-app"
        ? [
            { icon: <EllipsisVertical />, text: t("install.inAppStep1") },
            { icon: <SquarePlus />, text: t("install.inAppStep2") },
          ]
        : [
            { icon: <EllipsisVertical />, text: t("install.manualStep1") },
            { icon: <SquarePlus />, text: t("install.manualStep2") },
          ];
  return (
    <UIModal
      isOpen={kind !== null}
      onClose={onClose}
      title={t("install.title")}
      footer={<UIButton variant="primary" onClick={onClose}>{t("install.gotIt")}</UIButton>}
    >
      <p className="mb-4 text-sm text-body">{kind === "in-app" ? t("install.inAppIntro") : t("install.intro")}</p>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={index} className="flex items-center gap-3 rounded-2xl border border-line p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 [&>svg]:h-5 [&>svg]:w-5">
              {step.icon}
            </span>
            <span className="text-sm font-medium text-ink">
              {index + 1}. {step.text}
            </span>
          </li>
        ))}
      </ol>
    </UIModal>
  );
};
