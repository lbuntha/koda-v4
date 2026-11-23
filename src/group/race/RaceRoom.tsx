/**
 * One seat in one lesson race, from the door to the podium.
 *
 * The round itself is the skill's own, mounted by the app (`renderRound`) with
 * the room's seed and an observer: the child plays exactly the lesson they
 * would play alone, and this screen only adds who else is racing.
 */

import React, { useEffect, useRef, useState } from "react";
import { Clock, Trophy } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton } from "../../components/ui";
import { Lobby } from "../../rebus/group/Lobby";
import type { RoundObserver } from "../../skills/sdk/createKodaSDK";
import { SkillRoomsAPI } from "../skillRoomsApi";
import type { SkillRoomView } from "../types";
import { useRoom } from "../useRoom";
import { useServerClock } from "../useServerClock";
import { raceErrorKey } from "./raceErrors";
import { raceLinkFor } from "./raceLink";
import { clearRaceSeat } from "./raceSeat";
import { RaceResults } from "./RaceResults";
import { RaceStrip } from "./RaceStrip";
import { useRaceReporter } from "./useRaceReporter";

export interface RaceRound {
  seed: string;
  observer: RoundObserver;
  /** The child left the round's own end card: show the race instead. */
  onClose(): void;
}

export interface RaceRoomProps {
  code: string;
  token: string;
  initial?: SkillRoomView | null;
  /** The skill's round for this room's lesson, or null when this device does not have that lesson. */
  renderRound(room: SkillRoomView, race: RaceRound): React.ReactNode | null;
  onLeft(): void;
}

const Status: React.FC<{ children: React.ReactNode; tone?: "info" | "plain" }> = ({ children, tone = "plain" }) => (
  <p role="status" className={tone === "info" ? themeSystem.flash("info") : themeSystem.typography("body-sm", "text-center")}>
    {children}
  </p>
);

export const RaceRoom: React.FC<RaceRoomProps> = ({ code, token, initial = null, renderRound, onLeft }) => {
  const { t } = useT();
  const { room, link, goneBecause, apply, skewMs } = useRoom<SkillRoomView>(SkillRoomsAPI.poll, code, token, initial);
  const now = useServerClock(skewMs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closed, setClosed] = useState<string | null>(null);
  /** The seed of a round this device has played, so its end card outlives the race. */
  const [played, setPlayed] = useState<string | null>(null);
  const left = useRef(false);
  const seed = room?.seed ?? "";
  const tracker = useRaceReporter(code, token, seed, apply);

  useEffect(() => {
    if (link === "gone") clearRaceSeat();
  }, [link]);

  const playing = room?.status === "playing" && now >= (room.startMs ?? Infinity) && Boolean(seed);
  useEffect(() => {
    if (playing) setPlayed(seed);
  }, [playing, seed]);

  const act = async (run: () => Promise<SkillRoomView>) => {
    setBusy(true);
    setError("");
    try {
      apply(await run());
    } catch (e) {
      setError(t(raceErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (left.current) return;
    left.current = true;
    clearRaceSeat();
    try {
      await SkillRoomsAPI.leave(code, token);
    } catch {
      /* The room tidies itself up. */
    }
    onLeft();
  };

  if (link === "gone") {
    const turnedAway = room?.status === "pending";
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 pb-20 text-center">
        <Status tone="info">{turnedAway ? t("rebus.group.declined") : goneBecause === "removed" ? t("rebus.group.removed") : t("rebus.group.closed")}</Status>
        <UIButton size="lg" onClick={onLeft}>
          {t("rebus.group.back")}
        </UIButton>
      </div>
    );
  }

  if (!room) return <Status>{t("rebus.group.connecting")}</Status>;

  const offline = link === "reconnecting" ? <Status tone="info">{t("rebus.group.reconnecting")}</Status> : null;

  if (room.status === "pending") {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 pb-20 text-center">
        {offline}
        <Status tone="info">{t("rebus.group.door")}</Status>
        <p className={themeSystem.typography("caption")}>{t("rebus.group.doorHint")}</p>
        <UIButton variant="ghost" onClick={() => void leave()}>
          {t("rebus.group.leave")}
        </UIButton>
      </div>
    );
  }

  if (room.status === "lobby") {
    return (
      <Lobby
        room={room}
        summary={`${room.settings.title} · ${t("race.questions", { count: room.settings.count })}`}
        invite={{ link: raceLinkFor(room.code), title: t("race.title"), text: t("race.shareText", { lesson: room.settings.title, code: room.code }) }}
        busy={busy}
        error={error}
        reconnecting={link === "reconnecting"}
        onStart={() => void act(() => SkillRoomsAPI.start(room.code, token))}
        onLock={(locked) => void act(() => SkillRoomsAPI.lock(room.code, token, locked))}
        onKick={(pid) => void act(() => SkillRoomsAPI.kick(room.code, token, pid))}
        onAccept={(pid) => void act(() => SkillRoomsAPI.accept(room.code, token, pid))}
        onDecline={(pid) => void act(() => SkillRoomsAPI.decline(room.code, token, pid))}
        onLeave={() => void leave()}
      />
    );
  }

  /*
   * The last child to finish ends the race — and in the same instant would
   * lose the round's own end card, with the stars and XP their answers earned.
   * Their round stays until they choose to see the results.
   */
  if (room.status === "finished" && played === seed && closed !== seed) {
    const round = renderRound(room, { seed, observer: tracker, onClose: () => setClosed(seed) });
    if (round !== null) {
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 pb-20">
          {offline}
          <div className={themeSystem.card("default", "flex items-center justify-between gap-3 px-3 py-2")}>
            <span className="text-sm font-black text-ink">
              {/* Their round still open means the clock, not the last finisher, ended it. */}
              {room.players.find((p) => p.pid === room.me.pid)?.done ? t("race.resultsReady") : t("race.timeUp")}
            </span>
            <UIButton size="sm" icon={<Trophy />} onClick={() => setClosed(seed)}>
              {t("race.seeResults")}
            </UIButton>
          </div>
          {round}
        </div>
      );
    }
  }

  if (room.status === "finished") {
    return (
      <>
        {offline}
        <RaceResults room={room} busy={busy} error={error} onAgain={() => void act(() => SkillRoomsAPI.rematch(room.code, token))} onLeave={() => void leave()} />
      </>
    );
  }

  // Playing.
  const startMs = room.startMs ?? 0;
  const counting = now < startMs;
  const me = room.players.find((p) => p.pid === room.me.pid);
  const secondsLeft = Math.max(0, Math.ceil((startMs + (room.limitMs ?? room.settings.limitSec * 1000) - now) / 1000));
  const clock = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
  const round = counting || !seed ? null : renderRound(room, { seed, observer: tracker, onClose: () => setClosed(seed) });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 pb-20">
      {offline}
      <section className={themeSystem.card("default", "flex flex-col gap-2 px-3 py-2")} aria-label={t("race.title")}>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-black text-ink">{room.settings.title}</span>
          {!counting && (
            <span className="flex shrink-0 items-center gap-1 text-xs font-black tabular-nums text-muted" aria-label={t("race.timeLeft", { time: clock })}>
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              {clock}
            </span>
          )}
        </div>
        <RaceStrip room={room} />
        {me?.done && <p className={themeSystem.typography("caption")}>{t("race.waitOthers")}</p>}
      </section>

      {counting ? (
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 py-16 text-center">
          <span className={themeSystem.typography("h3")}>{t("rebus.group.play.ready")}</span>
          <span className="text-7xl font-black text-indigo-600 dark:text-indigo-400">{Math.max(1, Math.ceil((startMs - now) / 1000))}</span>
        </div>
      ) : closed === seed ? null : round === null ? (
        <Status tone="info">{t("race.notOnDevice")}</Status>
      ) : (
        round
      )}
    </div>
  );
};
