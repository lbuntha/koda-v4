/**
 * How the round went. Said kindly either way, with four numbers a parent would
 * also care about: puzzles solved, hints used, average time, and points.
 */

import React from "react";
import { CheckCircle2, Lightbulb, Timer, Trophy } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIButton, UIKidMessage, UIStatGrid, UIStatTile } from "../../components/ui";
import { Showdown } from "./Showdown";
import type { RebusReward } from "../reward";
import { averageSeconds, type RoundScore } from "../scoring";

export interface RebusSummaryProps {
  score: RoundScore;
  /** What the round earned in XP, once it is paid. */
  earned?: RebusReward | null;
  /** Every puzzle was played before, so no XP was paid. */
  replay?: boolean;
  /** Play all: how many matching puzzles there are, and how many are still to play. Missing in a random round. */
  pass?: { total: number; remaining: number; retry: number };
  onAgain(): void;
  /** Play all: replay the whole set, or only what needs another try. */
  onReplayAll?(): void;
  onRetry?(): void;
  onChangeTopic(): void;
}

export const RebusSummary: React.FC<RebusSummaryProps> = ({ score, earned, replay, pass, onAgain, onReplayAll, onRetry, onChangeTopic }) => {
  const { t } = useT();
  const finished = pass !== undefined && pass.remaining === 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 pb-20">
      <Showdown you={score.child} machine={score.machine} />

      {earned && earned.xp > 0 && (
        <UIKidMessage tone="celebrate" title={t("rebus.xpTitle")} message={t("rebus.xpText", { xp: earned.xp })} xpEarned={earned.xp} />
      )}

      {replay && <p className={themeSystem.typography("caption", "text-center")}>{t("rebus.replayNoXp")}</p>}

      {pass && <p className={themeSystem.typography("body-sm", "text-center")}>{finished ? t("rebus.finishedAll", { total: pass.total }) : t("rebus.passProgress", { done: pass.total - pass.remaining, total: pass.total })}</p>}

      <UIStatGrid>
        <UIStatTile icon={<CheckCircle2 />} value={`${score.solved}/${score.puzzles}`} label={t("rebus.solved")} tone="success" />
        <UIStatTile icon={<Lightbulb />} value={score.hintsUsed} label={t("rebus.hintsUsed")} tone="primary" />
        <UIStatTile icon={<Timer />} value={t("rebus.seconds", { seconds: Math.round(averageSeconds(score)) })} label={t("rebus.avgTime")} tone="primary" />
        <UIStatTile icon={<Trophy />} value={score.child} label={t("rebus.points")} tone="streak" />
      </UIStatGrid>

      <div className={`${themeSystem.spacing.stack} flex flex-col`}>
        {pass && !finished && (
          <UIButton size="lg" fullWidth onClick={onAgain}>
            {t("rebus.continueLeft", { count: pass.remaining })}
          </UIButton>
        )}
        {pass && finished && onReplayAll && (
          <UIButton size="lg" fullWidth onClick={onReplayAll}>
            {t("rebus.replayAll")}
          </UIButton>
        )}
        {pass && finished && onRetry && pass.retry > 0 && (
          <UIButton variant="secondary" fullWidth onClick={onRetry}>
            {t("rebus.playRetry", { count: pass.retry })}
          </UIButton>
        )}
        {!pass && (
          <UIButton size="lg" fullWidth onClick={onAgain}>
            {t("rebus.playAgain")}
          </UIButton>
        )}
        <UIButton variant="secondary" fullWidth onClick={onChangeTopic}>
          {t("rebus.changeTopic")}
        </UIButton>
      </div>
    </div>
  );
};
