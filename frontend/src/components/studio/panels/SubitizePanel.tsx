import React from "react";
import { PanelProps, PanelSection, SelectField, SliderField } from "../panelKit";

export const SubitizePanel: React.FC<PanelProps> = ({ question, updateConfig }) => {
  const count = question.targetCount || 0;

  return (
    <PanelSection>
      <SliderField
        label="Flash Duration"
        value={question.config.flashDurationMs || 1500}
        min={500}
        max={3500}
        step={250}
        format={(value) => `${(value / 1000).toFixed(1)}s`}
        onChange={(value) => updateConfig({ flashDurationMs: value })}
      />

      {/*
        The canvas has always read `config.pattern`, but nothing here ever set it,
        so every flash came out as a dice face whatever the slide was for. A
        different arrangement of the same quantity is the exercise.
      */}
      <SelectField
        label="Flash Arrangement"
        value={question.config.pattern || "dice"}
        onChange={(value) => updateConfig({ pattern: value as any })}
        options={[
          { value: "dice", label: count > 6 ? "Dice Face (grid above 6)" : "Dice Face" },
          { value: "pairs", label: "Pairs — two columns" },
          { value: "ring", label: "Closed Ring" },
          { value: "line", label: "Straight Line" },
          { value: "grid", label: "Neat Grid" },
          { value: "scatter", label: "Scattered (hardest)" }
        ]}
      />
    </PanelSection>
  );
};
