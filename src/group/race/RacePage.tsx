/**
 * Play a lesson together: open a race for one of this skill's lessons, or join one.
 *
 * Only signed-in Koda users race lessons — the round records what each child
 * learned, so it needs to know who they are. The seat is remembered for the
 * tab, so a refresh comes back to the same race.
 */

import React, { useState } from "react";
import { ArrowLeft, DoorOpen, LogIn } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { JoinForm } from "../../rebus/group/JoinForm";
import { SkillRoomsAPI } from "../skillRoomsApi";
import type { Seat, SkillRoomView } from "../types";
import { clearRaceFromUrl } from "./raceLink";
import { clearRaceSeat, loadRaceSeat, saveRaceSeat } from "./raceSeat";
import { RaceHostForm, type RaceLessonChoice } from "./RaceHostForm";
import { RaceRoom, type RaceRoomProps } from "./RaceRoom";

export interface RacePageProps {
  userToken: string;
  /** The skill a race can be opened for. Absent when arriving by an invitation link: joining only. */
  host?: { skillId: string; skillName: string; lessons: readonly RaceLessonChoice[]; suggested?: string };
  initialCode?: string | null;
  renderRound: RaceRoomProps["renderRound"];
  onExit(): void;
  /** A Rebus Rush code was typed into the race's door: the host takes the player there. */
  onRebusRoom?(code: string): void;
}

type View = "choose" | "host" | "join" | "room";

export const RacePage: React.FC<RacePageProps> = ({ userToken, host, initialCode = null, renderRound, onExit, onRebusRoom }) => {
  const { t } = useT();
  const stored = initialCode ? null : loadRaceSeat();
  const [seat, setSeat] = useState<{ code: string; token: string; initial: SkillRoomView | null } | null>(stored ? { ...stored, initial: null } : null);
  const [view, setView] = useState<View>(stored ? "room" : initialCode || !host ? "join" : "choose");

  const sit = (s: Seat<SkillRoomView>) => {
    saveRaceSeat({ code: s.room.code, token: s.playerToken });
    clearRaceFromUrl();
    setSeat({ code: s.room.code, token: s.playerToken, initial: s.room });
    setView("room");
  };

  const leftRoom = () => {
    clearRaceSeat();
    setSeat(null);
    if (host) setView("choose");
    else onExit();
  };

  if (view === "room" && seat) return <RaceRoom code={seat.code} token={seat.token} initial={seat.initial} renderRound={renderRound} onLeft={leftRoom} />;

  const back = view === "choose" || !host ? onExit : () => setView("choose");
  const card = themeSystem.card("interactive", `${themeSystem.spacing.card} flex min-h-11 flex-col items-start gap-2 text-left`);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-20">
      <div>
        <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={back}>
          {t("rebus.back")}
        </UIButton>
      </div>
      <div>
        <h2 className={themeSystem.typography("h2")}>{host ? t("race.titleFor", { skill: host.skillName }) : t("race.title")}</h2>
        <p className={themeSystem.typography("subtitle")}>{t("race.subtitle")}</p>
      </div>

      {view === "choose" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => setView("host")} className={card}>
            <DoorOpen className="h-7 w-7 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span className={themeSystem.typography("h3")}>{t("rebus.group.openRoom")}</span>
            <span className={themeSystem.typography("body-sm")}>{t("race.openText")}</span>
          </button>
          <button type="button" onClick={() => setView("join")} className={card}>
            <LogIn className="h-7 w-7 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span className={themeSystem.typography("h3")}>{t("rebus.group.joinRoom")}</span>
            <span className={themeSystem.typography("body-sm")}>{t("rebus.group.joinText")}</span>
          </button>
        </div>
      )}

      {view === "host" && host && <RaceHostForm userToken={userToken} skillId={host.skillId} lessons={host.lessons} suggested={host.suggested} onOpened={sit} />}
      {view === "join" && <JoinForm initialCode={initialCode} userToken={userToken} join={SkillRoomsAPI.join} onJoined={(s) => sit(s as Seat<SkillRoomView>)} onWrongGame={onRebusRoom && ((game, code) => game === "rebus" && onRebusRoom(code))} />}
    </div>
  );
};
