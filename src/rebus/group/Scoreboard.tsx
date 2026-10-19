/** Who is where: every player, their score, and a ring on whoever is ahead. */

import React from "react";
import { UICountUp, UIPointsPop } from "../../components/ui";
import { useT } from "../../lib/i18n";
import { useNickname } from "./NicknamePicker";
import { RoomAvatar } from "./RoomAvatar";
import type { RoomPlayer } from "./types";

/** Whoever just took a puzzle, so the board can show it where the eye already is. */
export interface Scored {
  pid: string;
  points: number;
  /** Changes with every puzzle, so the "+3" plays again. */
  key: string | number;
}

export const Scoreboard: React.FC<{ players: readonly RoomPlayer[]; meId: string; scored?: Scored | null }> = ({ players, meId, scored = null }) => {
  const { t } = useT();
  const show = useNickname();
  const top = Math.max(0, ...players.map((p) => p.score));
  const ranked = [...players].sort((a, b) => b.score - a.score);
  return (
    <ul className="flex gap-2 overflow-x-auto overflow-y-visible px-1 pb-1 pt-6" aria-label={t("rebus.group.play.scores")}>
      {ranked.map((p) => {
        const leading = top > 0 && p.score === top;
        const justNow = scored?.pid === p.pid;
        return (
          <li
            key={p.pid}
            className={`relative flex min-w-24 flex-1 flex-col items-center gap-1 rounded-2xl border-2 px-2 py-2 transition-colors duration-300 ${justNow ? "ui-glow border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : leading ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-line bg-white dark:bg-slate-900"} ${p.connected ? "" : "opacity-60"}`}
          >
            {justNow && scored && <UIPointsPop key={scored.key}>+{scored.points}</UIPointsPop>}
            <RoomAvatar avatar={p.avatar} />
            <span className="max-w-full truncate text-xs font-black text-ink">
              {show(p.name)}
              {p.pid === meId ? ` ${t("rebus.group.you")}` : ""}
            </span>
            <UICountUp value={p.score} className="text-2xl font-black leading-none text-ink" />
          </li>
        );
      })}
    </ul>
  );
};
