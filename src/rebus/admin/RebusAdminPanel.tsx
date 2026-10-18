/**
 * The owner's controls for Rebus Rush.
 *
 * One panel on the Admin page, because these are the operator's rules for every
 * family, not one child's preferences. It loads the live values before it lets
 * anyone edit, and refuses to save when it could not load, so a dropped
 * connection can never overwrite the real settings with the defaults. A save
 * is also cached on this device at once, so the operator's own game plays by
 * the new rules without waiting for the next sync.
 */

import React, { useEffect, useState } from "react";
import { Minus, Plus, RotateCcw, Save } from "lucide-react";
import { translate, useT } from "../../lib/i18n";
import { ApiError, accessToken, request } from "../../lib/sync";
import { ScoringAPI } from "../../lib/scoring";
import { cacheSystemSetting } from "../../lib/sync/system";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UITabs, UIToggleRow } from "../../components/ui";
import { DEFAULT_SETTINGS, SETTING_LIMITS, type RebusSettings } from "../settings";
import { GroupReport } from "./GroupReport";
import { parseRebusSettings, REBUS_SETTING } from "../settingsStore";

const LEVELS = ["easy", "medium", "hard"] as const;

const Row: React.FC<{ title: string; hint: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="font-black text-ink">{title}</div>
      <div className="text-sm text-body">{hint}</div>
    </div>
    <div className="shrink-0">{children}</div>
  </div>
);

/** A number with a minus and a plus: no slider to miss with a thumb. */
const NumberStepper: React.FC<{ label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange(n: number): void }> = ({ label, value, min, max, step = 1, unit = "", onChange }) => (
  <div className="flex items-center gap-2" role="group" aria-label={label}>
    <UIButton variant="secondary" size="step" aria-label={`${label} −`} icon={<Minus />} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} />
    <span className="min-w-16 text-center text-xl font-black text-ink">
      {value}
      {unit}
    </span>
    <UIButton variant="secondary" size="step" aria-label={`${label} +`} icon={<Plus />} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} />
  </div>
);

export const RebusAdminPanel: React.FC = () => {
  const { t } = useT();
  const [draft, setDraft] = useState<RebusSettings>(DEFAULT_SETTINGS);
  const [baseline, setBaseline] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const values = await request<Record<string, unknown>>("/system", { token: await accessToken() });
        if (!active) return;
        const current = parseRebusSettings(values[REBUS_SETTING]);
        setDraft(current);
        setBaseline(JSON.stringify(current));
        setLoaded(true);
      } catch {
        if (active) setError(translate("rebus.admin.offline"));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const change = (patch: Partial<RebusSettings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };

  const dirty = loaded && JSON.stringify(draft) !== baseline;

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await request<{ value: string }>(`/system/settings/${REBUS_SETTING}`, { method: "PATCH", token: await accessToken(), body: { value: JSON.stringify(draft) } });
      const next = parseRebusSettings(result.value);
      setDraft(next);
      setBaseline(JSON.stringify(next));
      cacheSystemSetting(REBUS_SETTING, result.value);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("rebus.admin.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const toggleChoice = (n: number) => {
    const has = draft.questionChoices.includes(n);
    if (has && draft.questionChoices.length === 1) return;
    change({ questionChoices: (has ? draft.questionChoices.filter((c) => c !== n) : [...draft.questionChoices, n]).sort((a, b) => a - b) });
  };

  const lockItems = [{ id: "free", label: t("rebus.admin.childPicks") }, ...LEVELS.map((key, i) => ({ id: String(i), label: t(`rebus.level.${key}`) }))];

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)} aria-label={t("rebus.admin.title")}>
      <div>
        <h3 className={themeSystem.typography("h3")}>{t("rebus.admin.title")}</h3>
        <p className={themeSystem.typography("body-sm", "mt-1")}>{t("rebus.admin.subtitle")}</p>
      </div>

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className={themeSystem.flash("success")}>
          {t("rebus.admin.saved")}
        </p>
      )}

      <fieldset disabled={!loaded} className="space-y-3 border-0 p-0 disabled:opacity-60">
        <Row title={t("rebus.admin.hintDelay")} hint={t("rebus.admin.hintDelayHint")}>
          <NumberStepper label={t("rebus.admin.hintDelay")} value={draft.hintDelaySec} {...SETTING_LIMITS.hintDelaySec} unit="s" onChange={(n) => change({ hintDelaySec: n })} />
        </Row>
        <Row title={t("rebus.admin.timeLimit")} hint={t("rebus.admin.timeLimitHint")}>
          <NumberStepper label={t("rebus.admin.timeLimit")} value={draft.puzzleLimitSec} {...SETTING_LIMITS.puzzleLimitSec} step={5} unit="s" onChange={(n) => change({ puzzleLimitSec: n })} />
        </Row>
        <Row title={t("rebus.admin.hintRungs")} hint={t("rebus.admin.hintRungsHint")}>
          <NumberStepper label={t("rebus.admin.hintRungs")} value={draft.hintRungs} min={1} max={3} onChange={(n) => change({ hintRungs: n as 1 | 2 | 3 })} />
        </Row>
        <Row title={t("rebus.admin.maxPlayers")} hint={t("rebus.admin.maxPlayersHint")}>
          <NumberStepper label={t("rebus.admin.maxPlayers")} value={draft.maxPlayers} {...SETTING_LIMITS.maxPlayers} onChange={(n) => change({ maxPlayers: n })} />
        </Row>
        <UIToggleRow title={t("rebus.admin.guestsAllowed")} description={t("rebus.admin.guestsAllowedHint")} checked={draft.guestsAllowed} onChange={() => change({ guestsAllowed: !draft.guestsAllowed })} />
        <h4 className={`${themeSystem.typography("h4")} pt-2`}>{t("rebus.admin.pointsTitle")}</h4>
        <p className={themeSystem.typography("caption")}>{t("rebus.admin.pointsText")}</p>
        <Row title={t("rebus.admin.pointsPerPuzzle")} hint={t("rebus.admin.pointsPerPuzzleHint")}>
          <NumberStepper label={t("rebus.admin.pointsPerPuzzle")} value={draft.pointsPerPuzzle} {...SETTING_LIMITS.pointsPerPuzzle} onChange={(n) => change({ pointsPerPuzzle: n })} />
        </Row>
        <Row title={t("rebus.admin.hintCost")} hint={t("rebus.admin.hintCostHint")}>
          <NumberStepper label={t("rebus.admin.hintCost")} value={draft.hintCost} {...SETTING_LIMITS.hintCost} onChange={(n) => change({ hintCost: n })} />
        </Row>
        <Row title={t("rebus.admin.machinePoints")} hint={t("rebus.admin.machinePointsHint")}>
          <NumberStepper label={t("rebus.admin.machinePoints")} value={draft.machinePoints} {...SETTING_LIMITS.machinePoints} onChange={(n) => change({ machinePoints: n })} />
        </Row>

        <h4 className={`${themeSystem.typography("h4")} pt-2`}>{t("rebus.admin.xpTitle")}</h4>
        <UIToggleRow
          title={t("rebus.admin.xpSame")}
          description={t("rebus.admin.xpSameHint", { xp: ScoringAPI.current().xpPerLevel })}
          checked={draft.xpPerRound === null}
          onChange={() => change({ xpPerRound: draft.xpPerRound === null ? ScoringAPI.current().xpPerLevel : null })}
        />
        {draft.xpPerRound !== null && (
          <Row title={t("rebus.admin.xpPerRound")} hint={t("rebus.admin.xpPerRoundHint")}>
            <NumberStepper label={t("rebus.admin.xpPerRound")} value={draft.xpPerRound} {...SETTING_LIMITS.xpPerRound} step={5} onChange={(n) => change({ xpPerRound: n })} />
          </Row>
        )}

        <div className="space-y-2 rounded-2xl border border-line bg-surface-muted p-4">
          <div className="font-black text-ink">{t("rebus.admin.machineLevel")}</div>
          <div className="text-sm text-body">{t("rebus.admin.machineLevelHint")}</div>
          <UITabs label={t("rebus.admin.machineLevel")} items={lockItems} value={String(draft.machineLock)} onChange={(id) => change({ machineLock: id === "free" ? "free" : (Number(id) as 0 | 1 | 2) })} />
        </div>
        <div className="space-y-2 rounded-2xl border border-line bg-surface-muted p-4">
          <div className="font-black text-ink">{t("rebus.admin.questionChoices")}</div>
          <div className="text-sm text-body">{t("rebus.admin.questionChoicesHint")}</div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("rebus.admin.questionChoices")}>
            {Array.from({ length: SETTING_LIMITS.questions.max - SETTING_LIMITS.questions.min + 1 }, (_, i) => SETTING_LIMITS.questions.min + i).map((n) => (
              <UIButton key={n} size="sm" variant={draft.questionChoices.includes(n) ? "primary" : "secondary"} aria-pressed={draft.questionChoices.includes(n)} onClick={() => toggleChoice(n)}>
                {n}
              </UIButton>
            ))}
          </div>
        </div>
        <UIToggleRow title={t("rebus.admin.letterTiles")} description={t("rebus.admin.letterTilesHint")} checked={draft.letterTiles} onChange={() => change({ letterTiles: !draft.letterTiles })} />
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <UIButton icon={<Save />} isLoading={saving} disabled={!dirty || saving} onClick={() => void save()}>
          {t("rebus.admin.save")}
        </UIButton>
        <UIButton variant="secondary" icon={<RotateCcw />} disabled={!loaded || saving} onClick={() => change({ ...DEFAULT_SETTINGS })}>
          {t("rebus.admin.reset")}
        </UIButton>
      </div>
      <GroupReport />
    </section>
  );
};
