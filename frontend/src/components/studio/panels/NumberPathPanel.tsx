import React from "react";
import { ActorCastField, PanelProps, PanelSection, SelectField, SliderField } from "../panelKit";
import {
  normalizeNumberPathConfig,
  numberPathInstruction,
  NumberChartDifficulty,
  NumberChartTask,
  NumberChartView,
} from "../../canvases/numberPathModel";

export const NumberPathPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const current = normalizeNumberPathConfig({
    view: question.config.numberChartView,
    task: question.config.numberChartTask,
    difficulty: question.config.numberChartDifficulty,
    start: question.config.numberChartStart,
    target: question.config.numberChartEnd ?? question.targetCount,
  });

  const apply = (patch: Partial<typeof current>) => {
    const next = normalizeNumberPathConfig({ ...current, ...patch });
    update({
      targetCount: next.target,
      instruction: numberPathInstruction(next),
      config: {
        ...question.config,
        numberChartView: next.view,
        numberChartTask: next.task,
        numberChartDifficulty: next.difficulty,
        numberChartStart: next.start,
        numberChartEnd: next.target,
      },
    });
  };

  const startBounds = current.task === "ten_more"
    ? { min: 1, max: 110 }
    : current.task === "ten_less"
      ? { min: 11, max: 120 }
      : { min: 1, max: 119 };

  return (
    <PanelSection title="Number Path Activity">
      <SelectField
        label="Display"
        value={current.view}
        onChange={value => apply({ view: value as NumberChartView })}
        options={[
          { value: "path", label: "Number path" },
          { value: "circle", label: "Number circle" },
          { value: "stepping_stones", label: "Stepping stones" },
          { value: "maze", label: "Number maze" },
          { value: "chart", label: "120 chart" },
        ]}
      />
      <SelectField
        label="Difficulty"
        value={current.difficulty}
        onChange={value => apply({ difficulty: value as NumberChartDifficulty })}
        options={[
          { value: "guided", label: "Guided · show the next step" },
          { value: "independent", label: "Independent" },
          { value: "challenge", label: "Challenge · mixed positions" },
        ]}
      />
      <SelectField
        label="Learning task"
        value={current.task}
        onChange={value => apply({ task: value as NumberChartTask })}
        options={[
          { value: "count_forward", label: "Count forward" },
          { value: "find_number", label: "Find a number" },
          { value: "ten_more", label: "Find 10 more" },
          { value: "ten_less", label: "Find 10 less" },
        ]}
      />

      {current.task === "find_number" ? (
        <SliderField label="Number to find" value={current.target} min={1} max={120} onChange={target => apply({ target })} />
      ) : (
        <SliderField label="Starting number" value={current.start} min={startBounds.min} max={startBounds.max} onChange={start => apply({ start })} />
      )}

      {current.task === "count_forward" && (
        <SliderField
          label="Ending number"
          value={current.target}
          min={current.start + 1}
          max={Math.min(120, current.start + 9)}
          onChange={target => apply({ target })}
        />
      )}

      {/* Who plays each moment of the question. */}
      <ActorCastField config={question.config} updateConfig={updateConfig} />
    </PanelSection>
  );
};
