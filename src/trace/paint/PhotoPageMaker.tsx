/**
 * "Make my own picture" on the Trace page: two ways in.
 *
 * - From a photo: the AI redraws it as a colouring page. Needs a grown-up's
 *   yes and spends one of the family's pictures for the month.
 * - My own colouring page: one the child already has (a printed page, a
 *   tracing they photographed), read straight in with no AI and no credit.
 *
 * Either opens to paint in their own colours. Shown to every child; without
 * the plan it says who to ask rather than hiding, so the child knows it exists.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, ImageUp, Lock, Sparkles } from "lucide-react";
import { useT } from "../../lib/i18n";
import { Billing } from "../../lib/billing";
import { ChildSettingsAPI } from "../../lib/childSettings";
import { UIButton, UIModal } from "../../components/ui";
import type { TraceItem } from "../geometry/types";
import { AiPageError } from "./aiPage";
import type { PhotoCredits, PhotoDetail } from "./photoPages";
import { PHOTO_ERRORS, makePhotoPage, photoCredits, photoPageLock, uploadOwnPage } from "./photoPages";

export function PhotoPageMaker({ onMade }: { onMade(item: TraceItem): void }) {
  const { t, language } = useT();
  useSyncExternalStore(ChildSettingsAPI.subscribe, ChildSettingsAPI.version);
  useSyncExternalStore(Billing.subscribe, Billing.version);
  const lock = photoPageLock();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<PhotoDetail>("simple");
  const [busy, setBusy] = useState<"photo" | "own" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState<PhotoCredits | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const ownRef = useRef<HTMLInputElement>(null);

  // How many are left, read each time the dialog opens (another child may have used some).
  useEffect(() => {
    if (!open || lock !== null) return;
    let live = true;
    void photoCredits().then((c) => live && setCredits(c));
    return () => {
      live = false;
    };
  }, [open, lock]);

  const run = async (kind: "photo" | "own", file: File) => {
    setBusy(kind);
    setError(null);
    try {
      const item =
        kind === "photo"
          ? await makePhotoPage(file, detail, t("paint.photo.title"), t("paint.photo.instruction"))
          : await uploadOwnPage(file, t("paint.photo.ownTitle"), t("paint.photo.instruction"));
      setOpen(false);
      onMade(item);
    } catch (e) {
      const code = kind === "own" ? "own_failed" : e instanceof AiPageError ? e.code : "ai_failed";
      setError(code === "own_failed" || (PHOTO_ERRORS as readonly string[]).includes(code) ? code : "ai_failed");
      if (kind === "photo") void photoCredits().then(setCredits);
    } finally {
      setBusy(null);
    }
  };

  const fileInput = (ref: React.RefObject<HTMLInputElement | null>, kind: "photo" | "own") => (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) void run(kind, f);
      }}
    />
  );

  const usedUp = credits !== null && credits.left <= 0;
  const resets = credits ? new Date(credits.resetsAt).toLocaleDateString(language === "km" ? "km-KH" : undefined, { day: "numeric", month: "long" }) : "";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-pink-50 p-4 text-left ring-1 ring-indigo-200 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:from-indigo-950/40 dark:to-pink-950/30 dark:ring-indigo-900"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-indigo-950 dark:text-indigo-300">
          <Camera className="h-6 w-6" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-bold text-ink">{t("paint.photo.cta")}</span>
          <span className="text-sm text-muted">{lock === "plan" ? t("paint.photo.needPlan") : t("paint.photo.ctaNote")}</span>
        </span>
        {lock === "plan" && <Lock className="h-5 w-5 shrink-0 text-muted" aria-label={t("paint.photo.locked")} />}
      </button>

      <UIModal isOpen={open} onClose={() => !busy && setOpen(false)} title={t("paint.photo.cta")} tone="plain">
        {lock === "plan" ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-muted text-muted">
              <Lock className="h-7 w-7" />
            </span>
            <p className="max-w-sm text-sm text-body">{t("paint.photo.needPlan")}</p>
            <UIButton variant="secondary" onClick={() => setOpen(false)}>
              {t("paint.photo.ok")}
            </UIButton>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {fileInput(photoRef, "photo")}
            {fileInput(ownRef, "own")}

            {/* From a photo, with the AI */}
            <section className="flex flex-col gap-3 rounded-2xl bg-indigo-50/60 p-4 ring-1 ring-indigo-200 dark:bg-indigo-950/30 dark:ring-indigo-900">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                {t("paint.photo.fromPhoto")}
              </span>
              {lock === "consent" ? (
                <p className="flex items-start gap-2 text-sm text-body">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {t("paint.photo.needGrownUp")}
                </p>
              ) : (
                <>
                  <p className="text-sm text-body">{t("paint.photo.how")}</p>
                  <div role="radiogroup" aria-label={t("paint.photo.detail")} className="grid grid-cols-2 gap-2">
                    {(["simple", "patterns"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        role="radio"
                        aria-checked={detail === d}
                        disabled={busy !== null}
                        onClick={() => setDetail(d)}
                        className={`rounded-2xl p-3 text-left ring-2 transition ${detail === d ? "bg-white ring-indigo-500 dark:bg-indigo-950/60" : "bg-surface ring-line hover:ring-indigo-300"}`}
                      >
                        <span className="block font-semibold text-ink">{t(`paint.photo.${d}`)}</span>
                        <span className="block text-xs text-muted">{t(`paint.photo.${d}Note`)}</span>
                      </button>
                    ))}
                  </div>
                  <UIButton icon={<Sparkles className="h-4 w-4" />} onClick={() => photoRef.current?.click()} isLoading={busy === "photo"} disabled={busy !== null || usedUp}>
                    {busy === "photo" ? t("paint.photo.drawing") : t("paint.photo.choose")}
                  </UIButton>
                  {credits && (
                    <p className={`text-xs ${usedUp ? "font-semibold text-rose-700 dark:text-rose-300" : "text-muted"}`}>
                      {usedUp ? t("paint.photo.usedUp", { date: resets }) : t("paint.photo.left", { left: credits.left, limit: credits.limit })}
                    </p>
                  )}
                  <p className="text-xs text-muted">{t("paint.photo.privacy")}</p>
                </>
              )}
            </section>

            {/* A colouring page they already have: no AI */}
            <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
              <span className="flex items-center gap-2 font-semibold text-ink">
                <ImageUp className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                {t("paint.photo.ownPage")}
              </span>
              <p className="text-sm text-body">{t("paint.photo.ownPageNote")}</p>
              <UIButton variant="secondary" icon={<ImageUp className="h-4 w-4" />} onClick={() => ownRef.current?.click()} isLoading={busy === "own"} disabled={busy !== null}>
                {busy === "own" ? t("paint.photo.reading") : t("paint.photo.ownChoose")}
              </UIButton>
            </section>

            {error && <p className="text-sm text-rose-700 dark:text-rose-300">{t(`paint.photo.error.${error}`)}</p>}
          </div>
        )}
      </UIModal>
    </>
  );
}
