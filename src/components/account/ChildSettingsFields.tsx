import React from "react";
import { Clock, Flag, Flame, GraduationCap, Sparkles } from "lucide-react";

import type { ChildSettings, GoalCadence } from "../../lib/childSettings";
import { getCourseUnits } from "../../curriculum";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { usePersonaRoster } from "../../lib/usePersona";
import { PersonaPicker } from "./PersonaPicker";
import { UIToggle } from "../ui";

/**
 * How Koda behaves for one child, as controls a parent can set in a glance.
 *
 * Owns no state, for the reason `DailyGoalField` gives: the same three settings
 * are edited by a parent on somebody else's behalf and — once a student can
 * reach them — by a learner on their own, so whoever draws them decides where
 * the draft is kept and when it is written.
 *
 * The wording throughout is aimed at the grown-up, and every control says what
 * the child will experience rather than what the field is called. "No limit" is
 * a state a parent chooses, not an absence.
 */

/** The caps a parent actually picks. The store still accepts anything sane. */
const CAP_CHOICES: (number | null)[] = [null, 15, 20, 30, 45, 60];

const CADENCE_CHOICES: { id: GoalCadence; label: string; detail: (who: string) => string }[] = [
  {
    id: "daily",
    label: "Days",
    detail: (who) =>
      `${who}'s flame grows on a day practised, and breaks on a day missed.`,
  },
  {
    id: "weekly",
    label: "Weeks",
    detail: (who) =>
      `${who}'s flame grows on a week practised, so a busy day costs nothing. Best for a child who does not choose when they get the tablet.`,
  },
];

/** One labelled control in the same shell `DailyGoalField` uses. */
const Row: React.FC<{
  icon: React.ReactNode;
  tint: string;
  title: string;
  hint: string;
  children: React.ReactNode;
  /** Put the control under the label rather than beside it, when it is wide. */
  stacked?: boolean;
}> = ({ icon, tint, title, hint, children, stacked = false }) => (
  <div
    className={`rounded-2xl border border-line bg-surface-muted p-4 ${
      stacked ? "space-y-3" : "flex items-center justify-between gap-4"
    }`}
  >
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface ${tint}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h4 className="font-mono text-sm font-bold text-ink">{title}</h4>
        <p className="text-xs text-muted">{hint}</p>
      </div>
    </div>
    {stacked ? <div>{children}</div> : <div className="shrink-0">{children}</div>}
  </div>
);

/** A row of mutually exclusive choices. Wraps rather than scrolls on a phone. */
const Choices = <T,>({
  options,
  value,
  onSelect,
  labelOf,
  keyOf,
  ariaLabel,
}: {
  options: T[];
  value: T;
  onSelect(next: T): void;
  labelOf(option: T): string;
  keyOf(option: T): string;
  ariaLabel: string;
}) => (
  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ariaLabel}>
    {options.map((option) => {
      const selected = keyOf(option) === keyOf(value);
      return (
        <button
          key={keyOf(option)}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => {
            if (selected) return;
            playSound("pop");
            onSelect(option);
          }}
          className={themeSystem.button(selected ? "primary" : "secondary", "sm")}
        >
          {labelOf(option)}
        </button>
      );
    })}
  </div>
);

export interface ChildSettingsFieldsProps {
  value: ChildSettings;
  onChange(patch: Partial<ChildSettings>): void;
  /** Used in the hints, so a parent reads the rule about a person. */
  childName?: string;
  /** Whether the family's plan covers Koda's help at all. */
  planHasAi?: boolean;
}

/**
 * Where a child may be started, as units rather than level numbers.
 *
 * A parent knows "she can already count to twenty"; nobody knows what level 8
 * is. Choosing a unit sets the starting point to the level *before* its first
 * lesson, so the unit a parent picks is the one the child opens on.
 */
const startChoices = (): { id: string; label: string; level: number | null }[] => {
  const units = getCourseUnits();
  return [
    { id: "start", label: "From the start", level: null },
    ...units.slice(1).map((unit) => ({
      id: unit.id,
      label: `Unit ${unit.unitNumber}`,
      level: (unit.lessons[0]?.levelNumber ?? 1) - 1,
    })),
  ];
};

export const ChildSettingsFields: React.FC<ChildSettingsFieldsProps> = ({
  value,
  onChange,
  childName,
  planHasAi = true,
}) => {
  const who = childName?.trim() || "this child";
  // Only to know whether there is a choice to offer at all; the picker itself
  // resolves the chosen one.
  const roster = usePersonaRoster();
  const starts = React.useMemo(startChoices, []);
  const start =
    [...starts].reverse().find((c) => c.level !== null && value.startingPoint !== null && c.level <= value.startingPoint) ??
    starts[0];

  return (
    <div className="space-y-3">
      <Row
        stacked
        icon={<Clock className="h-5 w-5" />}
        tint="text-indigo-500"
        title="Time each day"
        hint={`How long ${who} can play before Koda stops for the day`}
      >
        <Choices
          ariaLabel="Daily time limit"
          /* A cap that is not one of the presets — set on another device, or
             from an older document — joins the row rather than leaving nothing
             selected, so opening this screen cannot silently change it. */
          options={
            CAP_CHOICES.includes(value.sessionMinutes)
              ? CAP_CHOICES
              : [...CAP_CHOICES, value.sessionMinutes].sort(
                  (a, b) => (a ?? -1) - (b ?? -1),
                )
          }
          value={value.sessionMinutes}
          keyOf={(minutes) => String(minutes)}
          labelOf={(minutes) => (minutes === null ? "No limit" : `${minutes} min`)}
          onSelect={(sessionMinutes) => onChange({ sessionMinutes })}
        />
        {value.sessionMinutes !== null && (
          <p className="text-xs text-muted">
            A round already started is always finished, so a day can run a little over.
          </p>
        )}
      </Row>

      <Row
        stacked
        icon={<Flag className="h-5 w-5" />}
        tint="text-emerald-500"
        title="Starting point"
        hint={`Where ${who} begins, if they already know the earlier work`}
      >
        <Choices
          ariaLabel="Where this child starts"
          options={starts}
          value={start}
          keyOf={(choice) => choice.id}
          labelOf={(choice) => choice.label}
          onSelect={(choice) => onChange({ startingPoint: choice.level })}
        />
        <p className="text-xs text-muted">
          {start.level === null
            ? "Everything from the first lesson onwards."
            : `Earlier units stay open, and still count as unpractised — ${who} can go back to them any time.`}
        </p>
      </Row>

      {/* Which teacher. The picker draws nothing when a deployment runs a
          single character, so the Row goes with it. Below Koda's help rather
          than above, because switching Koda off makes the question moot. */}
      {roster.length > 1 && (
        <Row
          stacked
          icon={<GraduationCap className="h-5 w-5" />}
          tint="text-indigo-500"
          title="Who teaches"
          hint={`The teacher ${who} talks to. Each one explains things differently`}
        >
          <PersonaPicker
            value={value.personaId}
            onChange={(personaId) => onChange({ personaId })}
            ariaLabel={`Who teaches ${who}`}
          />
        </Row>
      )}

      <Row
        icon={<Sparkles className="h-5 w-5" />}
        tint="text-amber-500"
        title="Koda's help"
        hint={
          planHasAi
            ? `Whether ${who} can ask Koda for hints and spoken guidance`
            : "Not included on your plan yet — this is what will apply when it is"
        }
      >
        <UIToggle
          checked={value.aiHelpEnabled}
          onChange={() => {
            // The pop moved here with the switch: it was the local copy's, and
            // a shared control must not make a sound on pages that never did.
            playSound("pop");
            onChange({ aiHelpEnabled: !value.aiHelpEnabled });
          }}
          label="Koda's help"
        />
      </Row>

      <Row
        stacked
        icon={<Flame className="h-5 w-5" />}
        tint="text-orange-500"
        title="Streak"
        hint={`Whether ${who}'s flame counts days or weeks`}
      >
        <Choices
          ariaLabel="Whether the streak counts days or weeks"
          options={CADENCE_CHOICES}
          value={CADENCE_CHOICES.find((c) => c.id === value.goalCadence) ?? CADENCE_CHOICES[0]}
          keyOf={(choice) => choice.id}
          labelOf={(choice) => choice.label}
          onSelect={(choice) => onChange({ goalCadence: choice.id })}
        />
        <p className="text-xs text-muted">
          {(CADENCE_CHOICES.find((c) => c.id === value.goalCadence) ?? CADENCE_CHOICES[0]).detail(
            who,
          )}
        </p>
        {/*
          * Said here because the two controls sit together and both involve a
          * day: changing the flame's unit does not touch the goal, and a parent
          * who assumes otherwise would set one meaning to get the other.
          */}
        <p className="text-xs text-muted">
          The daily goal is separate — it always counts rounds in a single day.
        </p>
      </Row>
    </div>
  );
};
