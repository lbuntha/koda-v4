import React from "react";
import { PanelProps, PanelSection, SliderField } from "../panelKit";
import { compareAnswer, normalizeCompareConfig } from "../../canvases/CompareNumbersCanvas";

/** targetCount holds the larger number so the question sorts sensibly; the answer is the symbol. */
export const CompareNumbersPanel: React.FC<PanelProps> = ({ question, update }) => {
  const current = normalizeCompareConfig({
    first: question.config.compareFirst,
    second: question.config.compareSecond,
  });

  const apply = (patch: Partial<typeof current>) => {
    const next = normalizeCompareConfig({ ...current, ...patch });
    update({
      targetCount: Math.max(next.first, next.second),
      title: `${next.first} ? ${next.second}`,
      instruction: "Which sign belongs between them? Compare the tens first.",
      config: { ...question.config, compareFirst: next.first, compareSecond: next.second },
    });
  };

  return (
    <PanelSection title={`Compare - answer is "${compareAnswer(current)}"`}>
      <SliderField label="First number" value={current.first} min={0} max={99} onChange={first => apply({ first })} />
      <SliderField label="Second number" value={current.second} min={0} max={99} onChange={second => apply({ second })} />
    </PanelSection>
  );
};
