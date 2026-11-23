/** Open a race: which lesson, and who to be. Needs a signed-in Koda user. */

import React, { useState } from "react";
import { DoorOpen } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { NicknamePicker } from "../../rebus/group/NicknamePicker";
import { raceErrorKey } from "./raceErrors";
import { SkillRoomsAPI } from "../skillRoomsApi";
import type { Seat, SkillRoomView } from "../types";

export interface RaceLessonChoice {
  id: string;
  title: string;
  /** Questions in one round. */
  count?: number;
}

export interface RaceHostFormProps {
  userToken: string;
  skillId: string;
  lessons: readonly RaceLessonChoice[];
  /** Picked to start with: the child's own next lesson, which friends of the same age can usually play too. */
  suggested?: string;
  onOpened(seat: Seat<SkillRoomView>): void;
}

export const RaceHostForm: React.FC<RaceHostFormProps> = ({ userToken, skillId, lessons, suggested, onOpened }) => {
  const { t, language } = useT();
  const [lesson, setLesson] = useState(suggested && lessons.some((l) => l.id === suggested) ? suggested : lessons[0]?.id ?? "");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const open = async () => {
    setBusy(true);
    setError("");
    try {
      onOpened(await SkillRoomsAPI.open({ skill: skillId, lesson, name, avatar, language: language === "km" ? "km" : "en" }, userToken));
    } catch (e) {
      setError(t(raceErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className={themeSystem.spacing.stack}>
        <h3 className={themeSystem.typography("h4")}>{t("race.pickLesson")}</h3>
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1" role="group" aria-label={t("race.pickLesson")}>
          {lessons.map((l, i) => (
            <li key={l.id}>
              <button
                type="button"
                aria-pressed={lesson === l.id}
                onClick={() => setLesson(l.id)}
                className={themeSystem.card(
                  "interactive",
                  `flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left ${lesson === l.id ? "!border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800" : ""}`,
                )}
              >
                <span className="w-7 shrink-0 text-center text-sm font-black text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-black text-ink">{l.title}</span>
                {l.id === suggested && <span className="shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-400">{t("race.yourNext")}</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <NicknamePicker name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} />
      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      <UIButton size="lg" fullWidth icon={<DoorOpen />} isLoading={busy} disabled={busy || !lesson || !name || !avatar} onClick={() => void open()}>
        {t("rebus.group.openRoom")}
      </UIButton>
    </div>
  );
};
