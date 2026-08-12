import React from "react";
import { ActorCastField, PanelProps, PanelSection, SelectField, SliderField, TextField } from "../panelKit";
import {
  UNNAMED,
  isPlaceholderLabel,
  measureAnswer,
  normalizeMeasureConfig,
  type MeasureTask,
} from "../../canvases/MeasureLengthCanvas";

export const MeasureLengthPanel: React.FC<PanelProps> = ({ question, update, updateConfig }) => {
  const current = normalizeMeasureConfig({
    task: question.config.measureTask as MeasureTask,
    lengths: question.config.measureLengths as number[],
    labels: question.config.measureLabels as string[],
  });

  const apply = (patch: Partial<typeof current>) => {
    const next = normalizeMeasureConfig({ ...current, ...patch });
    update({
      targetCount: measureAnswer(next),
      // Not `Measure ${lengths[0]} units` — the title is the page heading, so that printed the
      // answer above the question. The unit count belongs in the explanation, not the header.
      title: next.task === "measure" ? "How long is the bar?" : `Find the ${next.task}`,
      instruction: next.task === "measure"
        ? "Count the units under the bar. How long is it?"
        : `Tap the ${next.task} bar.`,
      config: {
        ...question.config,
        measureTask: next.task,
        measureLengths: next.lengths,
        measureLabels: next.labels,
      },
    });
  };

  const setLength = (index: number, value: number) => {
    const lengths = [...current.lengths];
    lengths[index] = value;
    apply({ lengths });
  };

  return (
    <PanelSection title="Length">
      <SelectField
        label="Task"
        value={current.task}
        onChange={value => apply({
          task: value as MeasureTask,
          lengths: value === "measure" ? [current.lengths[0] ?? 5] : [3, 6, 4],
        })}
        options={[
          { value: "measure", label: "Measure with units" },
          { value: "longest", label: "Find the longest" },
          { value: "shortest", label: "Find the shortest" },
        ]}
      />
      {/* The compare tasks name their bars by colour, and those names are fixed to the colours
          the bars are drawn in — renaming one would just recreate "RED printed on a green bar".
          A single measured bar has no such constraint, so it is the one the author can name. */}
      {current.task === "measure" && (
        <TextField
          label="Bar name (optional)"
          value={isPlaceholderLabel(current.labels[0]) ? "" : current.labels[0]}
          placeholder="Leave empty for no label"
          onChange={value => apply({ labels: [value.trim() || UNNAMED] })}
        />
      )}
      {current.lengths.map((length, index) => (
        <SliderField
          key={index}
          label={current.task === "measure" ? "Length in units" : `${current.labels[index]} length`}
          value={length}
          min={1}
          max={12}
          onChange={value => setLength(index, value)}
        />
      ))}

      {/* Who plays each moment of the question. */}
      <ActorCastField config={question.config} updateConfig={updateConfig} />
    </PanelSection>
  );
};
