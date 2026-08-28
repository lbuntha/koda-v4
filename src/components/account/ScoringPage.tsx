import React, { useSyncExternalStore } from "react";
import { Flame, RotateCcw, Star } from "lucide-react";

import { usePermissions } from "../../lib/sync";
import { ScoringAPI, type ScoringConfig } from "../../lib/scoring";
import { StreakAPI, type StreakConfig } from "../../lib/streak";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { UISectionHeader, UIToggle } from "../ui";
import { NoAccess } from "./NoAccess";

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
        title="Learning streak"
        subtitle="One day of practice, in any skill, is one day of streak"
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
              Reset
            </button>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <div className="bg-surface-muted border border-line rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-ink font-mono">Count streaks</h4>
            <p className="text-xs text-muted">
              Off hides the flame everywhere and stops days being counted. Nothing already earned is
              erased — switching it back on picks the run up where it left off.
            </p>
          </div>
          <UIToggle
            checked={config.enabled}
            onChange={() => {
              playSound("pop");
              set({ enabled: !config.enabled });
            }}
            label="Count streaks"
          />
        </div>

        {config.enabled && (
          <>
            <ScoringSlider
              label="Rounds per day"
              description="How many finished rounds make a day count. One means showing up is enough."
              value={config.roundsPerDay}
              min={1}
              max={10}
              step={1}
              format={(v) => `${v}`}
              onChange={(v) => set({ roundsPerDay: v })}
            />
            <ScoringSlider
              label="Days forgiven"
              description="Missed days a run survives. Zero means practise every day or start again."
              value={config.graceDays}
              min={0}
              max={6}
              step={1}
              format={(v) => `${v}`}
              onChange={(v) => set({ graceDays: v })}
            />
            <ScoringSlider
              label="Day starts at"
              description="When a new day begins on the device. Later than midnight keeps a late-night session on the day it belongs to."
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
        title="Scoring & XP"
        permission="system:write"
        what="What a finished level pays is set once for every family on this Koda."
      />
    );
  }

  const config = ScoringAPI.current();
  const set = (patch: Partial<ScoringConfig>) => ScoringAPI.update(patch);

  return (
    <div className={embedded ? "space-y-6" : "max-w-3xl mx-auto space-y-6"}>
      {!embedded && <div>
        <h2 className={themeSystem.typography("h2")}>Scoring &amp; XP</h2>
        <p className={themeSystem.typography("body-sm", "mt-1")}>
          What a finished level is worth, and what a day of practice has to be to keep a streak. One
          economy, shared by every skill and every child in the family — changing it re-prices stars
          already earned.
        </p>
      </div>}

      <section className={themeSystem.card("default", `${themeSystem.spacing.card} space-y-4`)}>
        <UISectionHeader
          title="Rewards"
          subtitle="Applies to every skill, installed or not yet written"
          icon={<Star className="w-5 h-5 text-amber-500" />}
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
                Reset
              </button>
            ) : undefined
          }
        />

        <div className="space-y-3">
          <ScoringSlider
            label="Two-star share"
            description="How much of a level's XP a two-star round pays."
            value={config.twoStarShare}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set({ twoStarShare: v })}
          />
          <ScoringSlider
            label="One-star share"
            description="Same, for a round below the two-star line."
            value={config.oneStarShare}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set({ oneStarShare: v })}
          />
          <ScoringSlider
            label="XP per level"
            description="What one finished level is worth at three stars. The only place XP is set."
            value={config.xpPerLevel}
            min={0}
            max={200}
            step={5}
            format={(v) => `${v} XP`}
            onChange={(v) => set({ xpPerLevel: v })}
          />
          <ScoringSlider
            label="Three stars at"
            description="First-try accuracy needed for a perfect round."
            value={config.threeStarAt}
            min={0.5}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={(v) => set({ threeStarAt: v })}
          />
          <ScoringSlider
            label="Two stars at"
            description="Below this, a round earns one star."
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
