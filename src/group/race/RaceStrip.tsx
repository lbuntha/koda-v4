/**
 * Everyone's progress through the round, live: a line per player.
 *
 * Shows how many questions each player has finished, out of the round. Not
 * their mistakes and not a running score: a child who is behind sees that a
 * friend is further on, which is a race, and nothing that reads as a mark.
 */

import React from "react";
import { Check } from "lucide-react";
import { useT } from "../../lib/i18n";
import { useNickname } from "../../rebus/group/NicknamePicker";
import { RoomAvatar } from "../../rebus/group/RoomAvatar";
import type { SkillRoomView } from "../types";

export const RaceStrip: React.FC<{ room: SkillRoomView }> = ({ room }) => {
  const { t } = useT();
  const show = useNickname();
  const total = Math.max(1, room.total ?? room.settings.count);
  return (
    <ul className="flex flex-col gap-1.5" aria-label={t("race.progress")}>
      {room.players.map((p) => {
        const mine = p.pid === room.me.pid;
        const done = Boolean(p.done);
        const solved = Math.min(total, p.solved ?? 0);
        return (
          <li key={p.pid} className="flex items-center gap-2">
            <RoomAvatar avatar={p.avatar} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-xs font-black text-ink">
                {show(p.name)}
                {mine && <span className="ml-1 font-bold text-muted">{t("rebus.group.you")}</span>}
              </span>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={solved}
                aria-label={t("race.playerProgress", { name: show(p.name), n: solved, total })}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none ${done ? "bg-emerald-500" : mine ? "bg-indigo-500" : "bg-sky-500"}`}
                  style={{ width: `${(solved / total) * 100}%` }}
                />
              </div>
            </div>
            <span className="flex w-12 items-center justify-end gap-0.5 text-xs font-black tabular-nums text-muted">
              {done ? <Check aria-label={t("race.finished")} className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> : `${solved}/${total}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
