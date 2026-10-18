/**
 * The finish: you against the Machine, and who won, shown rather than told.
 *
 * Both sides face each other with their scores. The winner is lifted, crowned
 * with a trophy and showered with a burst of confetti; the other side steps
 * back, softened, with a kind word instead of a "you lost". A tie shows both
 * lifted equally. Everything moves once and stops (the confetti is a single
 * burst, not a loop), and a player who asked their device for less motion gets
 * the same picture standing still.
 */

import React from "react";
import { Bot, Crown, Handshake, Trophy, User } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";

export interface ShowdownProps {
  you: number;
  machine: number;
}

/** Confetti pieces: where they land, how far they travel, how long they take. No yellow anywhere. */
const CONFETTI = [
  { x: -150, y: -120, color: "bg-indigo-500", delay: 0 },
  { x: -90, y: -170, color: "bg-pink-500", delay: 0.05 },
  { x: -30, y: -140, color: "bg-emerald-500", delay: 0.1 },
  { x: 40, y: -180, color: "bg-cyan-500", delay: 0.02 },
  { x: 100, y: -130, color: "bg-purple-500", delay: 0.08 },
  { x: 150, y: -160, color: "bg-pink-400", delay: 0.12 },
  { x: -120, y: -60, color: "bg-cyan-400", delay: 0.15 },
  { x: 120, y: -70, color: "bg-emerald-400", delay: 0.06 },
  { x: -60, y: -90, color: "bg-purple-400", delay: 0.18 },
  { x: 70, y: -100, color: "bg-indigo-400", delay: 0.14 },
];

const Burst: React.FC = () => (
  <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3">
    {CONFETTI.map((c, i) => (
      <span
        key={i}
        className={`rebus-confetti absolute block h-2.5 w-1.5 rounded-sm ${c.color}`}
        style={{ ["--x" as string]: `${c.x}px`, ["--y" as string]: `${c.y}px`, animationDelay: `${c.delay}s` }}
      />
    ))}
  </span>
);

const Side: React.FC<{ icon: React.ReactNode; name: string; points: number; result: "won" | "lost" | "tied" }> = ({ icon, name, points, result }) => {
  const { t } = useT();
  const won = result === "won";
  return (
    <div className={`relative flex flex-1 flex-col items-center gap-1 rounded-3xl border-2 px-3 pb-4 pt-6 transition-transform ${won ? "koda-celebrate -translate-y-1 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : result === "tied" ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40" : "border-line bg-white opacity-90 dark:bg-slate-900"}`}>
      {won && <Crown aria-hidden="true" className="koda-celebrate-icon absolute -top-4 h-8 w-8 text-emerald-600 dark:text-emerald-400" />}
      <span className={`flex h-14 w-14 items-center justify-center rounded-full ${won ? "koda-celebrate-icon bg-emerald-500 text-white" : "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300"} [&>svg]:h-7 [&>svg]:w-7`}>{icon}</span>
      <span className="text-4xl font-black leading-none text-ink">{points}</span>
      <span className="text-sm font-black text-ink">{name}</span>
      <span className={`text-xs font-bold ${won ? "text-emerald-700 dark:text-emerald-300" : "text-muted"}`}>{t(result === "won" ? "rebus.showWinner" : result === "tied" ? "rebus.showTied" : "rebus.showGoodTry")}</span>
    </div>
  );
};

export const Showdown: React.FC<ShowdownProps> = ({ you, machine }) => {
  const { t } = useT();
  const youResult = you > machine ? "won" : you < machine ? "lost" : "tied";
  const machineResult = machine > you ? "won" : machine < you ? "lost" : "tied";
  const headline = you > machine ? t("rebus.showYouWin") : you < machine ? t("rebus.showMachineWins") : t("rebus.showTie");

  return (
    <section aria-label={headline} className="relative flex flex-col items-center gap-3 overflow-visible">
      {youResult === "won" && <Burst />}
      <div className="flex items-center gap-2 text-center">
        {youResult === "tied" ? <Handshake aria-hidden="true" className="h-7 w-7 text-indigo-600" /> : <Trophy aria-hidden="true" className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />}
        <h2 role="status" className={themeSystem.typography("h2")}>
          {headline}
        </h2>
      </div>
      <div className="flex w-full items-stretch gap-3">
        <Side icon={<User />} name={t("rebus.you")} points={you} result={youResult} />
        <span className="flex items-center text-sm font-black text-muted">{t("rebus.versus")}</span>
        <Side icon={<Bot />} name={t("rebus.machineName")} points={machine} result={machineResult} />
      </div>
    </section>
  );
};
