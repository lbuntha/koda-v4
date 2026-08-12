import React from "react";
import { Input, Label } from "../../ui";
import { ActorCastField, PanelProps } from "../panelKit";
import {
  MULTIPLICAND_MAX,
  MULTIPLICAND_MIN,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  buildColumnMultiplicationModel,
  clampMultiplicand,
  clampMultiplier,
  describeMultiplicationMode,
} from "../../canvases/columnMultiplicationModel";

export const ColumnMultiplicationPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const model = buildColumnMultiplicationModel(
    question.config?.multiplicand ?? 234,
    question.config?.multiplier ?? 56,
  );

  const setValue = (key: "multiplicand" | "multiplier", raw: string) => {
    const multiplicand = key === "multiplicand" ? clampMultiplicand(raw) : model.multiplicand;
    const multiplier = key === "multiplier" ? clampMultiplier(raw) : model.multiplier;
    update({
      targetCount: multiplicand * multiplier,
      config: { ...question.config, multiplicand, multiplier },
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5">
        <span className="koda-admin-chip block text-[#534AB7]">Column Multiplication Parameters</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Top Number ({MULTIPLICAND_MIN}–{MULTIPLICAND_MAX.toLocaleString()})</Label>
            <Input
              type="number"
              min={MULTIPLICAND_MIN}
              max={MULTIPLICAND_MAX}
              value={model.multiplicand}
              onChange={event => setValue("multiplicand", event.target.value)}
            />
          </div>
          <div>
            <Label>Multiplier ({MULTIPLIER_MIN}–{MULTIPLIER_MAX.toLocaleString()})</Label>
            <Input
              type="number"
              min={MULTIPLIER_MIN}
              max={MULTIPLIER_MAX}
              value={model.multiplier}
              onChange={event => setValue("multiplier", event.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <MetaChip>{describeMultiplicationMode(model.digitMode)}</MetaChip>
          <MetaChip>{model.partialRows.length} partial {model.partialRows.length === 1 ? "row" : "rows"}</MetaChip>
          <MetaChip className={model.anyCarry ? "border-rose-200 bg-rose-50 text-rose-600" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
            {model.anyCarry ? `Carry steps ×${model.carryCount}` : "No carrying"}
          </MetaChip>
          <MetaChip>{model.multiplicand.toLocaleString()} × {model.multiplier.toLocaleString()} = {model.product.toLocaleString()}</MetaChip>
        </div>
        <div className="rounded-xl border border-[#E7E3F6] bg-white p-3">
          <p className="koda-admin-label text-[#0E0B55]">How the student works</p>
          <ol className="mt-1.5 space-y-1 text-[10px] leading-relaxed text-[#6D6997]">
            <li><strong>1.</strong> Multiply the top number by each multiplier digit, starting with ones.</li>
            <li><strong>2.</strong> Carry within each partial product and shift each new row one place left.</li>
            <li><strong>3.</strong> Add the completed partial products to find the final product.</li>
          </ol>
          <p className="mt-2 text-[10px] leading-relaxed text-[#6D6997]">
            Supports a five-digit top number and a three-digit multiplier. Correct digits remain after mistakes.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Instruction (spoken by Koda)</Label>
        <Input
          value={question.instruction ?? ""}
          onChange={event => update({ instruction: event.target.value })}
          placeholder={`Multiply ${model.multiplicand} by ${model.multiplier} using partial products.`}
        />
        <p className="text-[10px] font-medium text-[#6D6997]">
          Optional. Leave blank for an instruction generated from the two factors.
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
