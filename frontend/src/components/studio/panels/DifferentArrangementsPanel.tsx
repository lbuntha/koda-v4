import React from "react";
import { PanelProps, PanelSection, SelectField, SliderField, ToggleField } from "../panelKit";

/**
 * The point of this technique is that the arrangement changes and the count does
 * not, so the arrangement list is the panel's main control — and it offers every
 * layout the canvas can actually draw, not the four it used to.
 */
export const DifferentArrangementsPanel: React.FC<PanelProps> = ({ question, updateConfig }) => {
  const pattern = question.config.pattern || "scatter";
  const defaultColumns = pattern === "pairs" ? 2 : Math.ceil(Math.sqrt(question.targetCount || 1));

  return (
    <PanelSection>
      <SelectField
        label="Arrangement"
        value={pattern}
        /* Custom positions are a teacher's override of an arrangement; a new
           arrangement has to start from the arrangement itself. */
        onChange={(value) => updateConfig({
          pattern: value as any,
          customPositions: undefined,
          layoutReference: undefined
        })}
        options={[
          { value: "scatter", label: "Scattered (no pattern)" },
          { value: "line", label: "Straight Horizontal Line" },
          { value: "grid", label: "Neat Grid" },
          { value: "columns", label: "Column Grid" },
          { value: "pairs", label: "Pair Grouping" },
          { value: "circle", label: "Curve / Semicircle" },
          { value: "ring", label: "Closed Ring" },
          { value: "wave", label: "Sine Wave" },
          { value: "dice", label: "Dice Face (1–6)" }
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
        label="Show card frame on objects"
        checked={question.config.showItemFrame ?? true}
        onChange={(checked) => updateConfig({ showItemFrame: checked })}
      />

      <ToggleField
        label="Show count bubble on tap"
        checked={question.config.showNumbersOnTap ?? true}
        onChange={(checked) => updateConfig({ showNumbersOnTap: checked })}
      />

      <ToggleField
        label="Require answer input after count"
        checked={question.config.requireAnswerInput ?? true}
        onChange={(checked) => updateConfig({ requireAnswerInput: checked })}
      />
    </PanelSection>
  );
};
