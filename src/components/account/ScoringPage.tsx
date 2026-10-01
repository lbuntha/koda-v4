import React, { useSyncExternalStore } from "react";
import { Flame, RotateCcw, Star } from "lucide-react";

import { usePermissions } from "../../lib/sync";
import { ScoringAPI, type ScoringConfig } from "../../lib/scoring";
import { StreakAPI, type StreakConfig } from "../../lib/streak";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UISectionHeader, UIToggle } from "../ui";
import { NoAccess } from "./NoAccess";

import { translate } from "../../lib/i18n";
/** One numeric scoring control: a slider and the value it is set to. */
const ScoringSlider: React.FC<{
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format(value: number): string;
  onChange(value: number): void;
}> = ({ label, description, value, min, max, step, format, onChange }) => (
  <div className="bg-surface-muted border border-line rounded-2xl p-4 flex items-center justify-between gap-4">
    <div className="min-w-0">
      <h4 className="text-sm font-bold text-ink font-mono">{label}</h4>
      <p className="text-xs text-muted">{description}</p>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-28 sm:w-36 accent-indigo-600"
        aria-label={label}
      />
      <span className="w-14 text-right text-sm font-mono font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
        {format(value)}
      </span>
    </div>
  </div>
);

/**
 * What a day of practice has to be.
 *
 * Beside the XP rates rather than in Settings, and behind the same right, for
 * the same reason: this is not a preference about how the app looks, it is the
 * rule that decides whether a child's flame survives the weekend. Raising the
 * requirement can break a run that is already going, which is an owner's call.
 *
 * Every control here is read by `observeStreak` at render time, so a change
 * lands on the Home screen of every device in the family as soon as it syncs —
 * no recount, no migration of anybody's record.
 */
const StreakSection: React.FC = () => {
  useSyncExternalStore(StreakAPI.subscribe, StreakAPI.version);
  const config = StreakAPI.current();
  const set = (patch: Partial<StreakConfig>) => StreakAPI.update(patch);

  return (
    <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
      <UISectionHeader
        title={translate("admin.scoringPage.learningStreak")}
        subtitle={translate("admin.scoringPage.oneDayOfPracticeInAny")}
        icon={<Flame className="w-5 h-5 text-orange-500" />}
        action={
          StreakAPI.isEdited() ? (
            <button
              onClick={() => {
                StreakAPI.reset();
                playSound("pop");
              }}
              className={themeSystem.button("secondary", "sm")}
            >
              <RotateCcw />
              {translate("admin.scoringPage.reset")}
            </button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <div className="bg-surface-muted border border-line rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-ink font-mono">{translate("admin.scoringPage.countStreaks")}</h4>
            <p className="text-xs text-muted">
              {translate("admin.scoringPage.offHidesTheFlameEverywhereAnd")}
            </p>
          </div>
          <UIToggle
            checked={config.enabled}
            onChange={() => {
              playSound("pop");
              set({ enabled: !config.enabled });
            }}
            label={translate("admin.scoringPage.countStreaks")}
          />
        </div>

        {config.enabled && (
          <>
            <ScoringSlider
              label={translate("admin.scoringPage.roundsPerDay")}
              description={translate("admin.scoringPage.howManyFinishedRoundsMakeA")}
              value={config.roundsPerDay}
              min={1}
              max={10}
              step={1}
              format={(v) => `${v}`}
              onChange={(v) => set({ roundsPerDay: v })}
            />
            <ScoringSlider
              label={translate("admin.scoringPage.daysForgiven")}
              description={translate("admin.scoringPage.missedDaysARunSurvivesZero")}
              value={config.graceDays}
              min={0}
              max={6}
              step={1}
              format={(v) => `${v}`}
              onChange={(v) => set({ graceDays: v })}
            />
            <ScoringSlider
              label={translate("admin.scoringPage.dayStartsAt")}
              description={translate("admin.scoringPage.whenANewDayBeginsOn")}
              value={config.dayStartHour}
              min={0}
              max={23}
              step={1}
              format={(v) => (v === 0 ? "12am" : v < 12 ? `${v}am` : v === 12 ? "12pm" : `${v - 12}pm`)}
              onChange={(v) => set({ dayStartHour: v })}
            />
          </>
        )}
      </div>
    </section>
  );
};

/**
 * The reward economy, in one place.
 *
 * Every skill scores its rounds through the same function, and that function
 * reads these values — so tuning them here changes counting, addition and
 * anything installed later, with no skill edit and no rebuild. A skill that set
 * its own rates is the thing this replaces: XP is one number a learner carries
 * across every skill, so it cannot mean two things.
 *
 * Its own page, and its own right, because it is not the same act as the rest
 * of Settings. Changing the theme affects a screen; changing these numbers
 * re-prices every star a child has already earned, retroactively, for the whole
 * family. So it is the owner's by default — `scoring:write` rather than
 * `settings:write` — and a family that wants a second parent tuning it grants
 * that on the Roles page. The server checks the same right on the way in: a
 * hidden page is a hint, not a rule.
 */
export const ScoringPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  useSyncExternalStore(ScoringAPI.subscribe, ScoringAPI.version);
  const { can } = usePermissions();

  if (!can("system:write")) {
    return (
      <NoAccess
        title={translate("admin.scoringPage.scoringXp")}
        permission="system:write"
        what={translate("admin.scoringPage.whatAFinishedLevelPaysIs")}
      />
    );
  }

  const config = ScoringAPI.current();
  const set = (patch: Partial<ScoringConfig>) => ScoringAPI.update(patch);

  return (
    <div className={embedded ? "space-y-6" : "max-w-3xl mx-auto space-y-6"}>
      {!embedded && <div>
        <h2 className={themeSystem.typography("h2")}>{translate("admin.scoringPage.scoringAmpXp")}</h2>
        <p className={themeSystem.typography("body-sm", "mt-1")}>
          {translate("admin.scoringPage.whatAFinishedLevelIsWorth")}
        </p>
      </div>}

      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
        <UISectionHeader
          title={translate("admin.scoringPage.rewards")}
          subtitle={translate("admin.scoringPage.appliesToEverySkillInstalledOr")}
          icon={<Star className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          action={
            ScoringAPI.isEdited() ? (
              <button
                onClick={() => {
                  ScoringAPI.reset();
                  playSound("pop");
                }}
                className={themeSystem.button("secondary", "sm")}
              >
                <RotateCcw />
                {translate("admin.scoringPage.reset")}
              </button>
            ) : undefined
          }
        />

        <div className="space-y-3">
          <ScoringSlider
            label={translate("admin.scoringPage.twoStarShare")}
            description={translate("admin.scoringPage.howMuchOfALevelS")}
            value={config.twoStarShare}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set({ twoStarShare: v })}
          />
          <ScoringSlider
            label={translate("admin.scoringPage.oneStarShare")}
            description={translate("admin.scoringPage.sameForARoundBelowThe")}
            value={config.oneStarShare}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set({ oneStarShare: v })}
          />
          <ScoringSlider
            label={translate("admin.scoringPage.xpPerLevel")}
            description={translate("admin.scoringPage.whatOneFinishedLevelIsWorth")}
            value={config.xpPerLevel}
            min={0}
            max={200}
            step={5}
            format={(v) => `${v} XP`}
            onChange={(v) => set({ xpPerLevel: v })}
          />
          <ScoringSlider
            label={translate("admin.scoringPage.threeStarsAt")}
            description={translate("admin.scoringPage.firstTryAccuracyNeededForA")}
            value={config.threeStarAt}
            min={0.5}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set({ threeStarAt: v })}
          />
          <ScoringSlider
            label={translate("admin.scoringPage.twoStarsAt")}
            description={translate("admin.scoringPage.belowThisARoundEarnsOne")}
            value={config.twoStarAt}
            min={0}
            max={0.95}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set({ twoStarAt: v })}
          />
        </div>
      </section>

      <StreakSection />
    </div>
  );
};
