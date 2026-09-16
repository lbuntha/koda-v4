import React, { useState, useSyncExternalStore } from "react";

import { ChildSettingsAPI } from "../../lib/childSettings";
import { DailyGoalAPI } from "../../lib/dailyGoal";
import { useBilling } from "../../lib/useBilling";
import { ageFromBirthYear } from "../../skills/viewer";
import { SessionAPI, accessToken, request, useSession } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { ChildSettingsFields } from "./ChildSettingsFields";
import { DailyGoalField } from "./DailyGoalField";

/**
 * A learner's own settings, for the learner.
 *
 * The same controls a parent sets on the Children page, writing the same two
 * documents — the goal and `childSettings` — because a student *is* their own
 * learner. One source of truth, not a second per-account copy that would then
 * disagree with the parent-facing screen about the same person.
 *
 * Only a student reaches it. The gate is `learner:update`, the right the server
 * checks when these save: a child on a parent-managed tablet does not hold it,
 * so nothing here appears for them and their settings stay their parent's.
 *
 * **The limits are here too, and they are self-imposed.** A daily cap somebody
 * can lift in two taps is a reminder rather than a rule, and saying so is
 * better than pretending: a student has no grown-up account above them, so the
 * alternative is not a stricter limit, it is no limit at all.
 *
 * Every control saves as it moves, like the rest of Settings. The Children page
 * keeps a draft behind "Save changes" because a parent is editing somebody
 * else and may think better of it; nobody needs protecting from their own
 * preference.
 */
export const YourLearning: React.FC<{ learnerId: string }> = ({ learnerId }) => {
  useSyncExternalStore(ChildSettingsAPI.subscribe, ChildSettingsAPI.version);
  useSyncExternalStore(DailyGoalAPI.subscribe, DailyGoalAPI.version);
  const session = useSession();
  const plan = useBilling();
  const l = themeSystem.list;

  const settings = ChildSettingsAPI.for(learnerId);
  const goal = DailyGoalAPI.for(learnerId);

  const [name, setName] = useState(session?.learnerName ?? "");
  const [birthYear, setBirthYear] = useState(
    session?.learnerBirthYear ? String(session.learnerBirthYear) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const year = Number(birthYear);
  const age = Number.isFinite(year) && year > 1900 ? ageFromBirthYear(year) : null;

  /**
   * Name and birth year live on the learner row rather than in a synced
   * document, so they are saved by a request — on blur, not per keystroke,
   * because a name is typed a letter at a time and each letter is not a save.
   */
  const saveProfile = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(session?.learnerName ?? "");
      return;
    }
    setError(null);
    try {
      await request(`/learners/${learnerId}`, {
        method: "PATCH",
        token: await accessToken(),
        body: { displayName: trimmed, birthYear: age === null ? null : year },
      });
      // So the rest of the app — the greeting, the report, the notifications —
      // says the new name without a reload.
      await SessionAPI.verify();
    } catch {
      setError("That could not be saved. Try again in a moment.");
    }
  };

  return (
    <section className="space-y-3">
      <div>
        <div className={l.groupLabel}>Your learning</div>
        <p className="text-xs text-muted">
          Yours to set. Nobody else manages this account, so the limits below are the ones you
          choose for yourself.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-ink">Your name</span>
          <input
            className={themeSystem.field("lg")}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void saveProfile()}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-ink">
            Birth year <span className="font-normal text-muted">(optional)</span>
          </span>
          <input
            className={themeSystem.field("lg")}
            type="number"
            inputMode="numeric"
            value={birthYear}
            placeholder="2014"
            onChange={(event) => setBirthYear(event.target.value)}
            onBlur={() => void saveProfile()}
          />
        </label>
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <DailyGoalField
        value={goal}
        onChange={(next) => DailyGoalAPI.set(learnerId, next)}
        hint="Rounds you aim to finish each day"
      />

      <ChildSettingsFields
        voice="self"
        value={settings}
        onChange={(patch) => ChildSettingsAPI.set(learnerId, patch)}
        childName={name}
        planHasAi={plan.ai}
        childAge={age}
      />
    </section>
  );
};
