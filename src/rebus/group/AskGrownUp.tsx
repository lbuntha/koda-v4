/**
 * "Ask a grown-up to sign up": for a child who played as a guest and wants more.
 *
 * It collects nothing from the child. It only writes a short note, with the
 * address of Koda, that the child can show, share or copy for a parent. The
 * child never types an email, a name or anything else.
 */

import React, { useState } from "react";
import { Check, Copy, Share2, Users } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export interface AskGrownUpProps {
  /** The first time the note is opened, so the owner can see how many children ask. */
  onOpen?(): void;
}

export const AskGrownUp: React.FC<AskGrownUpProps> = ({ onOpen }) => {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const note = t("rebus.group.ask.note", { link: window.location.origin });

  const share = async () => {
    try {
      await navigator.share({ title: t("rebus.title"), text: note });
    } catch {
      /* Cancelled, or not available: the copy button is still there. */
    }
  };

  const copy = async () => {
    if (await copyText(note)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} flex flex-col gap-3`)} aria-label={t("rebus.group.ask.title")}>
      <div className="flex items-start gap-3">
        <Users aria-hidden="true" className="mt-1 h-6 w-6 shrink-0 text-indigo-600 dark:text-indigo-400" />
        <div className="flex flex-col gap-1">
          <h3 className={themeSystem.typography("h4")}>{t("rebus.group.ask.title")}</h3>
          <p className={themeSystem.typography("body-sm")}>{t("rebus.group.ask.body")}</p>
        </div>
      </div>
      {!open ? (
        <UIButton variant="secondary" fullWidth onClick={() => {
            setOpen(true);
            onOpen?.();
          }}>
          {t("rebus.group.ask.button")}
        </UIButton>
      ) : (
        <>
          <p className="rounded-2xl border border-line px-3 py-2 text-base font-semibold text-ink">{note}</p>
          <div className="flex flex-wrap gap-2">
            <UIButton size="sm" variant="secondary" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
              {copied ? t("rebus.group.copied") : t("rebus.group.ask.copy")}
            </UIButton>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <UIButton size="sm" variant="secondary" icon={<Share2 />} onClick={() => void share()}>
                {t("rebus.group.share")}
              </UIButton>
            )}
          </div>
        </>
      )}
    </section>
  );
};
