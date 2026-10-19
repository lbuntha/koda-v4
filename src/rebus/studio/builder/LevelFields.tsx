import React, { useState } from "react";
import { useT } from "../../../lib/i18n";
import { themeSystem } from "../../../lib/themeSystem";
import { UIAgePicker, UIButton, UIInput, UISelect, UITabs } from "../../../components/ui";
import { TRICKS, type Trick } from "../../types";
import { LEVELS, levelOf } from "../levels";
import type { PuzzleDraft } from "../studioApi";

/** Who the question is for: a level, and under "More options" the exact ages, difficulty, trick and extra accepted answers. */
export const LevelFields: React.FC<{ draft: PuzzleDraft; onChange(patch: Partial<PuzzleDraft>): void }> = ({ draft, onChange }) => {
  const { t } = useT();
  const [more, setMore] = useState(false);
  const typed = (draft.kind ?? "picture") === "picture";
  return (
    <section className="flex flex-col gap-3" aria-label={t("rebus.studio.level")}>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.level")}</span>
        <UITabs
          label={t("rebus.studio.level")}
          items={LEVELS.map((l) => ({ id: l.id, label: t(`rebus.studio.level_${l.id}`) }))}
          value={levelOf(draft.ages, draft.difficulty) ?? ""}
          onChange={(id) => {
            const level = LEVELS.find((l) => l.id === id);
            if (level) onChange({ ages: [level.ages[0], level.ages[1]], difficulty: level.difficulty });
          }}
        />
        <span className={themeSystem.typography("caption")}>{t("rebus.studio.levelLine", { min: draft.ages[0], max: draft.ages[1], difficulty: t(`rebus.studio.difficulty.${draft.difficulty}`) })}</span>
      </div>

      <div>
        <UIButton size="sm" variant="ghost" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {more ? t("rebus.studio.fewerOptions") : t("rebus.studio.moreOptions")}
        </UIButton>
      </div>
      {more && (
        <div className="grid gap-4 sm:grid-cols-2">
          {typed && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.accepts")}</span>
              <UIInput value={draft.accepts.join(", ")} onChange={(e) => onChange({ accepts: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder={t("rebus.studio.acceptsHint")} />
            </label>
          )}
          {typed && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.trick")}</span>
              <UISelect value={draft.trick} onChange={(e) => onChange({ trick: e.target.value as Trick })}>
                {TRICKS.map((k) => (
                  <option key={k} value={k}>
                    {t(`rebus.studio.trickName.${k}`)}
                  </option>
                ))}
              </UISelect>
            </label>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted">{t("rebus.studio.difficultyLabel")}</span>
            <UITabs label={t("rebus.studio.difficultyLabel")} items={[1, 2, 3].map((d) => ({ id: String(d), label: t(`rebus.studio.difficulty.${d}`) }))} value={String(draft.difficulty)} onChange={(id) => onChange({ difficulty: Number(id) })} />
          </div>
          <div className="sm:col-span-2">
            <UIAgePicker value={draft.ages} onChange={(ages) => onChange({ ages: [ages[0], ages[1]] })} />
          </div>
        </div>
      )}
    </section>
  );
};
