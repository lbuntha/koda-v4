/** The end of a race: who won, everybody's place, and the host can run it again. */

import React, { useEffect } from "react";
import { LogOut, RotateCcw, Trophy } from "lucide-react";
import { useT } from "../../lib/i18n";
import { cue } from "../sound";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { useNickname } from "./NicknamePicker";
import { AskGrownUp } from "./AskGrownUp";
import { Podium } from "./Podium";
import { RoomAvatar } from "./RoomAvatar";
import type { GroupReward } from "./useGroupLearning";
import type { RoomView } from "./types";

export interface GroupFinalProps {
  room: RoomView;
  busy?: boolean;
  error?: string;
  /** What a signed-in player earned for the game, once it has been recorded. */
  reward?: GroupReward | null;
  /** A guest opened "ask a grown-up". */
  onAsked?(): void;
  onAgain(): void;
  onLeave(): void;
}

export const GroupFinal: React.FC<GroupFinalProps> = ({ room, busy = false, error, reward = null, onAsked, onAgain, onLeave }) => {
  const { t } = useT();
  const show = useNickname();
  const standings = room.standings ?? [];
  const winners = standings.filter((s) => s.place === 1).map((s) => room.players.find((p) => p.pid === s.pid)).filter((p) => p !== undefined);
  const rest = standings.filter((s) => s.place > 3);
  const iWon = standings.some((s) => s.place === 1 && s.pid === room.me.pid);

  // Said once, when the results appear.
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
      </div>

      <Podium standings={standings} players={room.players} mePid={room.me.pid} />

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
                <span className="text-xl font-black text-ink">{t("rebus.group.play.pts", { n: s.score })}</span>
              </li>
            );
          })}
        </ol>
      )}

      {reward && (
        <p role="status" className={themeSystem.flash(reward.xp > 0 ? "success" : "info")}>
          {reward.xp > 0 ? t("rebus.group.earnedXp", { xp: reward.xp }) : t("rebus.group.noXp")}
        </p>
      )}

      {!room.me.isKodaUser && <AskGrownUp onOpen={onAsked} />}

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {room.me.isHost ? (
          <UIButton size="lg" fullWidth icon={<RotateCcw />} isLoading={busy} disabled={busy} onClick={onAgain}>
            {t("rebus.playAgain")}
          </UIButton>
        ) : (
          <p role="status" className={themeSystem.flash("info")}>
            {t("rebus.group.play.waitAgain")}
          </p>
        )}
        <UIButton variant="ghost" fullWidth icon={<LogOut />} onClick={onLeave}>
          {t("rebus.group.leave")}
        </UIButton>
      </div>
    </div>
  );
};
