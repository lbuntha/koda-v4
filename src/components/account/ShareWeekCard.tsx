import React, { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";

import { lastWeek, type ChildReport } from "../../lib/childReport";
import { formatNumber, translate, useT } from "../../lib/i18n";
import { renderShareCard, type ShareCardInput } from "../../lib/shareCard";
import { UIButton, UIModal, UISpinner } from "../ui";

/**
 * "Share this week": a parent turns their child's week into a picture to post.
 *
 * It lives on the parent's report, so sharing is the grown-up's choice. The
 * picture has no name, photo or score (see `shareCard.ts`). It is hidden in a
 * week with no practice, because an empty week is nothing to share.
 */

const FILE_NAME = "koda-week.png";

export function shareCardInput(report: ChildReport, language: string, link: string): ShareCardInput {
  const days = lastWeek();
  const practised = new Set(report.rhythm.weekDays ?? []);
  const count = report.rhythm.daysThisWeek;
  const mastered = report.concepts.filter((c) => c.status === "mastered").length;
  const t = (key: string, vars?: Record<string, string | number>) => translate(key, vars, language);
  return {
    link,
    days,
    practised: days.map((d) => practised.has(d)),
    text: {
      badge: t("report.share.badge"),
      headline: t("report.share.headline", { count }),
      subline: language.startsWith("en") ? "" : translate("report.share.headline", { count }, "en"),
      dayInitials: t("report.glance.weekInitials").split(","),
      mastered: formatNumber(mastered, language),
      masteredLabel: t("report.share.mastered"),
      questions: formatNumber(report.rhythm.questionsEver, language),
      questionsLabel: t("report.share.questions"),
      offer: t("report.share.offer"),
      offerDetail: t("report.share.offerDetail"),
      footer: t("report.share.footer"),
    },
  };
}

export const ShareWeekButton: React.FC<{ report: ChildReport }> = ({ report }) => {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (report.rhythm.daysThisWeek < 1) return null;
  return (
    <>
      <UIButton variant="secondary" icon={<Share2 />} onClick={() => setOpen(true)}>
        {t("report.share.button")}
      </UIButton>
      {open && <ShareWeekModal report={report} onClose={() => setOpen(false)} />}
    </>
  );
};

const ShareWeekModal: React.FC<{ report: ChildReport; onClose: () => void }> = ({ report, onClose }) => {
  const { t, language } = useT();
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url = "";
    let live = true;
    renderShareCard(shareCardInput(report, language, `${window.location.origin}/`))
      .then((blob) => {
        if (!live) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [report, language]);

  const file = image ? new File([image.blob], FILE_NAME, { type: "image/png" }) : null;
  const canShareFile =
    !!file && typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  const share = () => {
    if (!file) return;
    void navigator
      .share({ files: [file], text: t("report.share.message", { link: `${window.location.origin}/` }) })
      .catch(() => undefined);
  };

  return (
    <UIModal
      isOpen
      onClose={onClose}
      title={t("report.share.title")}
      footer={
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {canShareFile && (
            <UIButton icon={<Share2 />} onClick={share}>
              {t("report.share.share")}
            </UIButton>
          )}
          {image && (
            <a
              href={image.url}
              download={FILE_NAME}
              className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-line bg-surface px-4 font-bold text-ink hover:bg-surface-muted ${canShareFile ? "" : "sm:col-span-2"}`}
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              {t("report.share.save")}
            </a>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="mx-auto aspect-[4/5] w-full max-w-xs overflow-hidden rounded-2xl border-2 border-line bg-surface-muted">
          {image ? (
            <img src={image.url} alt={t("report.share.alt")} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              {failed ? <p className="p-4 text-center text-sm text-muted">{t("report.share.failed")}</p> : <UISpinner />}
            </div>
          )}
        </div>
        <p className="text-center text-sm text-muted">{t("report.share.privacy")}</p>
      </div>
    </UIModal>
  );
};
