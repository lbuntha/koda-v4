import React from "react";
import { Input, Label } from "../../ui";
import { ActorCastField, PanelProps } from "../panelKit";
import {
  buildColumnSubtractionModel,
  normalizeSubtractionOperands,
  SUBTRACTION_MAX,
  SUBTRACTION_MIN,
  describeSubtractionMode,
} from "../../canvases/columnSubtractionModel";

export const ColumnSubtractionPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const model = buildColumnSubtractionModel(
    question.config?.minuend ?? 432,
    question.config?.subtrahend ?? 178,
  );

  const setOperand = (key: "minuend" | "subtrahend", raw: string) => {
    const candidate = key === "minuend"
      ? normalizeSubtractionOperands(raw, model.subtrahend)
      : normalizeSubtractionOperands(model.minuend, raw);
    update({
      targetCount: candidate.minuend - candidate.subtrahend,
      config: {
        ...question.config,
        minuend: candidate.minuend,
        subtrahend: candidate.subtrahend,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
        <span className="koda-admin-chip block text-[#534AB7]">Column Subtraction Parameters</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Top Number ({SUBTRACTION_MIN}–{SUBTRACTION_MAX.toLocaleString()})</Label>
            <Input
              type="number"
              min={SUBTRACTION_MIN}
              max={SUBTRACTION_MAX}
              value={model.minuend}
              onChange={event => setOperand("minuend", event.target.value)}
            />
          </div>
          <div>
            <Label>Subtract (0–{model.minuend.toLocaleString()})</Label>
            <Input
              type="number"
              min={SUBTRACTION_MIN}
              max={model.minuend}
              value={model.subtrahend}
              onChange={event => setOperand("subtrahend", event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MetaChip>{describeSubtractionMode(model.digitMode)}</MetaChip>
          <MetaChip className={model.anyBorrow ? "border-rose-200 bg-rose-50 text-rose-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
            {model.anyBorrow ? `Borrows ×${model.borrowCount}` : "No regrouping"}
          </MetaChip>
          <MetaChip>{model.minuend.toLocaleString()} − {model.subtrahend.toLocaleString()} = {model.difference.toLocaleString()}</MetaChip>
        </div>
        <div className="rounded-xl border border-[#E7E3F6] bg-white p-3">
          <p className="koda-admin-label text-[#0E0B55]">How the student works</p>
          <ol className="mt-1.5 space-y-1 text-[10px] leading-relaxed text-[#6D6997]">
            <li><strong>1.</strong> Start with the ones column on the right.</li>
            <li><strong>2.</strong> If the top value is too small, borrow one from the place on the left.</li>
            <li><strong>3.</strong> Subtract and continue left through all place values.</li>
          </ol>
          <p className="mt-2 text-[10px] leading-relaxed text-[#6D6997]">
            Koda offers optional, progressive help after an error. Correct columns remain in place.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Instruction (spoken by Koda)</Label>
        <Input
          value={question.instruction ?? ""}
          onChange={event => update({ instruction: event.target.value })}
          placeholder={`Subtract ${model.subtrahend} from ${model.minuend}, one column at a time.`}
        />
        <p className="text-[10px] font-medium text-[#6D6997]">
          Optional. Leave blank to use a clear instruction generated from the two numbers.
        </p>
      </div>

      {/* Who plays each moment of the question. */}
      <ActorCastField config={question.config} updateConfig={updateConfig} />
    </div>
  );
};

const MetaChip: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = "", children }) => (
  <span className={`koda-admin-chip rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-indigo-700 ${className}`}>
    {children}
  </span>
);
