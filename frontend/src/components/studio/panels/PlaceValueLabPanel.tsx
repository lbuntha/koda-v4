import React from "react";
import { ActorCastField, PanelProps, PanelSection, SelectField, SliderField, ToggleField } from "../panelKit";
import { normalizePlaceValueConfig, placeValueInstruction, PlaceValueDifficulty, PlaceValueTask } from "../../canvases/placeValueModel";

export const PlaceValueLabPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const current = normalizePlaceValueConfig({
    task: question.config.placeValueTask,
    difficulty: question.config.placeValueDifficulty,
    target: question.config.placeValueTarget ?? question.targetCount,
    showExpanded: question.config.placeValueShowExpanded,
  });

  const apply = (patch: Partial<typeof current>) => {
    const next = normalizePlaceValueConfig({ ...current, ...patch });
    update({
      targetCount: next.target,
      instruction: placeValueInstruction(next),
      config: {
        ...question.config,
        placeValueTask: next.task,
        placeValueDifficulty: next.difficulty,
        placeValueTarget: next.target,
        placeValueShowExpanded: next.showExpanded,
      },
    });
  };

  return (
    <PanelSection title="Place Value Activity">
      <SelectField
        label="Learning task"
        value={current.task}
        onChange={value => apply({ task: value as PlaceValueTask })}
        options={[
          { value: "build_number", label: "Build a number" },
          { value: "read_number", label: "Read shown blocks" },
          { value: "regroup_ones", label: "Trade 10 ones for 1 ten" },
        ]}
      />
      <SelectField
        label="Guidance"
        value={current.difficulty}
        onChange={value => apply({ difficulty: value as PlaceValueDifficulty })}
        options={[
          { value: "guided", label: "Guided · show place counts" },
          { value: "independent", label: "Independent · count the blocks" },
        ]}
      />
      <SliderField label="Two-digit number" value={current.target} min={10} max={99} onChange={target => apply({ target })} />
      <ToggleField label="Show expanded form" checked={current.showExpanded} onChange={showExpanded => apply({ showExpanded })} />

      {/* Who plays each moment of the question. */}
      <ActorCastField config={question.config} updateConfig={updateConfig} />
    </PanelSection>
  );
};
