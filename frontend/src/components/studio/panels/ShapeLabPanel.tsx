import React from "react";
import { PanelProps, PanelSection, SelectField } from "../panelKit";
import { normalizeShapeConfig, shapeAnswer, shapePrompt, SHAPE_SIDES, type ShapeName, type ShapeTask } from "../../canvases/ShapeLabCanvas";

export const ShapeLabPanel: React.FC<PanelProps> = ({ question, update }) => {
  const current = normalizeShapeConfig({
    task: question.config.shapeTask as ShapeTask,
    shape: question.config.shapeName as ShapeName,
    shares: question.config.shapeShares as number,
  });

  const apply = (patch: Partial<typeof current>) => {
    const next = normalizeShapeConfig({ ...current, ...patch });
    update({
      targetCount: shapeAnswer(next),
      // The title names the task and the instruction asks the question. Using the prompt for
      // both prints the same sentence twice — once as the heading, once as the hint.
      title: next.task === "compose" ? "Build the shape"
        : next.task === "shares" ? "Name the parts"
        : `Count the ${next.task}`,
      instruction: shapePrompt(next),
      config: {
        ...question.config,
        shapeTask: next.task,
        shapeName: next.shape,
        shapeShares: next.shares,
      },
    });
  };

  return (
    <PanelSection title="Shape">
      <SelectField
        label="Task"
        value={current.task}
        onChange={value => apply({ task: value as ShapeTask })}
        options={[
          { value: "sides", label: "Count the sides" },
          { value: "corners", label: "Count the corners" },
          { value: "compose", label: "Which shapes join to make it" },
          { value: "shares", label: "Equal shares - halves and fourths" },
        ]}
      />
      <SelectField
        label="Shape"
        value={current.shape}
        onChange={value => apply({ shape: value as ShapeName })}
        options={(Object.keys(SHAPE_SIDES) as ShapeName[]).map(name => ({ value: name, label: name }))}
      />
      {current.task === "shares" && (
        <SelectField
          label="Equal parts"
          value={String(current.shares)}
          onChange={value => apply({ shares: Number(value) })}
          options={[{ value: "2", label: "Halves" }, { value: "4", label: "Fourths" }]}
        />
      )}
    </PanelSection>
  );
};
