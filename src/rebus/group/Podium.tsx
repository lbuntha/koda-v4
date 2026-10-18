/**
 * The top three on a podium, rising into place.
 *
 * Players who share a place stand on the same step, so a tie is shown as a tie.
 * Anyone below third is listed under it by the results screen, not here. The
 * rise is a short height transition that a "reduce motion" setting turns off.
 */

import React, { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { useT } from "../../lib/i18n";
import { useNickname } from "./NicknamePicker";
import { RoomAvatar } from "./RoomAvatar";
import type { RoomPlayer, Standing } from "./types";

export interface PodiumProps {
  standings: readonly Standing[];
  players: readonly RoomPlayer[];
  mePid: string;
}

/** Step height (rem) and colour for places 1 to 3. Never yellow: it is hard to read. */
const STEPS: Record<1 | 2 | 3, { height: number; tone: string }> = {
  1: { height: 8, tone: "bg-emerald-600" },
  2: { height: 5.5, tone: "bg-indigo-600" },
  3: { height: 3.5, tone: "bg-rose-600" },
};

/** Second, first, third: the shape of a podium. */
const ORDER: ReadonlyArray<1 | 2 | 3> = [2, 1, 3];

export const Podium: React.FC<PodiumProps> = ({ standings, players, mePid }) => {
  const { t } = useT();
  const show = useNickname();
  const [risen, setRisen] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setRisen(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const steps = ORDER.map((place) => ({
    place,
    people: standings.filter((s) => s.place === place).map((s) => ({ standing: s, player: players.find((p) => p.pid === s.pid) })),
  })).filter((step) => step.people.length > 0);

  return (
    <ol className="flex items-end justify-center gap-2" aria-label={t("rebus.group.podium.label")}>
      {steps.map(({ place, people }) => (
        <li key={place} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex flex-wrap items-end justify-center gap-1">
            {people.map(({ standing, player }) =>
              player ? (
                <div key={standing.pid} className="flex min-w-0 flex-col items-center">
                  {place === 1 && <Crown aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
                  <RoomAvatar avatar={player.avatar} />
                  <span className="max-w-full truncate text-sm font-black text-ink">
                    {show(player.name)}
                    {player.pid === mePid && <span className="ml-1 text-xs font-bold text-muted">{t("rebus.group.you")}</span>}
                  </span>
                  <span className="text-xs font-bold text-muted">{t("rebus.group.play.pts", { n: standing.score })}</span>
                </div>
              ) : null,
            )}
          </div>
          <div
            className={`flex w-full items-start justify-center rounded-t-2xl pt-2 text-3xl font-black text-white transition-[height] duration-700 ease-out motion-reduce:transition-none ${STEPS[place].tone}`}
            style={{ height: `${risen ? STEPS[place].height : 1}rem` }}
            aria-label={t("rebus.group.podium.place", { n: place })}
          >
            {place}
          </div>
        </li>
      ))}
    </ol>
  );
};
