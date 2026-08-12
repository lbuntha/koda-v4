import React from "react";
import { Input, Label } from "../../ui";
import { ActorCastField, PanelProps } from "../panelKit";
import {
  buildColumnSubtractionModel,
  normalizeMultiRowSubtractionOperands,
  SUBTRACTION_MAX,
  SUBTRACTION_MIN,
  describeSubtractionMode,
} from "../../canvases/columnSubtractionModel";

export const MultiRowColumnSubtractionPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const model = buildColumnSubtractionModel(
    question.config?.minuend ?? 432,
    question.config?.subtrahend ?? 178,
    question.config?.subtrahend2 ?? 56,
  );
  const values = [model.minuend, model.subtrahend, model.subtrahend2 ?? 0];

  const setOperand = (index: number, raw: string) => {
    const next = [...values];
    next[index] = Number(raw);
    const normalized = normalizeMultiRowSubtractionOperands(next[0], next[1], next[2]);
    update({
      targetCount: normalized.minuend - normalized.subtrahend - normalized.subtrahend2,
      config: {
        ...question.config,
        minuend: normalized.minuend,
        subtrahend: normalized.subtrahend,
        subtrahend2: normalized.subtrahend2,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
        <span className="koda-admin-chip block text-[#534AB7]">Three-Row Subtraction Parameters</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Top Row</Label>
            <Input
              type="number"
              min={SUBTRACTION_MIN}
              max={SUBTRACTION_MAX}
              value={values[0]}
              onChange={event => setOperand(0, event.target.value)}
            />
          </div>
          <div>
            <Label>Subtract Row 2</Label>
            <Input
              type="number"
              min={SUBTRACTION_MIN}
              max={values[0]}
              value={values[1]}
              onChange={event => setOperand(1, event.target.value)}
            />
          </div>
          <div>
            <Label>Subtract Row 3</Label>
            <Input
              type="number"
              min={SUBTRACTION_MIN}
              max={Math.max(0, values[0] - values[1])}
              value={values[2]}
              onChange={event => setOperand(2, event.target.value)}
            />
          </div>
        </div>
        <p className="text-[10px] font-medium text-[#6D6997]">
          The two lower rows are constrained so their combined value never exceeds the top row.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <MetaChip>{describeSubtractionMode(model.digitMode)}</MetaChip>
          <MetaChip className={model.anyBorrow ? "border-rose-200 bg-rose-50 text-rose-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
            {model.anyBorrow ? `Borrow columns ×${model.borrowCount}` : "No regrouping"}
          </MetaChip>
          <MetaChip>{values[0].toLocaleString()} − {values[1].toLocaleString()} − {values[2].toLocaleString()} = {model.difference.toLocaleString()}</MetaChip>
        </div>
        <div className="rounded-xl border border-[#E7E3F6] bg-white p-3">
          <p className="koda-admin-label text-[#0E0B55]">How the student works</p>
          <ol className="mt-1.5 space-y-1 text-[10px] leading-relaxed text-[#6D6997]">
            <li><strong>1.</strong> Start with the ones and combine the two lower digits.</li>
            <li><strong>2.</strong> Subtract that total from the top digit; borrow 1 or 2 when needed.</li>
            <li><strong>3.</strong> Continue left while tracking what each place lent to its right.</li>
          </ol>
          <p className="mt-2 text-[10px] leading-relaxed text-[#6D6997]">
            Optional guidance explains both lower rows and preserves every correct answer column.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Instruction (spoken by Koda)</Label>
        <Input
          value={question.instruction ?? ""}
          onChange={event => update({ instruction: event.target.value })}
          placeholder={`Subtract ${values[1]} and ${values[2]} from ${values[0]}.`}
        />
        <p className="text-[10px] font-medium text-[#6D6997]">
          Optional. Leave blank to generate an instruction from all three rows.
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
