import React from "react";
import { Clock, Flag, Flame, GraduationCap, Moon, Sparkles } from "lucide-react";

import type {
  AllowedHours,
  ChildSettings,
  GoalCadence,
  StartingPoint,
} from "../../lib/childSettings";
import { hourLabel } from "../../lib/sessionTime";
import { getCourseUnits, startingPointForAge } from "../../curriculum";
import { themeSystem } from "../../lib/themeSystem";
import { playSound } from "../../utils/audio";
import { usePersonaRoster } from "../../lib/usePersona";
import { PersonaPicker } from "./PersonaPicker";
import { UIToggle } from "../ui";
import { translate, useT } from "../../lib/i18n";

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

/* Worded under `childSettings.cadence.<id>.*`. */
const CADENCE_CHOICES: { id: GoalCadence }[] = [{ id: "daily" }, { id: "weekly" }];

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

/** The window a parent starts from when they first switch hours on. */
const DEFAULT_HOURS: AllowedHours = { from: 7, to: 20 };

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * Every hour but one.
 *
 * The one is the other end of the window. `clampHours` refuses `from === to` and
 * returns `null` for it, so a parent who picked "7 AM until 7 AM" would not get
 * a zero-length window — they would get the whole setting switched back off on
 * save, with nothing saying why. Cheaper to make it unpickable.
 */
const hoursExcept = (taken: number): number[] => HOURS.filter((hour) => hour !== taken);

/**
 * What the window a parent has picked will actually mean, in a sentence.
 *
 * Two independent dropdowns can express a window that wraps midnight, and a
 * parent who set "8 PM" and "7 AM" meaning bedtime has in fact opened the night.
 * Rather than forbid it — some households do play in the evening — the screen
 * reads the setting back, so a wrapped window is something a parent sees here
 * instead of something a child discovers.
 */
const hoursSummary = (hours: AllowedHours, who: string): string => {
  const from = hourLabel(hours.from);
  const to = hourLabel(hours.to);
  return translate(hours.from < hours.to ? "childSettings.hours.window" : "childSettings.hours.overnight", {
    who,
    from,
    to,
  });
};

export interface ChildSettingsFieldsProps {
  value: ChildSettings;
  onChange(patch: Partial<ChildSettings>): void;
  /** Used in the hints, so a parent reads the rule about a person. */
  childName?: string;
  /**
   * Who is reading. `parent` speaks about the child ("Skip lessons they already
   * know"); `self` speaks to the learner setting their own ("You start at
   * lesson one"), which is what a student with nobody above them sees.
   *
   * A flag rather than a second copy of these controls: the settings are the
   * same document either way, and two components would drift the moment one
   * gained a field.
   */
  voice?: "parent" | "self";
  /** Whether the family's plan covers Koda's help at all. */
  planHasAi?: boolean;
  /**
   * The child's age, for the age-band placement that is now the default.
   *
   * `null` when nobody entered a birth year — in which case "by age" has nothing
   * to go on and the option says so rather than quietly behaving like "from the
   * start".
   */
  childAge?: number | null;
}

/**
 * Where a child may be started, as units rather than level numbers.
 *
 * A parent knows "she can already count to twenty"; nobody knows what level 8
 * is. Choosing a unit sets the starting point to the level *before* its first
 * lesson, so the unit a parent picks is the one the child opens on.
 *
 * The label is the unit's own title, which already carries its number
 * ("Unit 3: Quantity Comparison & Number Line"). The bare `Unit 3` this replaced
 * asked a parent to know the syllabus by heart — and with a hundred and seven
 * units, a row of numbered buttons was a wall no parent could read.
 */
interface StartChoice {
  id: string;
  label: string;
  value: StartingPoint;
}

const startChoices = (age: number | null): StartChoice[] => {
  const units = getCourseUnits();
  const pinned = units.slice(1).map((unit) => ({
    id: unit.id,
    label: unit.title,
    value: (unit.lessons[0]?.levelNumber ?? 1) - 1 as StartingPoint,
  }));

  // What "by age" will actually do, named in the option itself. A default that
  // does something invisible is a default a parent cannot check.
  const byAge = age === null ? null : startingPointForAge(age);
  const landsOn =
    byAge === null
      ? units[0]
      : [...units].reverse().find((unit) => (unit.lessons[0]?.levelNumber ?? 1) - 1 <= byAge) ??
        units[0];

  return [
    {
      id: "age",
      label:
        age === null
          ? translate("childSettings.start.byAgeNeedsYear")
          : translate("childSettings.start.byAge", { unit: landsOn?.title ?? translate("childSettings.start.theStart") }),
      value: "age",
    },
    { id: "start", label: translate("childSettings.start.fromStart"), value: null },
    ...pinned,
  ];
};

/** Which option a stored setting corresponds to. */
const chosen = (starts: StartChoice[], value: StartingPoint): StartChoice => {
  if (value === "age") return starts[0];
  if (value === null) return starts[1];
  return (
    [...starts]
      .reverse()
      .find((choice) => typeof choice.value === "number" && choice.value <= value) ?? starts[1]
  );
};

export const ChildSettingsFields: React.FC<ChildSettingsFieldsProps> = ({
  value,
  onChange,
  childName,
  planHasAi = true,
  childAge = null,
  voice = "parent",
}) => {
  const { t, language } = useT();
  const self = voice === "self";
  const v = self ? "self" : "parent";
  const who = self ? t("childSettings.you") : childName?.trim() || t("children.thisChild");
  // Only to know whether there is a choice to offer at all; the picker itself
  // resolves the chosen one.
  const roster = usePersonaRoster();
  // `language`: the option labels are words.
  const starts = React.useMemo(() => startChoices(childAge), [childAge, language]);
  const start = chosen(starts, value.startingPoint);

  return (
    <div className="space-y-3">
      <Row
        stacked
        icon={<Clock className="h-5 w-5" />}
        tint="text-indigo-500"
        title={t("childSettings.playTime.title")}
        hint={t("childSettings.playTime.hint")}
      >
        <Choices
          ariaLabel={t("childSettings.playTime.aria")}
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
          labelOf={(minutes) => (minutes === null ? t("childSettings.playTime.noLimit") : t("childSettings.playTime.minutes", { count: minutes }))}
          onSelect={(sessionMinutes) => onChange({ sessionMinutes })}
        />
        {value.sessionMinutes !== null && (
          <p className="text-xs text-muted">
            {t("childSettings.playTime.finish")}
          </p>
        )}
      </Row>

      {/*
        * When, as against how long. Directly under the cap because a parent
        * reading one is usually deciding the other, and the two together are the
        * whole of "how much Koda".
        */}
      <Row
        stacked
        icon={<Moon className="h-5 w-5" />}
        tint="text-purple-500"
        title={t("childSettings.hours.title")}
        hint={t("childSettings.hours.hint")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <UIToggle
            checked={value.allowedHours !== null}
            onChange={() => {
              playSound("pop");
              onChange({ allowedHours: value.allowedHours ? null : DEFAULT_HOURS });
            }}
            label={t("childSettings.hours.limit")}
          />
          {value.allowedHours && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs text-muted">
                {t("childSettings.hours.from")}
                <select
                  aria-label={t("childSettings.hours.opensAt")}
                  className={themeSystem.field("sm")}
                  value={value.allowedHours.from}
                  onChange={(event) =>
                    onChange({
                      allowedHours: {
                        ...(value.allowedHours ?? DEFAULT_HOURS),
                        from: Number(event.target.value),
                      },
                    })
                  }
                >
                  {hoursExcept(value.allowedHours.to).map((hour) => (
                    <option key={hour} value={hour}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                {t("childSettings.hours.until")}
                <select
                  aria-label={t("childSettings.hours.shutsAt")}
                  className={themeSystem.field("sm")}
                  value={value.allowedHours.to}
                  onChange={(event) =>
                    onChange({
                      allowedHours: {
                        ...(value.allowedHours ?? DEFAULT_HOURS),
                        to: Number(event.target.value),
                      },
                    })
                  }
                >
                  {hoursExcept(value.allowedHours.from).map((hour) => (
                    <option key={hour} value={hour}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        <p className="text-xs text-muted">
          {value.allowedHours
            ? hoursSummary(value.allowedHours, self ? "Koda" : who)
            : t("childSettings.hours.allDay")}
        </p>
      </Row>

      <Row
        stacked
        icon={<Flag className="h-5 w-5" />}
        tint="text-emerald-500"
        title={t("childSettings.start.title")}
        hint={t(`childSettings.start.hint.${v}`)}
      >
        {/*
          * A dropdown, not the row of buttons the other settings use: the course
          * is a hundred and seven units long, and `Choices` drew every one of
          * them. Four caps wrap into a tidy row; a hundred and six units are a
          * wall. The same reason the label is now the unit's title — a parent
          * picking a starting point needs to recognise the work, not count.
          */}
        <select
          aria-label={t(`childSettings.start.aria.${v}`)}
          className={themeSystem.field("sm", "w-full")}
          value={start.id}
          onChange={(event) => {
            const choice = starts.find((option) => option.id === event.target.value);
            if (choice) onChange({ startingPoint: choice.value });
          }}
        >
          {starts.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {choice.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted">
          {t(
            `childSettings.start.note.${
              value.startingPoint === "age"
                ? childAge === null
                  ? "addYear"
                  : "byAge"
                : value.startingPoint === null
                  ? "lessonOne"
                  : "thisLesson"
            }.${v}`,
            { who },
          )}
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
          title={t("childSettings.teacher.title")}
          hint={t(`childSettings.teacher.hint.${v}`)}
        >
          <PersonaPicker
            value={value.personaId}
            onChange={(personaId) => onChange({ personaId })}
            ariaLabel={t(`childSettings.teacher.aria.${v}`, { who })}
          />
        </Row>
      )}

      <Row
        icon={<Sparkles className="h-5 w-5" />}
        tint="text-amber-500"
        title={t("childSettings.help.title")}
        hint={planHasAi ? t("childSettings.help.hint") : t("childSettings.help.notInPlan")}
      >
        <UIToggle
          checked={value.aiHelpEnabled}
          onChange={() => {
            // The pop moved here with the switch: it was the local copy's, and
            // a shared control must not make a sound on pages that never did.
            playSound("pop");
            onChange({ aiHelpEnabled: !value.aiHelpEnabled });
          }}
          label={t("childSettings.help.title")}
        />
      </Row>

      <Row
        stacked
        icon={<Flame className="h-5 w-5" />}
        tint="text-orange-500"
        title={t("praise.streak.tag")}
        hint={t("childSettings.cadence.hint")}
      >
        <Choices
          ariaLabel={t("childSettings.cadence.aria")}
          options={CADENCE_CHOICES}
          value={CADENCE_CHOICES.find((c) => c.id === value.goalCadence) ?? CADENCE_CHOICES[0]}
          keyOf={(choice) => choice.id}
          labelOf={(choice) => t(`childSettings.cadence.${choice.id}.label`)}
          onSelect={(choice) => onChange({ goalCadence: choice.id })}
        />
        <p className="text-xs text-muted">
          {t(`childSettings.cadence.${(CADENCE_CHOICES.find((c) => c.id === value.goalCadence) ?? CADENCE_CHOICES[0]).id}.detail`)}
        </p>
        {/*
          * Said here because the two controls sit together and both involve a
          * day: changing the flame's unit does not touch the goal, and a parent
          * who assumes otherwise would set one meaning to get the other.
          */}
        <p className="text-xs text-muted">
          {t("childSettings.cadence.goalNote")}
        </p>
      </Row>
    </div>
  );
};
