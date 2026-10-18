/** The end of a race: who won, everybody's place, and the host can run it again. */

import React from "react";
import { LogOut, RotateCcw, Trophy } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { useNickname } from "./NicknamePicker";
import { RoomAvatar } from "./RoomAvatar";
import type { RoomView } from "./types";

export interface GroupFinalProps {
  room: RoomView;
  busy?: boolean;
  error?: string;
  onAgain(): void;
  onLeave(): void;
}

export const GroupFinal: React.FC<GroupFinalProps> = ({ room, busy = false, error, onAgain, onLeave }) => {
  const { t } = useT();
  const show = useNickname();
  const standings = room.standings ?? [];
  const winners = standings.filter((s) => s.place === 1).map((s) => room.players.find((p) => p.pid === s.pid)).filter((p) => p !== undefined);
  const iWon = standings.some((s) => s.place === 1 && s.pid === room.me.pid);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <Trophy aria-hidden="true" className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        <h2 role="status" className={themeSystem.typography("h2")}>
          {iWon ? t("rebus.group.play.youWon") : winners.length === 1 ? t("rebus.group.play.winnerIs", { name: show(winners[0].name) }) : t("rebus.group.play.itsATie")}
        </h2>
      </div>

      <ol className="flex flex-col gap-2" aria-label={t("rebus.group.play.finalTitle")}>
        {standings.map((s) => {
          const p = room.players.find((x) => x.pid === s.pid);
          if (!p) return null;
          return (
            <li key={s.pid} className={themeSystem.card("default", `flex items-center gap-3 px-3 py-2 ${s.place === 1 ? "!border-emerald-500" : ""}`)}>
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
