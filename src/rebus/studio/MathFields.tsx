/**
 * Writing a math question: the numbers, and nothing the author can get wrong.
 *
 * Two numbers, an operation and which part the child works out. The question
 * and its answer are worked out from those and shown as the child will see
 * them, so there is no answer to mistype. Numbers that do not make a question
 * (a negative result, a division that does not come out even) say why, here
 * and as the editor's checks.
 */

import React from "react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIInput, UISelect, UITabs } from "../../components/ui";
import type { PuzzleDraft } from "./studioApi";
import { deriveMath, MATH_MAX, MATH_OPS, mathAnswer, mathProblem, mathPrompt, type MathOp, type MathSpec, type MathUnknown } from "../math";

export const BLANK_MATH: MathSpec = { a: 6, op: "×", b: 7, unknown: "result" };

const UNKNOWNS: readonly MathUnknown[] = ["result", "a", "b"];

export const MathFields: React.FC<{ spec: MathSpec; onChange(spec: MathSpec): void }> = ({ spec, onChange }) => {
  const { t } = useT();
  const problem = mathProblem(spec);
  const number = (key: "a" | "b", raw: string) => {
    const n = raw === "" ? 0 : Number(raw.replace(/\D/g, ""));
    onChange({ ...spec, [key]: Math.min(MATH_MAX, n) });
  };

  return (
    <section className="flex flex-col gap-3" aria-label={t("rebus.studio.math.title")}>
      <h4 className={themeSystem.typography("h4")}>{t("rebus.studio.math.title")}</h4>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.math.first")}</span>
          <UIInput inputMode="numeric" value={String(spec.a)} onChange={(e) => number("a", e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.math.operation")}</span>
          <UISelect value={spec.op} onChange={(e) => onChange({ ...spec, op: e.target.value as MathOp })}>
            {MATH_OPS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </UISelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.math.second")}</span>
          <UIInput inputMode="numeric" value={String(spec.b)} onChange={(e) => number("b", e.target.value)} />
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.math.missing")}</span>
        <UITabs
          label={t("rebus.studio.math.missing")}
          items={UNKNOWNS.map((u) => ({ id: u, label: t(`rebus.studio.math.missing_${u}`) }))}
          value={spec.unknown}
          onChange={(id) => onChange({ ...spec, unknown: id as MathUnknown })}
        />
      </div>

      {problem ? (
        <p role="alert" className={themeSystem.flash("error")}>
          {t(`rebus.studio.issue.${problem}`)}
        </p>
      ) : (
        <div className={themeSystem.card("default", `${themeSystem.spacing.cardSm} flex flex-col items-center gap-1 text-center`)} aria-label={t("rebus.studio.math.preview")}>
          <span className="text-4xl font-black text-ink">{mathPrompt(spec)}</span>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{t("rebus.studio.math.answerIs", { n: mathAnswer(spec) })}</span>
        </div>
      )}
    </section>
  );
};

/** A new math question, with the numbers of an easy one so the preview is never empty. */
export const blankMath = (): PuzzleDraft => ({
  category: "math",
  ages: [7, 12],
  difficulty: 2,
  trick: "compound",
  kind: "math",
  math: BLANK_MATH,
  ...(deriveMath(BLANK_MATH) ?? { pieces: [], answer: "", accepts: [], explanation: "" }),
});
