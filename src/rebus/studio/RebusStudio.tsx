/**
 * Rebus Studio: where puzzles are reviewed, written and published.
 *
 * Staff only (`content:write`, like Art and the Library Studio). Every puzzle
 * follows one flow: drafted (the seed file, a person, a model), checked and
 * approved, then published in a release that can be taken back. Children only
 * ever see published puzzles.
 */

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, EyeOff, Rocket } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UISectionHeader, UIStatGrid, UIStatTile, UITabs } from "../../components/ui";
import { CategoriesPanel } from "./CategoriesPanel";
import { DrawingsPanel } from "./DrawingsPanel";
import { CreatePanel } from "./CreatePanel";
import { PublishPanel } from "./PublishPanel";
import { PuzzleList } from "./PuzzleList";
import { ReviewQueue } from "./ReviewQueue";
import { StudioAPI, type Overview } from "./studioApi";
import { messageOf } from "./useStudioAction";

type Tab = "create" | "review" | "publish" | "puzzles" | "categories" | "drawings";

export const RebusStudio: React.FC = () => {
  const { t } = useT();
  const [tab, setTab] = useState<Tab | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setOverview(await StudioAPI.overview());
      setError("");
    } catch (e) {
      setError(messageOf(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Open on what needs doing: review when drafts are waiting, otherwise make something.
  const shown: Tab = tab ?? (overview === null ? "review" : overview.byStatus.draft > 0 ? "review" : "create");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <UISectionHeader title={t("rebus.studio.title")} subtitle={t("rebus.studio.subtitle")} icon={<ClipboardCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />} />

      {error && (
        <p role="alert" className={themeSystem.flash("error")}>
          {error}
        </p>
      )}

      <UIStatGrid>
        <UIStatTile icon={<CheckCircle2 />} value={overview?.byStatus.published ?? "—"} label={t("rebus.studio.statLive")} tone="success" />
        <UIStatTile icon={<ClipboardCheck />} value={overview?.byStatus.draft ?? "—"} label={t("rebus.studio.statToReview")} tone="primary" onClick={() => setTab("review")} />
        <UIStatTile icon={<Rocket />} value={overview?.byStatus.approved ?? "—"} label={t("rebus.studio.statWaiting")} tone="primary" onClick={() => setTab("publish")} />
        <UIStatTile icon={<EyeOff />} value={overview?.byStatus.retired ?? "—"} label={t("rebus.studio.statRetired")} tone="danger" />
      </UIStatGrid>

      <UITabs
        label={t("rebus.studio.title")}
        items={[
          { id: "create", label: t("rebus.studio.tabCreate") },
          { id: "review", label: t("rebus.studio.tabReview"), count: overview?.byStatus.draft },
          { id: "publish", label: t("rebus.studio.tabPublish"), count: overview?.byStatus.approved },
          { id: "puzzles", label: t("rebus.studio.tabPuzzles") },
          { id: "categories", label: t("rebus.studio.tabCategories") },
          { id: "drawings", label: t("rebus.studio.tabDrawings") },
        ]}
        value={shown}
        onChange={(id) => setTab(id as Tab)}
      />

      {shown === "create" && <CreatePanel onChanged={() => void refresh()} />}
      {shown === "review" && <ReviewQueue overview={overview} onChanged={() => void refresh()} />}
      {shown === "puzzles" && <PuzzleList onChanged={() => void refresh()} />}
      {shown === "categories" && <CategoriesPanel />}
      {shown === "drawings" && <DrawingsPanel />}
      {shown === "publish" && <PublishPanel onChanged={() => void refresh()} />}
    </div>
  );
};
