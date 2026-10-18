/**
 * One puzzle, as a reviewer needs to see it: the picture, the answer, why it works,
 * who it is for, and what (if anything) is wrong with it.
 */

import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge } from "../../components/ui";
import type { BadgeVariant } from "../../lib/themeSystem";
import { PuzzleCanvas } from "../ui/PieceView";
import type { PuzzleStatus, StudioPuzzle } from "./studioApi";

const STATUS_TONE: Record<PuzzleStatus, BadgeVariant> = { draft: "neutral", approved: "info", published: "success", retired: "neutral", rejected: "danger" };

/** The words for a code the server returned. */
export const useIssueText = () => {
  const { t } = useT();
  return (code: string): string => t(`rebus.studio.issue.${code}`);
};

export const PuzzleCard: React.FC<{ puzzle: StudioPuzzle; actions?: React.ReactNode; large?: boolean }> = ({ puzzle, actions, large = false }) => {
  const { t } = useT();
  const issueText = useIssueText();
  return (
    <article className={themeSystem.card("default", `flex flex-col gap-3 ${themeSystem.spacing.cardSm}`)} aria-label={puzzle.answer}>
      <div className="flex flex-wrap items-center gap-1.5">
        <UIBadge variant={STATUS_TONE[puzzle.status]}>{t(`rebus.studio.status.${puzzle.status}`)}</UIBadge>
        <UIBadge variant="info">{t(`rebus.categories.${puzzle.category}`)}</UIBadge>
        <UIBadge variant="neutral">{t("rebus.studio.ages", { min: puzzle.ages[0], max: puzzle.ages[1] })}</UIBadge>
        <UIBadge variant="neutral">{t(`rebus.studio.difficulty.${puzzle.difficulty}`)}</UIBadge>
        {puzzle.source !== "official" && <UIBadge variant="primary">{t(`rebus.studio.source.${puzzle.source}`)}</UIBadge>}
        {puzzle.status === "published" && puzzle.release ? <UIBadge variant="neutral">{t("rebus.studio.releaseBadge", { n: puzzle.release })}</UIBadge> : null}
      </div>

      <div className={large ? "scale-100" : "origin-top-left scale-[0.82]"} style={large ? undefined : { marginBottom: "-1.5rem" }}>
        <PuzzleCanvas pieces={puzzle.pieces} label={puzzle.answer} />
      </div>

      <div>
        <div className="text-xl font-black text-ink">{puzzle.answer}</div>
        {puzzle.accepts.length > 0 && <div className={themeSystem.typography("caption")}>{t("rebus.studio.alsoAccepts", { list: puzzle.accepts.join(", ") })}</div>}
        <p className="mt-1 text-sm text-body">{puzzle.explanation || <em>{t("rebus.studio.noExplanation")}</em>}</p>
      </div>

      {puzzle.issues.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-sm font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {puzzle.issues.map((code) => (
            <li key={code} className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {issueText(code)}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {t("rebus.studio.checksPass")}
        </div>
      )}

      {puzzle.checks?.blind && (
        <div className={`rounded-xl border p-2.5 text-sm font-bold ${puzzle.checks.blind.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"}`}>
          {puzzle.checks.blind.ok ? t("rebus.studio.solverRead", { said: puzzle.checks.blind.said }) : t("rebus.studio.solverMissed", { said: puzzle.checks.blind.said })}
        </div>
      )}

      {puzzle.createdByName && <p className={themeSystem.typography("caption")}>{t("rebus.studio.addedBy", { name: puzzle.createdByName })}</p>}

      {puzzle.note && <p className="text-sm text-muted">{t("rebus.studio.note", { note: puzzle.note })}</p>}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </article>
  );
};
