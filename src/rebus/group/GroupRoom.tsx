/**
 * One seat in one room, from the lobby on.
 *
 * Owns the polling and every action a seat can take, and draws whichever
 * screen the room is on: the lobby, a puzzle, or the results.
 */

import React, { useEffect, useRef, useState } from "react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { roomErrorKey } from "./errors";
import { GroupAPI } from "./groupApi";
import { GroupFinal } from "./GroupFinal";
import { GroupPlay } from "./GroupPlay";
import { Lobby } from "./Lobby";
import { clearSeat } from "./seatStore";
import type { RoomView } from "./types";
import { useRoom } from "./useRoom";

export interface GroupRoomProps {
  code: string;
  token: string;
  /** The room as the join or open call returned it, so the lobby is on screen at once. */
  initial?: RoomView | null;
  /** Back out of the room, to wherever the player came from. */
  onLeft(): void;
}

export const GroupRoom: React.FC<GroupRoomProps> = ({ code, token, initial = null, onLeft }) => {
  const { t } = useT();
  const feed = useRoom(code, token, initial);
  const { room, link, goneBecause, apply } = feed;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const left = useRef(false);

  // A removed or closed room is over: forget the seat so a refresh does not come back to it.
  useEffect(() => {
    if (link === "gone") clearSeat();
  }, [link]);

  const act = async (run: () => Promise<RoomView>) => {
    setBusy(true);
    setError("");
    try {
      apply(await run());
    } catch (e) {
      setError(t(roomErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (left.current) return;
    left.current = true;
    clearSeat();
    try {
      await GroupAPI.leave(code, token);
    } catch {
      /* Leaving still works for this player: the room tidies itself up. */
    }
    onLeft();
  };

  if (link === "gone") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 pb-20 text-center">
        <p role="status" className={themeSystem.flash("info")}>
          {goneBecause === "removed" ? t("rebus.group.removed") : t("rebus.group.closed")}
        </p>
        <UIButton size="lg" onClick={onLeft}>
          {t("rebus.group.back")}
        </UIButton>
      </div>
    );
  }

  if (!room) {
    return (
      <p role="status" className={`${themeSystem.typography("body-sm")} text-center`}>
        {t("rebus.group.connecting")}
      </p>
    );
  }

  if (room.status === "playing" && room.puzzle) {
    return <GroupPlay room={room} token={token} skewMs={feed.skewMs} apply={apply} />;
  }

  if (room.status === "playing") {
    return (
      <p role="status" className={`${themeSystem.typography("body-sm")} text-center`}>
        {t("rebus.group.connecting")}
      </p>
    );
  }

  if (room.status === "finished") {
    return <GroupFinal room={room} busy={busy} error={error} onAgain={() => void act(() => GroupAPI.rematch(code, token))} onLeave={() => void leave()} />;
  }

  return (
    <Lobby
      room={room}
      busy={busy}
      error={error}
      reconnecting={link === "reconnecting"}
      onStart={() => void act(() => GroupAPI.start(code, token))}
      onLock={(locked) => void act(() => GroupAPI.lock(code, token, locked))}
      onKick={(pid) => void act(() => GroupAPI.kick(code, token, pid))}
      onLeave={() => void leave()}
    />
  );
};
