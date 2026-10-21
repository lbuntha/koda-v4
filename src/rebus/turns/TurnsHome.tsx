/**
 * Take turns on one device: set up, then play.
 *
 * Two to four players pick a topic and how many puzzles each will get. Every
 * player is a nickname and a look from the fixed lists, as in a room, so no
 * child types a name. Nothing here touches the network, so it works on a train;
 * it pays no XP and writes nothing to a learning log, because a shared screen
 * cannot say whose play it was.
 */

import React, { useMemo, useState } from "react";
import { ArrowLeft, Pencil, Play, Plus, X } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton, UITabs } from "../../components/ui";
import { categoryLabel } from "../categoryNames";
import { useRebusCategories } from "../bank";
import { AVATARS, NICKNAMES } from "../group/choices";
import { NicknamePicker, useNickname } from "../group/NicknamePicker";
import { RoomAvatar } from "../group/RoomAvatar";
import { localizePuzzle } from "../localize";
import { buildRound } from "../round";
import { loadSeen, markSeen } from "../seenStore";
import { seenSet } from "../seen";
import type { RebusSettings } from "../settings";
import type { CategoryId, Puzzle } from "../types";
import { cue } from "../sound";
import { MAX_PLAYERS, MIN_PLAYERS, type TurnPlayer } from "./engine";
import { Handover, TurnPlay, TurnReveal, TurnsFinal } from "./TurnsPlay";
import { useTurns } from "./useTurns";

export interface TurnsHomeProps {
  /** Every puzzle these players can be given. */
  puzzles: readonly Puzzle[];
  counts: Readonly<Record<string, number>>;
  settings: RebusSettings;
  onExit(): void;
}

const EACH_CHOICES = [2, 3, 5] as const;

/** Distinct starting players, so Start works at once and a child may change them. */
const starter = (i: number): TurnPlayer => ({ name: NICKNAMES[i * 2 + 1] ?? NICKNAMES[i], avatar: AVATARS[i] });

export const TurnsHome: React.FC<TurnsHomeProps> = ({ puzzles, counts, settings, onExit }) => {
  const { t, language } = useT();
  const show = useNickname();
  const game = useTurns();
  const cats = useRebusCategories();
  const first = cats.find((c) => (counts[c.id] ?? 0) > 0)?.id ?? "mixed";
  const [category, setCategory] = useState<CategoryId | "mixed">(first);
  const [each, setEach] = useState<number>(3);
  const [players, setPlayers] = useState<TurnPlayer[]>([starter(0), starter(1)]);
  const [editing, setEditing] = useState<number | null>(null);
  const [short, setShort] = useState(false);

  const usable = useMemo(() => puzzles.filter((p) => category === "mixed" || p.category === category).length, [puzzles, category]);

  const begin = () => {
    const built = buildRound(puzzles, { category, count: each * players.length, seen: seenSet(loadSeen()), seed: `${Date.now()}` });
    // Whole turns only: every player gets the same number of puzzles.
    const whole = built.puzzles.slice(0, Math.floor(built.puzzles.length / players.length) * players.length);
    if (whole.length === 0) return setShort(true);
    setShort(false);
    markSeen(whole.map((p) => p.id));
    cue("start");
    game.start({ puzzles: whole.map((p) => localizePuzzle(p, language)), players, settings });
  };

  const change = (i: number, patch: Partial<TurnPlayer>) => setPlayers((list) => list.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const addPlayer = () =>
    setPlayers((list) => {
      const taken = new Set(list.map((p) => p.name));
      const name = NICKNAMES.find((n) => !taken.has(n)) ?? NICKNAMES[0];
      const avatar = AVATARS.find((a) => !list.some((p) => p.avatar === a)) ?? AVATARS[0];
      return [...list, { name, avatar }];
    });

  const state = game.state;
  if (state?.phase === "handover") return <Handover game={game} />;
  if (state?.phase === "playing") return <TurnPlay game={game} letterTiles={settings.letterTiles} />;
  if (state?.phase === "revealed") return <TurnReveal game={game} />;
  if (state?.phase === "done") return <TurnsFinal game={game} onAgain={begin} onLeave={game.reset} />;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-20">
      <div>
        <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={onExit}>
          {t("rebus.back")}
        </UIButton>
      </div>
      <div>
        <h2 className={themeSystem.typography("h2")}>{t("rebus.turns.title")}</h2>
        <p className={themeSystem.typography("subtitle")}>{t("rebus.turns.subtitle")}</p>
      </div>

      <section className={themeSystem.spacing.stack} aria-label={t("rebus.turns.players")}>
        <h3 className={themeSystem.typography("h4")}>{t("rebus.turns.players")}</h3>
        <ul className="flex flex-col gap-2">
          {players.map((p, i) => (
            <li key={i} className={themeSystem.card("default", "flex flex-col gap-3 px-3 py-2")}>
              <div className="flex items-center gap-3">
                <RoomAvatar avatar={p.avatar} />
                <span className="min-w-0 flex-1 truncate text-base font-black text-ink">{show(p.name)}</span>
                <UIButton size="sm" variant="ghost" aria-label={t("rebus.turns.change", { name: show(p.name) })} icon={editing === i ? <X /> : <Pencil />} onClick={() => setEditing(editing === i ? null : i)} />
                {players.length > MIN_PLAYERS && (
                  <UIButton
                    size="sm"
                    variant="ghost"
                    aria-label={t("rebus.turns.remove", { name: show(p.name) })}
                    icon={<X />}
                    onClick={() => {
                      setPlayers((list) => list.filter((_, j) => j !== i));
                      setEditing(null);
                    }}
                  />
                )}
              </div>
              {editing === i && (
                <NicknamePicker
                  name={p.name}
                  avatar={p.avatar}
                  onName={(name) => change(i, { name })}
                  onAvatar={(avatar) => change(i, { avatar })}
                  taken={players.filter((_, j) => j !== i).map((x) => x.name)}
                />
              )}
            </li>
          ))}
        </ul>
        {players.length < MAX_PLAYERS && (
          <UIButton variant="secondary" icon={<Plus />} onClick={addPlayer}>
            {t("rebus.turns.add")}
          </UIButton>
        )}
      </section>

      <section className={themeSystem.spacing.stack}>
        <h3 className={themeSystem.typography("h4")}>{t("rebus.chooseTopic")}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {[...cats.map((c) => ({ id: c.id as CategoryId | "mixed", name: categoryLabel(c.id), n: counts[c.id] ?? 0 })), { id: "mixed" as const, name: t("rebus.mixed"), n: puzzles.length }].map(({ id, name, n }) => {
            const empty = n === 0;
            const selected = category === id;
            return (
              <button
                key={id}
                type="button"
                disabled={empty}
                aria-pressed={selected}
                onClick={() => setCategory(id)}
                className={themeSystem.card(empty ? "default" : "interactive", `flex items-center justify-between gap-3 px-4 py-3 text-left pointer-coarse:min-h-14 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "!border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800" : ""}`)}
              >
                <span className="text-base font-black text-ink">{name}</span>
                <UIBadge variant={empty ? "neutral" : selected ? "primary" : "info"}>{empty ? t("rebus.soon") : t("rebus.puzzlesCount", { count: n })}</UIBadge>
              </button>
            );
          })}
        </div>
      </section>

      <section className={themeSystem.spacing.stack}>
        <h3 className={themeSystem.typography("h4")}>{t("rebus.turns.each")}</h3>
        <UITabs label={t("rebus.turns.each")} items={EACH_CHOICES.map((n) => ({ id: String(n), label: String(n) }))} value={String(each)} onChange={(id) => setEach(Number(id))} />
        <p className={themeSystem.typography("caption")}>{t("rebus.turns.total", { total: each * players.length })}</p>
      </section>

      {(short || usable < players.length) && (
        <p role="alert" className={themeSystem.flash("info")}>
          {t("rebus.noneFit")}
        </p>
      )}

      <UIButton size="lg" fullWidth icon={<Play />} disabled={usable < players.length} onClick={begin}>
        {t("rebus.turns.start")}
      </UIButton>
      <p className={themeSystem.typography("caption", "text-center")}>{t("rebus.turns.offline")}</p>
    </div>
  );
};
