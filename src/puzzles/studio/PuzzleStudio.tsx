/**
 * Puzzle Studio: the words behind the daily Word Guess.
 *
 * Staff only (`content:write`). The Koda owner adds, publishes and retires
 * words and can choose a day's word; a Content creator — a teacher — adds
 * their own words and sends them for review. Children only ever see live words.
 */

import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardCheck, Puzzle, TriangleAlert } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader, UIStatGrid, UIStatTile, UITabs } from "../../components/ui";
import { messageOf } from "../../rebus/studio/useStudioAction";
import { CalendarPanel, LOW_DAYS } from "./CalendarPanel";
import { WordForm } from "./WordForm";
import { WordList } from "./WordList";
import { PuzzleStudioAPI, type Overview } from "./studioApi";

type Tab = "add" | "review" | "words" | "calendar";

/** The line closest to running out of new words. */
const fewestDays = (o: Overview): number => {
  const left = o.lines.filter((l) => (l.byStatus.published ?? 0) > 0).map((l) => l.newDaysLeft);
  return left.length ? Math.min(...left) : 0;
};

export const PuzzleStudio: React.FC = () => {
  const { t } = useT();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [error, setError] = useState("");
  const [listKey, setListKey] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setOverview(await PuzzleStudioAPI.overview());
      setError("");
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canRun = overview?.canRun ?? false;
  const sum = (s: "published" | "review" | "draft") => overview?.lines.reduce((n, l) => n + (l.byStatus[s] ?? 0), 0) ?? 0;
  const low = (overview?.lines ?? []).filter((l) => (l.byStatus.published ?? 0) > 0 && l.newDaysLeft < LOW_DAYS);
  const shown: Tab = tab ?? (canRun && sum("review") > 0 ? "review" : "add");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <UISectionHeader title={t("puzzleStudio.title")} subtitle={t("puzzleStudio.subtitle")} icon={<Puzzle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />} />

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}

      <UIStatGrid>
        <UIStatTile icon={<CheckCircle2 />} value={overview ? sum("published") : "—"} label={t("puzzleStudio.statLive")} tone="success" onClick={() => setTab("words")} />
        <UIStatTile icon={<ClipboardCheck />} value={overview ? sum("review") : "—"} label={t("puzzleStudio.statReview")} tone="primary" onClick={() => setTab("review")} />
        <UIStatTile icon={<Puzzle />} value={overview ? sum("draft") : "—"} label={t("puzzleStudio.statDrafts")} tone="primary" onClick={() => setTab("words")} />
        <UIStatTile
          icon={low.length ? <TriangleAlert /> : <CalendarDays />}
          value={overview ? fewestDays(overview) : "—"}
          label={t("puzzleStudio.statDaysLeft")}
          tone={low.length ? "danger" : "success"}
          onClick={() => setTab("calendar")}
        />
      </UIStatGrid>

      {low.length > 0 && canRun && (
        <p className={themeSystem.flash("warning")}>
          {t("puzzleStudio.lowLines", {
            lines: low.map((l) => `${l.lang === "km" ? "ខ្មែរ" : "English"} ${t("puzzleStudio.nTiles", { n: String(l.level) })} (${l.newDaysLeft})`).join(", "),
          })}
        </p>
      )}

      <UITabs
        label={t("puzzleStudio.title")}
        items={[
          { id: "add", label: t("puzzleStudio.tabAdd") },
          { id: "review", label: canRun ? t("puzzleStudio.tabReview") : t("puzzleStudio.tabMine"), count: canRun ? sum("review") : undefined },
          { id: "words", label: t("puzzleStudio.tabWords") },
          { id: "calendar", label: t("puzzleStudio.tabCalendar") },
        ]}
        value={shown}
        onChange={(id) => setTab(id as Tab)}
      />

      {shown === "add" && (
        <>
          <p className="text-sm text-body">{canRun ? t("puzzleStudio.addIntroOwner") : t("puzzleStudio.addIntroCreator")}</p>
          <WordForm
            canRun={canRun}
            onSaved={() => {
              void refresh();
              setListKey((k) => k + 1);
            }}
          />
        </>
      )}
      {shown === "review" && <WordList key={`r${listKey}`} canRun={canRun} initialStatus={canRun ? "review" : ""} onChanged={() => void refresh()} />}
      {shown === "words" && <WordList key={`w${listKey}`} canRun={canRun} onChanged={() => void refresh()} />}
      {shown === "calendar" && overview && <CalendarPanel lines={overview.lines.filter((l) => (l.byStatus.published ?? 0) > 0)} canRun={canRun} onChanged={() => void refresh()} />}
    </div>
  );
};
