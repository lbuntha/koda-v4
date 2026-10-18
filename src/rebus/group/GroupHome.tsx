/**
 * Play with friends: open a room or join one.
 *
 * Works for a signed-in Koda user (can open or join, and is recorded as
 * themselves) and for a guest with no account (can only join, with a preset
 * nickname). The seat is remembered for the tab, so a refresh comes back to the
 * same room.
 */

import React, { useState } from "react";
import { ArrowLeft, DoorOpen, LogIn } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import type { RebusSettings } from "../settings";
import { GroupRoom } from "./GroupRoom";
import { HostForm } from "./HostForm";
import { JoinForm } from "./JoinForm";
import { clearRoomFromUrl } from "./roomLink";
import { loadSeat, saveSeat, clearSeat } from "./seatStore";
import type { Seat } from "./types";

export interface GroupHomeProps {
  /** The signed-in Koda user's token, or null for a guest. */
  userToken: string | null;
  settings: RebusSettings;
  counts?: Readonly<Record<string, number>>;
  /** A code from an invitation link: goes straight to joining it. */
  initialCode?: string | null;
  /** Back out of group play. */
  onExit(): void;
  /** A guest who has an account: go to sign in (the link is kept so they come back to the room). */
  onSignIn?(): void;
}

type View = "choose" | "host" | "join" | "room";

export const GroupHome: React.FC<GroupHomeProps> = ({ userToken, settings, counts, initialCode = null, onExit, onSignIn }) => {
  const { t } = useT();
  const stored = initialCode ? null : loadSeat();
  const [seat, setSeat] = useState<{ code: string; token: string; initial: Seat["room"] | null } | null>(stored ? { ...stored, initial: null } : null);
  const [view, setView] = useState<View>(stored ? "room" : initialCode ? "join" : "choose");

  const sit = (s: Seat) => {
    saveSeat({ code: s.room.code, token: s.playerToken });
    clearRoomFromUrl();
    setSeat({ code: s.room.code, token: s.playerToken, initial: s.room });
    setView("room");
  };

  const leftRoom = () => {
    clearSeat();
    setSeat(null);
    setView("choose");
  };

  if (view === "room" && seat) return <GroupRoom code={seat.code} token={seat.token} initial={seat.initial} onLeft={leftRoom} />;

  const back = view === "choose" ? onExit : () => setView("choose");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-20">
      <div>
        <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={back}>
          {t("rebus.back")}
        </UIButton>
      </div>
      <div>
        <h2 className={themeSystem.typography("h2")}>{t("rebus.group.title")}</h2>
        <p className={themeSystem.typography("subtitle")}>{t("rebus.group.subtitle")}</p>
      </div>

      {view === "choose" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {userToken && (
            <button type="button" onClick={() => setView("host")} className={themeSystem.card("interactive", `${themeSystem.spacing.card} flex min-h-11 flex-col items-start gap-2 text-left`)}>
              <DoorOpen className="h-7 w-7 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              <span className={themeSystem.typography("h3")}>{t("rebus.group.openRoom")}</span>
              <span className={themeSystem.typography("body-sm")}>{t("rebus.group.openText")}</span>
            </button>
          )}
          <button type="button" onClick={() => setView("join")} className={themeSystem.card("interactive", `${themeSystem.spacing.card} flex min-h-11 flex-col items-start gap-2 text-left`)}>
            <LogIn className="h-7 w-7 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
            <span className={themeSystem.typography("h3")}>{t("rebus.group.joinRoom")}</span>
            <span className={themeSystem.typography("body-sm")}>{t("rebus.group.joinText")}</span>
          </button>
          {!userToken && onSignIn && (
            <UIButton variant="secondary" className="sm:col-span-2" onClick={onSignIn}>
              {t("rebus.group.haveAccount")}
            </UIButton>
          )}
        </div>
      )}

      {view === "host" && userToken && <HostForm userToken={userToken} settings={settings} counts={counts} onOpened={sit} />}
      {view === "join" && <JoinForm initialCode={initialCode} userToken={userToken} onJoined={sit} />}
    </div>
  );
};
