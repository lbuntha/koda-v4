import React from "react";
import { useT } from "../../../lib/i18n";
import { themeSystem } from "../../../lib/themeSystem";
import { useIssueText } from "../PuzzleCard";

/** What is still wrong, in words, or that nothing is. */
export const ChecksList: React.FC<{ issues: readonly string[] }> = ({ issues }) => {
  const { t } = useT();
  const issueText = useIssueText();
  return (
    <section aria-label={t("rebus.studio.checks")} className={themeSystem.card("default", themeSystem.spacing.cardSm)}>
      <h4 className={themeSystem.typography("h4")}>{t("rebus.studio.checks")}</h4>
      {issues.length === 0 ? (
        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{t("rebus.studio.checksPass")}</p>
      ) : (
        <ul className="mt-1 list-disc pl-5 text-sm font-bold text-rose-700 dark:text-rose-300">
          {issues.map((code) => (
            <li key={code}>{issueText(code)}</li>
          ))}
        </ul>
      )}
    </section>
  );
};
