/**
 * Group play in numbers, for the owner.
 *
 * The server counts as games happen and keeps only totals per day: no names,
 * room codes, answers or anything about a child. A room is deleted two hours
 * after it opens, so this is the only record there is of how group play is used.
 */

import React, { useEffect, useState } from "react";
import { DoorOpen, Flag, Play, RotateCcw, UserPlus, Users } from "lucide-react";
import { useT } from "../../lib/i18n";
import { accessToken, request } from "../../lib/sync";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIStatTile, UITabs } from "../../components/ui";

interface Day {
  day: string;
  roomsOpened: number;
  requests: number;
  seatsKoda: number;
  seatsGuest: number;
  gamesStarted: number;
  playersStarted: number;
  gamesFinished: number;
  rematches: number;
  askedGrownUp: number;
}

export interface GroupReportData {
  days: number;
  rows: Day[];
  totals: Omit<Day, "day">;
}

const RANGES = [7, 30] as const;

export const GroupReport: React.FC = () => {
  const { t } = useT();
  const [days, setDays] = useState<number>(7);
  const [data, setData] = useState<GroupReportData | null>(null);
  const [failed, setFailed] = useState(false);
  // Fetched only when the owner asks, so opening Admin never waits on it.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!shown) return;
    let active = true;
    setFailed(false);
    void (async () => {
      try {
        const next = await request<GroupReportData>(`/rebus/rooms/report/summary?days=${days}`, { token: await accessToken() });
        if (!active) return;
        if (Array.isArray(next?.rows) && next.totals) setData(next);
        else setFailed(true);
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [days, shown]);

  const totals = data?.totals;
  const seated = totals ? totals.seatsKoda + totals.seatsGuest : 0;
  const busy = data?.rows.filter((r) => r.roomsOpened + r.requests + r.gamesStarted > 0).reverse() ?? [];

  return (
    <section className="space-y-3 border-t border-line pt-4" aria-label={t("rebus.admin.report.title")}>
      <div>
        <h4 className={themeSystem.typography("h4")}>{t("rebus.admin.report.title")}</h4>
        <p className={themeSystem.typography("caption")}>{t("rebus.admin.report.hint")}</p>
      </div>
      {!shown && (
        <UIButton variant="secondary" onClick={() => setShown(true)}>
          {t("rebus.admin.report.show")}
        </UIButton>
      )}
      {shown && <UITabs label={t("rebus.admin.report.range")} items={RANGES.map((n) => ({ id: String(n), label: t("rebus.admin.report.lastDays", { n }) }))} value={String(days)} onChange={(id) => setDays(Number(id))} />}

      {failed && (
        <p role="alert" className={themeSystem.flash("error")}>
          {t("rebus.admin.report.failed")}
        </p>
      )}

      {totals && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <UIStatTile icon={<DoorOpen />} value={totals.roomsOpened} label={t("rebus.admin.report.rooms")} />
            <UIStatTile icon={<Play />} tone="success" value={totals.gamesStarted} label={t("rebus.admin.report.started")} />
            <UIStatTile icon={<Flag />} tone="success" value={totals.gamesFinished} label={t("rebus.admin.report.finished")} />
            <UIStatTile icon={<Users />} value={seated} label={t("rebus.admin.report.players", { guests: totals.seatsGuest })} />
            <UIStatTile icon={<RotateCcw />} value={totals.rematches} label={t("rebus.admin.report.rematches")} />
            <UIStatTile icon={<UserPlus />} value={totals.askedGrownUp} label={t("rebus.admin.report.asked")} />
          </div>

          {busy.length === 0 ? (
            <p className={themeSystem.typography("body-sm")}>{t("rebus.admin.report.none")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="text-muted">
                    <th className="py-1 pr-3 font-bold">{t("rebus.admin.report.day")}</th>
                    <th className="px-2 font-bold">{t("rebus.admin.report.rooms")}</th>
                    <th className="px-2 font-bold">{t("rebus.admin.report.started")}</th>
                    <th className="px-2 font-bold">{t("rebus.admin.report.finished")}</th>
                    <th className="px-2 font-bold">{t("rebus.admin.report.guestSeats")}</th>
                    <th className="px-2 font-bold">{t("rebus.admin.report.askedShort")}</th>
                  </tr>
                </thead>
                <tbody>
                  {busy.map((r) => (
                    <tr key={r.day} className="border-t border-line text-ink">
                      <td className="py-1 pr-3 font-bold">{r.day}</td>
                      <td className="px-2">{r.roomsOpened}</td>
                      <td className="px-2">{r.gamesStarted}</td>
                      <td className="px-2">{r.gamesFinished}</td>
                      <td className="px-2">{r.seatsGuest}</td>
                      <td className="px-2">{r.askedGrownUp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};
