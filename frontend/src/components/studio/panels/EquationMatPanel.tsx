import React from "react";
import { PanelProps, PanelSection, SelectField, SliderField } from "../panelKit";
import {
  equationAnswer,
  equationText,
  normalizeEquationConfig,
  type EquationMatConfig,
} from "../../canvases/EquationMatCanvas";

/**
 * Authoring an equation is choosing which quantity to hide. The panel keeps `targetCount` in
 * step with that choice on every edit, because the answer changes completely when the unknown
 * moves — 8 + 3 asks for 11, but 8 + ? = 11 asks for 3 from the very same numbers.
 *
 * `judge` moves it again: the answer becomes True (1) or False (0), decided by what the
 * right-hand side claims. The claim therefore has to travel through every edit here — reading
 * the config without it makes the two sides match by definition, and every equation would be
 * authored as "true" no matter what it says.
 */
export const EquationMatPanel: React.FC<PanelProps> = ({ question, update }) => {
  const current = normalizeEquationConfig({
    operation: question.config.equationOperation,
    first: question.config.equationFirst,
    second: question.config.equationSecond,
    unknown: question.config.equationUnknown,
    claimFirst: question.config.equationClaimFirst,
    claimSecond: question.config.equationClaimSecond,
  });
  const isJudge = current.unknown === "judge";

  const apply = (patch: Partial<EquationMatConfig>) => {
    const next = normalizeEquationConfig({ ...current, ...patch });
    update({
      targetCount: equationAnswer(next),
      title: equationText(next),
      instruction: next.unknown === "judge"
        ? "Count both sides. Is this true or false?"
        : next.unknown === "result"
          ? "How many altogether? Tap the number."
          : "One group is hidden. Tap the number that makes the equation true.",
      config: {
        ...question.config,
        equationOperation: next.operation,
        equationFirst: next.first,
        equationSecond: next.second,
        equationUnknown: next.unknown,
        equationClaimFirst: next.claimFirst,
        equationClaimSecond: next.claimSecond,
      },
    });
  };

  return (
    <PanelSection title="Equation">
      <SelectField
        label="Operation"
        value={current.operation}
        onChange={value => apply({ operation: value as EquationMatConfig["operation"] })}
        options={[
          { value: "add", label: "Addition · a + b = c" },
          { value: "subtract", label: "Subtraction · a − b = c" },
        ]}
      />
      <SelectField
        label="What the child answers"
        value={current.unknown}
        onChange={value => apply({ unknown: value as EquationMatConfig["unknown"] })}
        options={[
          { value: "result", label: "The total · 8 + 3 = ?" },
          { value: "second", label: "The second number · 8 + ? = 11" },
          { value: "first", label: "The first number · ? + 3 = 11" },
          { value: "judge", label: "True or false · 5 + 2 = 3 + 4" },
        ]}
      />
      <SliderField label="First number" value={current.first} min={0} max={20} onChange={first => apply({ first })} />
      <SliderField
        label={current.operation === "add" ? "Second number" : "Take away"}
        value={current.second}
        min={0}
        max={current.operation === "subtract" ? current.first : 20 - current.first}
        onChange={second => apply({ second })}
      />
      {isJudge && (
        <>
          <SliderField
            label="Right-hand side"
            value={current.claimFirst}
            min={0}
            max={20}
            onChange={claimFirst => apply({ claimFirst })}
          />
          <SliderField
            label="Plus (0 for a single number)"
            value={current.claimSecond}
            min={0}
            max={20 - current.claimFirst}
            onChange={claimSecond => apply({ claimSecond })}
          />
        </>
      )}
    </PanelSection>
  );
};
