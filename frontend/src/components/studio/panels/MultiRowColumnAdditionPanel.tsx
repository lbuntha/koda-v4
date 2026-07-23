import React from "react";
import { Input, Label } from "../../ui";
import { PanelProps } from "../panelKit";
import {
  ADDEND_MAX,
  ADDEND_MIN,
  buildColumnAdditionModel,
  clampAddend,
  describeColumnMode,
} from "../../canvases/columnAdditionModel";

export const MultiRowColumnAdditionPanel: React.FC<PanelProps> = ({ question, update }) => {
  const model = buildColumnAdditionModel(
    question.config?.num1 ?? 268,
    question.config?.num2 ?? 175,
    question.config?.num3 ?? 349,
  );
  const addends = [model.num1, model.num2, model.num3 ?? 0];

  const setAddend = (index: number, raw: string) => {
    const next = [...addends];
    next[index] = clampAddend(raw);
    update({
      targetCount: next[0] + next[1] + next[2],
      config: {
        ...question.config,
        num1: next[0],
        num2: next[1],
        num3: next[2],
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
        <span className="koda-admin-chip block text-[#534AB7]">Three-Row Addition Parameters</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {addends.map((value, index) => (
            <div key={index}>
              <Label>Row {index + 1}</Label>
              <Input
                type="number"
                min={ADDEND_MIN}
                max={ADDEND_MAX}
                value={value}
                onChange={event => setAddend(index, event.target.value)}
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] font-medium text-[#6D6997]">
          Each row supports {ADDEND_MIN}–{ADDEND_MAX.toLocaleString()}.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <MetaChip>{describeColumnMode(model.digitMode)}</MetaChip>
          <MetaChip className={model.anyCarry ? "border-rose-200 bg-rose-50 text-rose-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
            {model.anyCarry ? `Carries ×${model.carryCount}` : "No regrouping"}
          </MetaChip>
          <MetaChip>{addends.map(value => value.toLocaleString()).join(" + ")} = {model.sum.toLocaleString()}</MetaChip>
        </div>
        <div className="rounded-xl border border-[#E7E3F6] bg-white p-3">
          <p className="koda-admin-label text-[#0E0B55]">How the student works</p>
          <ol className="mt-1.5 space-y-1 text-[10px] leading-relaxed text-[#6D6997]">
            <li><strong>1.</strong> Add all three digits in the ones column.</li>
            <li><strong>2.</strong> Write the ones digit and carry the remaining tens; the carry may be 1 or 2.</li>
            <li><strong>3.</strong> Repeat through tens, hundreds, thousands, and ten-thousands.</li>
          </ol>
          <p className="mt-2 text-[10px] leading-relaxed text-[#6D6997]">
            Progressive hints focus on one column and preserve every correct answer digit.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Instruction (spoken by Koda)</Label>
        <Input
          value={question.instruction ?? ""}
          onChange={event => update({ instruction: event.target.value })}
          placeholder={`Add ${addends.join(", ")} one column at a time.`}
        />
        <p className="text-[10px] font-medium text-[#6D6997]">
          Optional. Leave blank to generate a clear instruction from the three rows.
        </p>
      </div>
    </div>
  );
};

const MetaChip: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = "", children }) => (
  <span className={`koda-admin-chip rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-indigo-700 ${className}`}>
    {children}
  </span>
);
