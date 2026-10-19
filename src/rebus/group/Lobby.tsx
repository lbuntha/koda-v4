/**
 * The lobby: the code to share, who has joined, and (for the host) Start.
 *
 * The code is the biggest thing on the screen because reading it aloud or
 * showing it to the next seat is how most friends will join. A guest can see who
 * is a Koda user and nothing else about anyone: no names, ages or accounts.
 */

import React, { useState } from "react";
import { Check, Copy, Crown, X, Lock, LogOut, Play, Share2, Unlock, UserMinus } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton } from "../../components/ui";
import { categoryLabel } from "../categoryNames";
import { formatCode } from "./choices";
import { useNickname } from "./NicknamePicker";
import { RoomAvatar } from "./RoomAvatar";
import { linkFor } from "./roomLink";
import type { RoomView } from "./types";

export interface LobbyProps {
  room: RoomView;
  busy?: boolean;
  error?: string;
  reconnecting?: boolean;
  onStart(): void;
  onLock(locked: boolean): void;
  onKick(pid: string): void;
  onAccept(pid: string): void;
  onDecline(pid: string): void;
  onLeave(): void;
}

const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const Lobby: React.FC<LobbyProps> = ({ room, busy = false, error, reconnecting = false, onStart, onLock, onKick, onAccept, onDecline, onLeave }) => {
  const { t } = useT();
  const show = useNickname();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const host = room.me.isHost;
  const enough = room.players.length >= 2;

  const copy = async (what: "code" | "link") => {
    if (await copyText(what === "code" ? room.code : linkFor(room.code))) {
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: t("rebus.title"), text: t("rebus.group.shareText", { code: room.code }), url: linkFor(room.code) });
    } catch {
      /* Cancelled, or not available: the copy buttons are still there. */
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-20">
      <div className={themeSystem.card("default", `${themeSystem.spacing.card} flex flex-col items-center gap-3 text-center`)}>
        <span className={themeSystem.typography("caption")}>{t("rebus.group.roomCode")}</span>
        <span aria-label={room.code.split("").join(" ")} className="text-5xl font-black tracking-[0.25em] text-ink">
          {formatCode(room.code)}
        </span>
        <div className="flex flex-wrap justify-center gap-2">
          <UIButton size="sm" variant="secondary" icon={copied === "code" ? <Check /> : <Copy />} onClick={() => void copy("code")}>
            {copied === "code" ? t("rebus.group.copied") : t("rebus.group.copyCode")}
          </UIButton>
          <UIButton size="sm" variant="secondary" icon={copied === "link" ? <Check /> : <Copy />} onClick={() => void copy("link")}>
            {copied === "link" ? t("rebus.group.copied") : t("rebus.group.copyLink")}
          </UIButton>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <UIButton size="sm" variant="secondary" icon={<Share2 />} onClick={() => void share()}>
              {t("rebus.group.share")}
            </UIButton>
          )}
        </div>
        <p className={themeSystem.typography("caption")}>{t("rebus.group.codeHint")}</p>
      </div>

      {host && (room.requests?.length ?? 0) > 0 && (
        <section className={themeSystem.spacing.stack} aria-label={t("rebus.group.requests")}>
          <h3 className={themeSystem.typography("h4")}>{t("rebus.group.requests")}</h3>
          <ul className="flex flex-col gap-2">
            {room.requests?.map((r) => (
              <li key={r.pid} className={themeSystem.card("default", "flex items-center gap-3 px-3 py-2")}>
                <RoomAvatar avatar={r.avatar} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-black text-ink">{show(r.name)}</span>
                  {r.isKodaUser && <UIBadge variant="info">{t("rebus.group.kodaUser")}</UIBadge>}
                </div>
                <UIButton size="sm" variant="ghost" aria-label={t("rebus.group.declineName", { name: show(r.name) })} icon={<X />} disabled={busy} onClick={() => onDecline(r.pid)} />
                <UIButton size="sm" icon={<Check />} aria-label={t("rebus.group.acceptName", { name: show(r.name) })} disabled={busy} onClick={() => onAccept(r.pid)}>
                  {t("rebus.group.accept")}
                </UIButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={themeSystem.spacing.stack} aria-label={t("rebus.group.players")}>
        <div className="flex items-center justify-between">
          <h3 className={themeSystem.typography("h4")}>{t("rebus.group.players")}</h3>
          <UIBadge variant="neutral">{t("rebus.group.count", { n: room.players.length, max: room.settings.maxPlayers })}</UIBadge>
        </div>
        <ul className="flex flex-col gap-2">
          {room.players.map((p) => (
            <li key={p.pid} className={themeSystem.card("default", "flex items-center gap-3 px-3 py-2")}>
              <RoomAvatar avatar={p.avatar} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-black text-ink">
                  {show(p.name)}
                  {p.pid === room.me.pid && <span className="ml-2 text-xs font-bold text-muted">{t("rebus.group.you")}</span>}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  {p.isHost && (
                    <UIBadge variant="primary">
                      <Crown aria-hidden="true" className="mr-1 inline h-3 w-3" />
                      {t("rebus.group.host")}
                    </UIBadge>
                  )}
                  {p.isKodaUser && <UIBadge variant="info">{t("rebus.group.kodaUser")}</UIBadge>}
                  {!p.connected && <span className="text-xs font-bold text-muted">{t("rebus.group.away")}</span>}
                </span>
              </div>
              {host && p.pid !== room.me.pid && (
                <UIButton size="sm" variant="ghost" aria-label={t("rebus.group.remove", { name: show(p.name) })} icon={<UserMinus />} onClick={() => onKick(p.pid)} />
              )}
            </li>
          ))}
        </ul>
        {!enough && <p className={themeSystem.typography("caption", "text-center")}>{t("rebus.group.waiting")}</p>}
      </section>

      <p className={themeSystem.typography("body-sm", "text-center")}>
        {room.settings.category === "mixed" ? t("rebus.mixed") : categoryLabel(room.settings.category)} · {t("rebus.puzzlesCount", { count: room.settings.count })}
      </p>

      {reconnecting && (
        <p role="status" className={themeSystem.flash("info")}>
          {t("rebus.group.reconnecting")}
        </p>
      )}
      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {host ? (
          <>
            <UIButton size="lg" fullWidth icon={<Play />} isLoading={busy} disabled={busy || !enough} onClick={onStart}>
              {t("rebus.group.start")}
            </UIButton>
            {!enough && <p className={themeSystem.typography("caption", "text-center")}>{t("rebus.group.needTwo")}</p>}
            <UIButton variant="secondary" fullWidth icon={room.locked ? <Unlock /> : <Lock />} onClick={() => onLock(!room.locked)}>
              {room.locked ? t("rebus.group.unlock") : t("rebus.group.lock")}
            </UIButton>
          </>
        ) : (
          <p className={themeSystem.flash("info")} role="status">
            {t("rebus.group.waitHost")}
          </p>
        )}
        <UIButton variant="ghost" fullWidth icon={<LogOut />} onClick={onLeave}>
          {t("rebus.group.leave")}
        </UIButton>
      </div>
    </div>
  );
};
