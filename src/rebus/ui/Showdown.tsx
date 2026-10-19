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
import { UIBurst } from "../../components/ui";

export interface ShowdownProps {
  you: number;
  machine: number;
}

const Side: React.FC<{ icon: React.ReactNode; name: string; points: number; result: "won" | "lost" | "tied" }> = ({ icon, name, points, result }) => {
  const { t } = useT();
  const won = result === "won";
  return (
    <div className={`relative flex flex-1 flex-col items-center gap-1 rounded-3xl border-2 px-3 pb-4 pt-11 transition-transform ${won ? "koda-celebrate -translate-y-1 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : result === "tied" ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40" : "border-line bg-white opacity-90 dark:bg-slate-900"}`}>
      {won && (
        // Centred by its box, not by a transform: the pop animation owns the icon's transform.
        <span aria-hidden="true" className="absolute inset-x-0 top-2 flex justify-center">
          <Crown className="koda-celebrate-icon h-7 w-7 text-emerald-600 dark:text-emerald-400" />
        </span>
      )}
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
      {youResult === "won" && <UIBurst />}
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
