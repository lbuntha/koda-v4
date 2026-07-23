import React from "react";
import { Label, Input, Button } from "../../ui";
import { PanelProps } from "../panelKit";
import { Plus, Trash2, Wand2, AlertTriangle } from "lucide-react";
import {
  buildColumnAdditionModel,
  generateChallenges,
  normaliseChallenges,
  describeColumnMode,
  clampAddend,
  ADDEND_MIN,
  ADDEND_MAX,
  ColumnChallenge,
} from "../../canvases/columnAdditionModel";

const MAX_CHALLENGES = 8;

export const ColumnAdditionPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const model = buildColumnAdditionModel(question.config?.num1 ?? 18, question.config?.num2 ?? 13);
  const { num1, num2, sum, anyCarry, digitMode } = model;

  const authored = normaliseChallenges(question.config?.columnChallenges);
  const isAuthored = authored.length > 0;
  const effective = isAuthored ? authored : generateChallenges(num1, num2);

  const setAddend = (key: "num1" | "num2", raw: string) => {
    const val = clampAddend(raw);
    const next = key === "num1" ? { num1: val, num2 } : { num1, num2: val };
    update({
      targetCount: next.num1 + next.num2,
      config: { ...question.config, [key]: val },
    });
  };

  const writeChallenges = (rows: ColumnChallenge[]) => updateConfig({ columnChallenges: rows });

  const patchChallenge = (index: number, key: "num1" | "num2", raw: string) => {
    // Editing a derived row promotes the whole derived set to authored, so the
    // other rows do not silently shift underneath the author.
    const base = effective.map(c => ({ ...c }));
    base[index] = { ...base[index], [key]: clampAddend(raw) };
    writeChallenges(base);
  };

  const addChallenge = () => {
    if (effective.length >= MAX_CHALLENGES) return;
    writeChallenges([...effective.map(c => ({ ...c })), { num1, num2 }]);
  };

  const removeChallenge = (index: number) => writeChallenges(effective.filter((_, i) => i !== index));
  const regenerate = () => writeChallenges(generateChallenges(num1, num2));
  const resetToAuto = () => updateConfig({ columnChallenges: undefined });

  return (
    <div className="space-y-4">
      {/* ── The authored problem ── */}
      <div className="space-y-3 bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 font-mono block">
          Column Addition Parameters
        </span>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>First Number ({ADDEND_MIN}–{ADDEND_MAX})</Label>
            <Input type="number" min={ADDEND_MIN} max={ADDEND_MAX} value={num1} onChange={e => setAddend("num1", e.target.value)} />
          </div>
          <div>
            <Label>Second Number ({ADDEND_MIN}–{ADDEND_MAX})</Label>
            <Input type="number" min={ADDEND_MIN} max={ADDEND_MAX} value={num2} onChange={e => setAddend("num2", e.target.value)} />
          </div>
        </div>

        {/* Live read-out of what the canvas will teach for these numbers */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
            {describeColumnMode(digitMode)}
          </span>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            anyCarry ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}>
            {anyCarry ? `Carries ×${model.carryCount}` : "No regrouping"}
          </span>
          <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 font-mono">
            {num1} + {num2} = {sum}
          </span>
        </div>

        <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
          The student fills one box per column, right to left. After two wrong checks the tutor offers an animated
          walkthrough that carries across columns — also available any time via <strong>Show me how</strong>.
        </p>
      </div>

      {/* ── Practice challenges ── */}
      <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 font-mono block">
            Practice Problems
          </span>
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            isAuthored ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-white text-slate-500 border-slate-200"
          }`}>
            {isAuthored ? "Custom" : "Auto"}
          </span>
        </div>

        <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
          Practised after the first problem. Leave as <strong>Auto</strong> to derive problems matching this one's
          digit shape and carrying, or edit any row to pin your own set before publishing.
        </p>

        <div className="space-y-2">
          {effective.map((c, i) => {
            const rowModel = buildColumnAdditionModel(c.num1, c.num2);
            const mismatched = rowModel.anyCarry !== anyCarry || rowModel.digitMode !== digitMode;
            return (
              <div key={i} className="flex items-center gap-1.5 bg-white p-2 rounded-lg border border-slate-200">
                <span className="text-[9px] font-black text-slate-400 w-4 shrink-0">{i + 1}</span>
                <Input type="number" min={ADDEND_MIN} max={ADDEND_MAX} value={c.num1} onChange={e => patchChallenge(i, "num1", e.target.value)} className="h-8 px-1 min-w-0 text-center text-xs" />
                <span className="text-xs font-bold text-slate-400 shrink-0">+</span>
                <Input type="number" min={ADDEND_MIN} max={ADDEND_MAX} value={c.num2} onChange={e => patchChallenge(i, "num2", e.target.value)} className="h-8 px-1 min-w-0 text-center text-xs" />
                <span className="text-xs font-bold text-slate-400 shrink-0">=</span>
                <span className="text-xs font-black text-indigo-700 font-mono w-9 text-center shrink-0">{rowModel.sum}</span>
                {mismatched && (
                  <span
                    title={`This problem is ${describeColumnMode(rowModel.digitMode)} and ${rowModel.anyCarry ? "carries" : "does not carry"} — it rehearses a different skill than the lesson.`}
                    className="text-amber-500 shrink-0"
                  >
                    <AlertTriangle size={12} />
                  </span>
                )}
                <button onClick={() => removeChallenge(i)} aria-label={`Remove problem ${i + 1}`} className="text-slate-300 hover:text-rose-500 transition-colors cursor-pointer shrink-0 p-0.5">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}

          {effective.length === 0 && (
            <p className="text-[10px] text-slate-400 font-semibold italic py-1">
              No extra problems — the student practises only the first one.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={addChallenge} disabled={effective.length >= MAX_CHALLENGES} className="flex-1 text-[10px] font-bold py-1.5 flex items-center justify-center gap-1">
            <Plus size={11} /> Add
          </Button>
          <Button variant="outline" onClick={regenerate} className="flex-1 text-[10px] font-bold py-1.5 flex items-center justify-center gap-1">
            <Wand2 size={11} /> Suggest
          </Button>
          {isAuthored && (
            <Button variant="ghost" onClick={resetToAuto} className="text-[10px] font-bold py-1.5">Reset</Button>
          )}
        </div>
      </div>
    </div>
  );
};
