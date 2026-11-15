import React from "react";

import { GOOD_WEEK_DAYS, lastWeek, type ChildReport, type Glance, type GlanceTone } from "../../lib/childReport";
import { useT } from "../../lib/i18n";
import type { MasteryStatus } from "../../lib/learning/mastery";
import { themeSystem } from "../../lib/themeSystem";
import { UIStatTile, UIArtIcon } from "../ui";

/**
 * The top of a child's report: one verdict, four numbers, one bar.
 *
 * Built for a parent with ten seconds and a phone. The tint of the card says
 * the answer before a word is read; the tiles say why; the bar says where the
 * lessons are; and the numbered list says what to do. Everything else on the
 * page is the evidence behind it.
 *
 * Colours come from the theme's meanings only — primary, success, danger, info
 * — never a raw shade, and never yellow.
 */

type Tone = "primary" | "success" | "danger";

const TONE: Record<GlanceTone, { tone: Tone; icon: React.ReactNode }> = {
  quiet: { tone: "danger", icon: <UIArtIcon id="kit-hours" className="h-6 w-6" /> },
  help: { tone: "danger", icon: <UIArtIcon id="kit-alert" className="h-6 w-6" /> },
  early: { tone: "primary", icon: <UIArtIcon id="kit-flag" className="h-6 w-6" /> },
  light: { tone: "primary", icon: <UIArtIcon id="kit-repeat" className="h-6 w-6" /> },
  good: { tone: "success", icon: <UIArtIcon id="kit-sparkle" className="h-6 w-6" /> },
};

/**
 * Bar order: settled on the left, trouble on the right where the eye ends.
 * Each band wears the same theme tone as its badge further down the page.
 */
export const BAND_FILL: Record<MasteryStatus, string> = {
  mastered: "bg-emerald-500",
  practising: "bg-indigo-500",
  learning: "bg-sky-400",
  struggling: "bg-rose-500",
  "not-started": "bg-line",
};
const BAR: Exclude<MasteryStatus, "not-started">[] = ["mastered", "practising", "learning", "struggling"];

export interface GlanceAction {
  text: string;
  why?: string;
}

export const ReportGlance: React.FC<{
  report: ChildReport;
  summary: Glance;
  learnerName: string;
  lastPlayed: string;
  actions: GlanceAction[];
  /** Open and scroll to a band's group further down the page. */
  onJump: (status: MasteryStatus) => void;
}> = ({ report, summary, learnerName, lastPlayed, actions, onJump }) => {
  const { t } = useT();
  const tone = TONE[summary.tone];
  const practised = new Set(report.rhythm.weekDays ?? []);
  const week = lastWeek();
  /* From the catalog, not Intl: browsers ship no Khmer weekday names. Sunday first. */
  const initials = t("report.glance.weekInitials").split(",");
  const total = BAR.reduce((sum, status) => sum + summary.counts[status], 0);
  const banner = themeSystem.banner;
  const tile = themeSystem.statTile;

  const why =
    summary.tone === "quiet"
      ? t("report.glance.tone.quiet.why", { when: lastPlayed })
      : summary.tone === "help"
        ? t("report.glance.tone.help.why", { count: summary.counts.struggling, name: learnerName })
        : summary.tone === "light"
          ? t("report.glance.tone.light.why", { target: GOOD_WEEK_DAYS })
          : t(`report.glance.tone.${summary.tone}.why`);

  return (
    <section aria-label={t("report.glance.atGlance")} className={`${banner.cardTinted(tone.tone)} space-y-4`}>
      {/* The verdict: the theme tone first, then four words, then one line of why. */}
      <div className={banner.row}>
        <span className={`${banner.wellTinted(tone.tone)} ${banner.tone(tone.tone)}`}>{tone.icon}</span>
        <div className="min-w-0 flex-1">
          <p className={tile.label}>{t("report.glance.atGlance")}</p>
          <h2 className="text-xl font-black leading-tight text-ink sm:text-2xl">
            {t(`report.glance.tone.${summary.tone}.title`, { name: learnerName })}
          </h2>
          <p className={banner.message}>{why}</p>
        </div>
      </div>

      {/* Two across on a phone, four from a tablet up. The week tile is the
          theme's stat tile stood on end, so it can carry its seven dots. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className={tile.tile("default", "col-span-2 !items-stretch flex-col !gap-2 md:col-span-1")}>
          <div className="flex items-center gap-3">
            <span className={`${tile.well} ${tile.tone("primary")}`}>
              <UIArtIcon id="kit-calendar" className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className={`block ${tile.value}`}>
                {t("report.glance.weekDays", { count: report.rhythm.daysThisWeek })}
              </span>
              <span className={`block ${tile.label}`}>{t("report.glance.week")}</span>
            </span>
          </div>
          <ol className="flex justify-between gap-1" aria-hidden="true">
            {week.map((day) => (
              <li key={day} className="flex flex-col items-center gap-1">
                <span
                  className={`h-3 w-3 rounded-full ${
                    practised.has(day) ? BAND_FILL.mastered : "border border-line bg-surface-muted"
                  }`}
                />
                <span className="text-[9px] font-bold leading-none text-muted">
                  {initials[new Date(`${day}T00:00:00`).getDay()]}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <UIStatTile icon={<UIArtIcon id="kit-sparkle" className="h-6 w-6" />} tone="success" value={summary.counts.mastered} label={t("report.glance.secure")} />
        <UIStatTile
          icon={<UIArtIcon id="kit-alert" className="h-6 w-6" />}
          tone="danger"
          value={summary.counts.struggling}
          label={t("report.glance.needHelp")}
        />
        <UIStatTile
          className="col-span-2 md:col-span-1"
          icon={<UIArtIcon id="kit-target" className="h-6 w-6" />}
          value={summary.firstTry === null ? "—" : `${Math.round(summary.firstTry * 100)}%`}
          label={summary.firstTry === null ? t("report.glance.firstTryNone") : t("report.glance.firstTry")}
        />
      </div>

      {/* Where the lessons are, as one bar. Each legend chip opens its group. */}
      {total > 0 && (
        <div className={tile.tile("default", "!block")}>
          <p className="text-sm font-bold text-ink">{t("report.glance.lessonsBar", { name: learnerName })}</p>
          <div className="mt-2 flex h-3 gap-[2px] overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
            {BAR.map((status) =>
              summary.counts[status] > 0 ? (
                <span
                  key={status}
                  className={`${BAND_FILL[status]} h-full`}
                  style={{ width: `${(summary.counts[status] / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {BAR.map((status) =>
              summary.counts[status] > 0 ? (
                <li key={status}>
                  <button
                    type="button"
                    onClick={() => onJump(status)}
                    className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-semibold text-body transition hover:border-indigo-400 dark:hover:border-indigo-500/60"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${BAND_FILL[status]}`} aria-hidden="true" />
                    {t(`report.status.${status}.label`)}
                    <span className="font-black tabular-nums text-ink">{summary.counts[status]}</span>
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}

      {/* What to do: at most three, the most useful first. */}
      {actions.length > 0 && (
        <div className={tile.tile("default", "!block")}>
          <p className={`${tile.label} ${banner.tone("primary")}`}>{t("report.glance.toDo")}</p>
          <ol className="mt-2 space-y-2.5">
            {actions.map((action, i) => (
              <li key={action.text} className="flex gap-2.5">
                <span className={themeSystem.badge("primary", "!h-6 !w-6 shrink-0 !justify-center !rounded-full !p-0 text-xs font-black")}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className={`leading-snug text-ink ${i === 0 ? "text-base font-bold" : "text-sm font-semibold"}`}>
                    {action.text}
                  </p>
                  {action.why && <p className="mt-0.5 text-xs leading-snug text-muted">{action.why}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};
