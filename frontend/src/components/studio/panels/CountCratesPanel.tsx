/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ActorCastField, PanelProps } from "../panelKit";
import {
  COUNT_CRATES_LEVELS,
  CRATE_UNITS,
  normalizeCustomLevel,
  solveCountCrates,
  startingBoard,
  stockValue,
  type CountingTier,
  type CrateUnit,
} from "../../canvases/countCratesModel";

const TIER_GROUPS: Array<{ tier: CountingTier; label: string }> = [
  { tier: "beginner", label: "🟢 Beginner — count them out" },
  { tier: "apprentice", label: "🔵 Apprentice — count on from a group" },
  { tier: "advanced", label: "🟣 Advanced — fewest crates" },
  { tier: "master", label: "🟠 Master — open a crate" },
  { tier: "grandmaster", label: "🔴 Grandmaster — hundreds" },
];

export const CountCratesPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const config = (question.config as any) || {};
  const isCustom = !!config.cratesCustom;
  const stock: Partial<Record<CrateUnit, number>> = config.cratesStock || { 10: 3, 5: 2, 1: 9 };

  const preview = isCustom
    ? normalizeCustomLevel(config)
    : COUNT_CRATES_LEVELS.find((level) => level.id === config.levelId) || COUNT_CRATES_LEVELS[0];
  const solvable = !!solveCountCrates(startingBoard(preview), preview);

  const setConfig = (patch: Record<string, any>) =>
    update({ config: { ...config, ...patch } });

  const chooseLevel = (levelId: string) => {
    if (levelId === "custom") {
      setConfig({ cratesCustom: true, cratesStock: stock, orderTotal: preview.orderTotal });
      return;
    }
    const level = COUNT_CRATES_LEVELS.find((item) => item.id === levelId);
    if (!level) return;
    update({ targetCount: level.orderTotal, config: { ...config, levelId, cratesCustom: false } });
  };

  const field =
    "w-full text-xs p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg outline-none bg-white dark:bg-slate-800 font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-600";

  return (
    <div className="space-y-4 w-full max-w-full overflow-hidden text-slate-800 dark:text-slate-100">
      <div>
        <label className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          Curriculum Level
        </label>
        <select value={isCustom ? "custom" : preview.id} onChange={(e) => chooseLevel(e.target.value)} className={field}>
          {TIER_GROUPS.map(({ tier, label }) => {
            const levels = COUNT_CRATES_LEVELS.filter((level) => level.difficultyTier === tier);
            if (!levels.length) return null;
            return (
              <optgroup key={tier} label={label}>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name} — order {level.orderTotal}
                  </option>
                ))}
              </optgroup>
            );
          })}
          <optgroup label="⚙️ Custom">
            <option value="custom">🛠️ Build my own order</option>
          </optgroup>
        </select>
      </div>

      {isCustom && (
        <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-800/60 dark:bg-indigo-950/40">
          <div>
            <label className="mb-1 block text-[10px] font-bold text-slate-600 dark:text-slate-300">
              Order total ({preview.orderTotal})
            </label>
            <input
              type="number"
              min={1}
              max={120}
              value={config.orderTotal ?? preview.orderTotal}
              onChange={(e) => setConfig({ orderTotal: Number(e.target.value) })}
              className={field}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold text-slate-600 dark:text-slate-300">
              Crates on the shelf
            </label>
            <div className="grid grid-cols-4 gap-2">
              {CRATE_UNITS.map((unit) => (
                <div key={unit}>
                  <span className="mb-0.5 block text-center text-[10px] font-black">{unit}</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={stock[unit] ?? 0}
                    onChange={(e) => setConfig({ cratesStock: { ...stock, [unit]: Number(e.target.value) } })}
                    className={field}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-600 dark:text-slate-300">Constraint</label>
              <select
                value={config.cratesConstraint ?? "none"}
                onChange={(e) => setConfig({ cratesConstraint: e.target.value })}
                className={field}
              >
                <option value="none">No constraint</option>
                <option value="fewest">Fewest crates</option>
                <option value="exactly">Exactly N crates</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-600 dark:text-slate-300">
                Openings allowed
              </label>
              <input
                type="number"
                min={0}
                max={3}
                value={config.cratesOpensAllowed ?? 0}
                onChange={(e) => setConfig({ cratesOpensAllowed: Number(e.target.value) })}
                className={field}
              />
            </div>
          </div>

          {config.cratesConstraint === "exactly" && (
            <div>
              <label className="mb-1 block text-[10px] font-bold text-slate-600 dark:text-slate-300">
                Exactly how many crates
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={config.cratesExactly ?? 4}
                onChange={(e) => setConfig({ cratesExactly: Number(e.target.value) })}
                className={field}
              />
            </div>
          )}
        </div>
      )}

      {/* The one thing an author cannot see by looking: whether the board can be finished.
          The model settles it exhaustively, so this is an answer rather than a guess. */}
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-800/80">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-extrabold text-slate-700 dark:text-slate-300">Order</span>
          <span className="shrink-0 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-extrabold uppercase text-white">
            {preview.orderTotal} {preview.goodsEmoji}
          </span>
        </div>
        <p className="text-[11px] font-semibold leading-snug text-slate-600 dark:text-slate-300">
          {preview.teaches}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {preview.difficultyTier} · shelf holds {stockValue(preview.stock)} ·{" "}
          {preview.opensAllowed} opening{preview.opensAllowed === 1 ? "" : "s"}
        </p>
        <p className={`text-[10px] font-black uppercase ${solvable ? "text-emerald-600" : "text-rose-600"}`}>
          {solvable ? "✓ this order can be filled" : "✗ no way to fill this order — adjust the shelf"}
        </p>
      </div>

      {/* Who plays each moment of the question. */}
      <ActorCastField config={question.config} updateConfig={updateConfig} />
    </div>
  );
};
