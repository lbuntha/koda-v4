/**
 * The end of a race: the podium, everyone's place, and (for the host) race again.
 *
 * Places are by questions right first time. What the child earned is not
 * here: XP and stars came from their own round, on the card they have just
 * seen, the same as playing alone — winning adds nothing, losing takes nothing.
 */

import React, { useEffect } from "react";
import { LogOut, RotateCcw, Trophy } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { cue } from "../../rebus/sound";
import { useNickname } from "../../rebus/group/NicknamePicker";
import { Podium } from "../../rebus/group/Podium";
import { RoomAvatar } from "../../rebus/group/RoomAvatar";
import type { SkillRoomView } from "../types";

export interface RaceResultsProps {
  room: SkillRoomView;
  busy?: boolean;
  error?: string;
  onAgain(): void;
  onLeave(): void;
}

export const RaceResults: React.FC<RaceResultsProps> = ({ room, busy = false, error, onAgain, onLeave }) => {
  const { t } = useT();
  const show = useNickname();
  const standings = room.standings ?? [];
  const total = room.total ?? room.settings.count;
  const winners = standings.filter((s) => s.place === 1).map((s) => room.players.find((p) => p.pid === s.pid)).filter((p) => p !== undefined);
  const rest = standings.filter((s) => s.place > 3);
  const iWon = standings.some((s) => s.place === 1 && s.pid === room.me.pid);
  const right = (n: number) => t("race.rightOf", { n, total });

  useEffect(() => {
    cue(iWon ? "groupWon" : "groupEnd");
  }, [iWon]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <Trophy aria-hidden="true" className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        <h2 role="status" className={themeSystem.typography("h2")}>
          {iWon ? t("rebus.group.play.youWon") : winners.length === 1 ? t("rebus.group.play.winnerIs", { name: show(winners[0].name) }) : t("rebus.group.play.itsATie")}
        </h2>
        <p className={themeSystem.typography("body-sm")}>{t("race.howPlaced")}</p>
      </div>

      <Podium standings={standings} players={room.players} mePid={room.me.pid} scoreText={right} />

      {rest.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label={t("rebus.group.play.finalTitle")} start={4}>
          {rest.map((s) => {
            const p = room.players.find((x) => x.pid === s.pid);
            if (!p) return null;
            return (
              <li key={s.pid} className={themeSystem.card("default", "flex items-center gap-3 px-3 py-2")}>
                <span className="w-8 text-center text-2xl font-black text-ink">{s.place}</span>
                <RoomAvatar avatar={p.avatar} />
                <span className="min-w-0 flex-1 truncate font-black text-ink">
                  {show(p.name)}
                  {p.pid === room.me.pid && <span className="ml-2 text-xs font-bold text-muted">{t("rebus.group.you")}</span>}
                </span>
                <span className="text-sm font-black text-ink">{right(s.score)}</span>
              </li>
            );
          })}
        </ol>
      )}

      <p className={themeSystem.flash("info")}>{t("race.ownXp")}</p>

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}
      {room.me.isHost ? (
        <UIButton size="lg" fullWidth icon={<RotateCcw />} isLoading={busy} disabled={busy} onClick={onAgain}>
          {t("race.again")}
        </UIButton>
      ) : (
        <p className={themeSystem.typography("caption", "text-center")}>{t("rebus.group.play.waitAgain")}</p>
      )}
      <UIButton variant="ghost" icon={<LogOut />} onClick={onLeave}>
        {t("rebus.group.leave")}
      </UIButton>
    </div>
  );
};
