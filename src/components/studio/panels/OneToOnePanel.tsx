import React from "react";
import { PanelProps, PanelSection, SelectField, SliderField, ToggleField } from "../panelKit";

/**
 * Reference panel — the pattern every technique panel migrates toward:
 * kit primitives only, `updateConfig` for config patches, no bespoke markup.
 */
export const OneToOnePanel: React.FC<PanelProps> = ({ question, updateConfig }) => {
  const pattern = question.config.pattern || "grid";
  const defaultColumns = pattern === "pairs" ? 2 : Math.ceil(Math.sqrt(question.targetCount || 1));

  return (
    <PanelSection>
      <SelectField
        label="Preset Alignment"
        value={pattern}
        onChange={(value) => updateConfig({
          pattern: value as any,
          customPositions: undefined,
          layoutReference: undefined
        })}
        options={[
          { value: "line", label: "Straight Horizontal Line" },
          { value: "circle", label: "Beautiful Curve/Semicircle" },
          { value: "wave", label: "Sinusoidal Sine Wave" },
          { value: "grid", label: "Question Grid Alignment" },
          { value: "columns", label: "Column Grid Alignment" },
          { value: "pairs", label: "Pair Grouping Grid" },
          { value: "scatter", label: "Deterministic Scattered" }
        ]}
      />

      {["grid", "columns", "pairs"].includes(pattern) && (
        <SliderField
          label="Grid Columns"
          value={question.config.gridColumns || defaultColumns}
          min={1}
          max={Math.max(1, Math.min(5, question.targetCount || 1))}
          unit="cols"
          onChange={(value) => updateConfig({
            gridColumns: value,
            customPositions: undefined,
            layoutReference: undefined
          })}
        />
      )}

      <ToggleField
        label="Show count bubble on tap"
        checked={question.config.showNumbersOnTap ?? true}
        onChange={(checked) => updateConfig({ showNumbersOnTap: checked })}
      />
    </PanelSection>
  );
};
