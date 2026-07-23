import React from "react";
import { Label, Input } from "../../ui";
import { PanelProps } from "../panelKit";
import {
  buildColumnAdditionModel,
  describeColumnMode,
  clampAddend,
  ADDEND_MIN,
  ADDEND_MAX,
} from "../../canvases/columnAdditionModel";

export const ColumnAdditionPanel: React.FC<PanelProps> = ({ question, update }) => {
  const model = buildColumnAdditionModel(question.config?.num1 ?? 18, question.config?.num2 ?? 13);
  const { num1, num2, sum, anyCarry, carryCount, digitMode } = model;

  const setAddend = (key: "num1" | "num2", raw: string) => {
    const val = clampAddend(raw);
    const next = key === "num1" ? { num1: val, num2 } : { num1, num2: val };
    update({
      targetCount: next.num1 + next.num2,
      config: { ...question.config, [key]: val },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
        <span className="koda-admin-chip block text-[#534AB7]">
          Column Addition Parameters
        </span>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>First Number ({ADDEND_MIN}–{ADDEND_MAX.toLocaleString()})</Label>
            <Input type="number" min={ADDEND_MIN} max={ADDEND_MAX} value={num1} onChange={e => setAddend("num1", e.target.value)} />
          </div>
          <div>
            <Label>Second Number ({ADDEND_MIN}–{ADDEND_MAX.toLocaleString()})</Label>
            <Input type="number" min={ADDEND_MIN} max={ADDEND_MAX} value={num2} onChange={e => setAddend("num2", e.target.value)} />
          </div>
        </div>

        {/* Live read-out of what the canvas will teach for these numbers */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="koda-admin-chip rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-indigo-700">
            {describeColumnMode(digitMode)}
          </span>
          <span className={`koda-admin-chip rounded-full border px-2 py-0.5 ${
            anyCarry ? "bg-rose-50 text-rose-600 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}>
            {anyCarry ? `Carries ×${carryCount}` : "No regrouping"}
          </span>
          <span className="koda-admin-chip rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">
            {num1.toLocaleString()} + {num2.toLocaleString()} = {sum.toLocaleString()}
          </span>
        </div>

        <div className="rounded-xl border border-[#E7E3F6] bg-white p-3">
          <p className="koda-admin-label text-[#0E0B55]">How the student works</p>
          <ol className="mt-1.5 space-y-1 text-[10px] leading-relaxed text-[#6D6997]">
            <li><strong>1.</strong> Start with the ones column on the right.</li>
            <li><strong>2.</strong> Write the answer digit; when the total reaches 10, carry 1 into the next place.</li>
            <li><strong>3.</strong> Continue left through tens, hundreds, thousands, and ten-thousands.</li>
          </ol>
          <p className="mt-2 text-[10px] leading-relaxed text-[#6D6997]">
            After two incorrect checks, Koda offers a narrated column-by-column walkthrough. One question card contains one problem.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Instruction (spoken by Koda)</Label>
        <Input
          value={question.instruction ?? ""}
          onChange={e => update({ instruction: e.target.value })}
          placeholder={`Add ${num1} and ${num2}, one column at a time.`}
        />
        <p className="text-[10px] text-slate-400 font-semibold">
          Optional. By default Koda greets with a line built from the numbers. Type an addition instruction here to
          override it — a leftover counting line ("Tap each item to count…") is ignored so the greeting stays relevant.
        </p>
      </div>
    </div>
  );
};
