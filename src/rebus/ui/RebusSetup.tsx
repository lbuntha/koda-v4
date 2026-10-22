/**
 * Choose a topic, then confirm how to play it.
 *
 * Two short screens instead of one long one, which suits a phone: tapping a
 * topic goes straight to the options for it (how many, which puzzles, how hard
 * the Machine is), and Play starts. The topic comes first because it is the one
 * a child cares about. What the owner has fixed (the Machine's level) is shown as a
 * fact rather than a choice, so nobody taps something that does nothing.
 */

import React, { useMemo, useState } from "react";
import { ArrowLeft, Hand, Play, Users } from "lucide-react";
import { useT } from "../../lib/i18n";
import { themeSystem } from "../../lib/themeSystem";
import { UIBadge, UIButton, UIProgressBar, UITabs } from "../../components/ui";
import { cue } from "../sound";
import { loadAutoNext, saveAutoNext } from "../prefs";
import { categoryLabel } from "../categoryNames";
import type { MachineLevel } from "../machine";
import type { RebusSettings } from "../settings";
import { useRebusCategories, type RebusBank } from "../bank";
import type { CategoryId, Difficulty } from "../types";
import { filterPuzzles } from "../round";
import type { Results, StatusFilter } from "../results";

export interface RebusChoice {
  category: CategoryId | "mixed";
  count: number;
  level: MachineLevel | "adaptive";
  /** Play every matching puzzle, in rounds of `count`, instead of a random few. */
  all: boolean;
  difficulty: Difficulty | null;
  status: StatusFilter;
  /** Move to the next puzzle by themselves, instead of waiting to be tapped. */
  autoNext: boolean;
}

export interface RebusSetupProps {
  bank: RebusBank;
  settings: RebusSettings;
  /** How each puzzle went last time, for the history filter. */
  results?: Results;
  onStart(choice: RebusChoice): void;
  /** Open the group-play door: open a room, or join one with a code. */
  onGroup?(): void;
  /** Take turns on this device: no internet needed. */
  onTurns?(): void;
  onBack?(): void;
}

const LEVEL_KEYS = ["easy", "medium", "hard"] as const;
const STATUS_KEYS: readonly StatusFilter[] = ["all", "new", "retry", "clean"];

export const RebusSetup: React.FC<RebusSetupProps> = ({ bank, settings, results = {}, onStart, onGroup, onTurns, onBack }) => {
  const { t } = useT();
  const total = bank.puzzles.length;
  const cats = useRebusCategories();
  const firstWithPuzzles = cats.find((c) => (bank.counts[c.id] ?? 0) > 0)?.id ?? "mixed";
  const [category, setCategory] = useState<CategoryId | "mixed">(firstWithPuzzles);
  const [count, setCount] = useState<number>(settings.questionChoices[0] ?? 5);
  const [level, setLevel] = useState<MachineLevel | "adaptive">("adaptive");
  const [step, setStep] = useState<"topic" | "options">("topic");
  const [all, setAll] = useState(false);
  const [autoNext, setAutoNext] = useState(loadAutoNext);
  const [filtering, setFiltering] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");

  // How much of each topic this child has played, so working through everything can be seen.
  const played = useMemo(() => {
    const by: Record<string, { done: number; total: number }> = {};
    for (const p of filterPuzzles(bank.puzzles, { category: "mixed" })) {
      for (const key of [p.category, "mixed"]) {
        const row = (by[key] ??= { done: 0, total: 0 });
        row.total += 1;
        if (results[p.id]) row.done += 1;
      }
    }
    return by;
  }, [bank.puzzles, results]);

  const available = useMemo(() => filterPuzzles(bank.puzzles, { category, difficulty, status, results }).length, [bank.puzzles, category, difficulty, status, results]);
  const filtered = difficulty !== null || status !== "all";
  const lock = settings.machineLock;

  const levelItems = [
    ...LEVEL_KEYS.map((key, i) => ({
      id: String(i),
      label: t(`rebus.level.${key}`),
    })),
    { id: "adaptive", label: t("rebus.level.adaptive") },
  ];

  const topicName = category === "mixed" ? t("rebus.mixed") : categoryLabel(category);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-20">
      {(onBack || step === "options") && (
        <div>
          <UIButton variant="ghost" size="sm" icon={<ArrowLeft />} onClick={step === "options" ? () => setStep("topic") : onBack}>
            {step === "options" ? t("rebus.changeTopic") : t("rebus.back")}
          </UIButton>
        </div>
      )}

      <div>
        <h2 className={themeSystem.typography("h2")}>{t("rebus.title")}</h2>
        <p className={themeSystem.typography("subtitle")}>{t("rebus.tagline")}</p>
      </div>

      {step === "topic" && (
        <>
          <section aria-labelledby="rebus-topic" className={themeSystem.spacing.stack}>
            <h3 id="rebus-topic" className={themeSystem.typography("h4")}>
              {t("rebus.chooseTopic")}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ...cats.map((c) => ({
                  id: c.id as CategoryId | "mixed",
                  name: categoryLabel(c.id),
                  n: bank.counts[c.id] ?? 0,
                })),
                { id: "mixed" as const, name: t("rebus.mixed"), n: total },
              ].map(({ id, name, n }) => {
                const empty = n === 0;
                const selected = id === category;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={empty}
                    aria-pressed={selected}
                    onClick={() => {
                      cue("pick");
                      setCategory(id);
                      setStep("options");
                    }}
                    className={themeSystem.card(
                      empty ? "default" : "interactive",
                      `flex items-center justify-between gap-3 px-4 py-3 text-left pointer-coarse:min-h-14 disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "!border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-800" : ""}`,
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <span className="text-base font-black text-ink">{name}</span>
                      {!empty && played[id] && (
                        <UIProgressBar
                          value={played[id].done}
                          max={played[id].total}
                          size="sm"
                          tone="emerald"
                          label={t("rebus.playedOf", { done: played[id].done, total: played[id].total })}
                          caption={t("rebus.playedOf", { done: played[id].done, total: played[id].total })}
                        />
                      )}
                    </span>
                    <UIBadge variant={empty ? "neutral" : selected ? "primary" : "info"}>{empty ? t("rebus.soon") : t("rebus.puzzlesCount", { count: n })}</UIBadge>
                  </button>
                );
              })}
            </div>
          </section>
          {onGroup && (
            <UIButton variant="secondary" size="lg" fullWidth icon={<Users />} onClick={onGroup}>
              {t("rebus.group.playWithFriends")}
            </UIButton>
          )}
          {onTurns && (
            <UIButton variant="secondary" size="lg" fullWidth icon={<Hand />} onClick={onTurns}>
              {t("rebus.turns.openCard")}
            </UIButton>
          )}
        </>
      )}

      {step === "options" && (
        <>
          <p className={themeSystem.typography("h3")}>{topicName}</p>

          <section className={themeSystem.spacing.stack}>
            <h3 className={themeSystem.typography("h4")}>{t("rebus.questions")}</h3>
            <UITabs
              label={t("rebus.questions")}
              items={[
                ...settings.questionChoices.map((n) => ({
                  id: String(n),
                  label: String(n),
                })),
                { id: "all", label: t("rebus.allCount", { count: available }) },
              ]}
              value={all ? "all" : String(count)}
              onChange={(id) => {
                cue("pick");
                if (id === "all") setAll(true);
                else {
                  setAll(false);
                  setCount(Number(id));
                }
              }}
            />
            {all && (
              <p className={themeSystem.typography("caption")}>
                {t("rebus.allHint", {
                  count: settings.questionChoices[settings.questionChoices.length - 1] ?? 10,
                })}
              </p>
            )}
            {!all && available > 0 && available < count && <p className={themeSystem.typography("caption")}>{t("rebus.onlyFew", { count: available })}</p>}

            <div>
              <UIButton variant="ghost" size="sm" aria-expanded={filtering} onClick={() => setFiltering((v) => !v)}>
                {filtering ? t("rebus.filterClose") : t("rebus.filterOpen")}
              </UIButton>
            </div>
            {filtering && (
              <div className={themeSystem.spacing.stack}>
                <UITabs
                  label={t("rebus.filterLevel")}
                  items={[
                    { id: "0", label: t("rebus.anyLevel") },
                    ...LEVEL_KEYS.map((key, i) => ({
                      id: String(i + 1),
                      label: t(`rebus.level.${key}`),
                    })),
                  ]}
                  value={String(difficulty ?? 0)}
                  onChange={(id) => {
                    cue("pick");
                    setDifficulty(id === "0" ? null : (Number(id) as Difficulty));
                  }}
                />
                <UITabs
                  label={t("rebus.filterStatus")}
                  items={STATUS_KEYS.map((key) => ({
                    id: key,
                    label: t(`rebus.status.${key}`),
                  }))}
                  value={status}
                  onChange={(id) => {
                    cue("pick");
                    setStatus(id as StatusFilter);
                  }}
                />
              </div>
            )}
            {filtered && <p className={themeSystem.typography("caption")}>{available > 0 ? t("rebus.matching", { count: available }) : t("rebus.noMatch")}</p>}
          </section>

          <section className={themeSystem.spacing.stack}>
            <h3 className={themeSystem.typography("h4")}>{t("rebus.afterEach")}</h3>
            <UITabs
              label={t("rebus.afterEach")}
              items={[
                { id: "manual", label: t("rebus.nextManual") },
                { id: "auto", label: t("rebus.nextAuto") },
              ]}
              value={autoNext ? "auto" : "manual"}
              onChange={(id) => {
                cue("pick");
                setAutoNext(id === "auto");
                saveAutoNext(id === "auto");
              }}
            />
          </section>

          <section className={themeSystem.spacing.stack}>
            <h3 className={themeSystem.typography("h4")}>{t("rebus.machine")}</h3>
            {lock === "free" ? (
              <UITabs
                label={t("rebus.machine")}
                items={levelItems}
                value={String(level)}
                onChange={(id) => {
                  cue("pick");
                  setLevel(id === "adaptive" ? "adaptive" : (Number(id) as MachineLevel));
                }}
              />
            ) : (
              <UIBadge variant="neutral">{t(`rebus.level.${LEVEL_KEYS[lock]}`)}</UIBadge>
            )}
          </section>

          <UIButton
            size="lg"
            fullWidth
            icon={<Play />}
            disabled={available === 0}
            onClick={() =>
              onStart({
                category,
                count,
                level: lock === "free" ? level : lock,
                all,
                autoNext,
                difficulty,
                status,
              })
            }
          >
            {t("rebus.start")}
          </UIButton>
        </>
      )}
    </div>
  );
};
