import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { PAGE_HEADING_LIMIT, PAGE_TEXT_ALIGNS, PAGE_TEXT_SIZES, PICTURE_PLACES, type PageDesign, type PageTextSize, type PicturePlace } from "../data/passage";
import type { PageChoice } from "../bookLayout";
import type { ReaderPage } from "../BookReader";
import { UIInput, UISelect } from "../../components/ui";
import { useT } from "../../lib/i18n";

/**
 * The preview's page text controls: how large the page on screen is set, and
 * how its words line up.
 *
 * Here rather than beside the page cards, because a size can only be judged on
 * the page itself — with its picture, at this screen's width — and the preview
 * is the real reader, redrawn as each choice is made. One row that wraps, every
 * target a finger's width, so it works in a phone's preview too.
 */

const ALIGN_ICON = { left: AlignLeft, center: AlignCenter, right: AlignRight } as const;
const SIZES = Object.keys(PAGE_TEXT_SIZES) as PageTextSize[];

const seg = "grid h-10 min-w-10 place-items-center rounded-full px-2 text-ink transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 aria-pressed:bg-indigo-600 aria-pressed:text-white dark:hover:bg-slate-800 dark:aria-pressed:bg-indigo-500";

export function PageTextBar({ page, onText }: { page: ReaderPage | null; onText(ids: string[], patch: PageChoice): void }) {
  const { t } = useT();
  const changeDesign = (patch: PageDesign) => {
    if (page) onText(page.ids, { design: { ...page.design, ...patch } });
  };
  return (
    <div role="group" aria-label={page ? t("studio.pages.textFor", { n: page.n }) : t("studio.pages.text")} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/70 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-950/40">
      {!page ? (
        <p className="text-sm text-muted">{t("studio.pages.textOnCover")}</p>
      ) : (
        <>
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("studio.pages.page", { n: page.n })}</span>
          <div role="group" aria-label={t("studio.pages.textSize")} className="flex items-center gap-0.5 rounded-full bg-surface-muted/70 p-0.5">
            {SIZES.map((size) => (
              <button key={size} type="button" aria-pressed={page.text.size === size} aria-label={t(`studio.pages.size.${size}`)} title={t(`studio.pages.size.${size}`)}
                onClick={() => onText(page.ids, { textSize: size })} className={seg}>
                <span aria-hidden="true" className="font-serif font-bold leading-none" style={{ fontSize: `${0.7 * PAGE_TEXT_SIZES[size]}rem` }}>A</span>
              </button>
            ))}
          </div>
          <div role="group" aria-label={t("studio.pages.textAlign")} className="flex items-center gap-0.5 rounded-full bg-surface-muted/70 p-0.5">
            {PAGE_TEXT_ALIGNS.map((align) => {
              const Icon = ALIGN_ICON[align];
              return (
                <button key={align} type="button" aria-pressed={page.text.align === align} aria-label={t(`studio.pages.align.${align}`)} title={t(`studio.pages.align.${align}`)}
                  onClick={() => onText(page.ids, { textAlign: align })} className={seg}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <span className="text-xs text-muted">{t(`studio.pages.size.${page.text.size}`)} · {t(`studio.pages.align.${page.text.align}`)}</span>
          <div className="grid w-full gap-2 border-t border-line pt-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid gap-1">
              <span className="koda-admin-label">{t("studio.pages.design.layout")}</span>
              <UISelect value={page.design.layout ?? "story"} onChange={(e) => changeDesign({ layout: e.target.value === "steps" ? "steps" : undefined })}>
                <option value="story">{t("studio.pages.design.story")}</option>
                <option value="steps">{t("studio.pages.design.steps")}</option>
              </UISelect>
            </label>
            <label className="grid gap-1">
              <span className="koda-admin-label">{t("studio.pages.design.heading")}</span>
              <UIInput maxLength={PAGE_HEADING_LIMIT} value={page.design.heading ?? ""} onChange={(e) => changeDesign({ heading: e.target.value || undefined })} />
            </label>
            <label className="grid gap-1">
              <span className="koda-admin-label">{t("studio.pages.design.tone")}</span>
              <UISelect value={page.design.tone ?? "paper"} onChange={(e) => {
                const tone = e.target.value;
                changeDesign({ tone: tone === "sky" || tone === "sun" ? tone : undefined });
              }}>
                {(["paper", "sky", "sun"] as const).map((tone) => <option key={tone} value={tone}>{t(`studio.pages.design.${tone}`)}</option>)}
              </UISelect>
            </label>
            <label className="grid gap-1">
              <span className="koda-admin-label">{t("studio.pages.design.picturePosition")}</span>
              <UISelect value={page.at} onChange={(e) => onText(page.ids, { at: e.target.value as PicturePlace })}>
                {PICTURE_PLACES.map((at) => <option key={at} value={at}>{t(`studio.pages.place.${at}`)}</option>)}
              </UISelect>
            </label>
            {page.design.layout === "steps" && page.ids.length > 1 && (
              <label className="flex min-h-10 items-center gap-2 sm:col-span-2">
                <input type="checkbox" checked={!!page.design.intro} onChange={(e) => changeDesign({ intro: e.target.checked || undefined })} />
                <span className="koda-admin-label">{t("studio.pages.design.intro")}</span>
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
}
