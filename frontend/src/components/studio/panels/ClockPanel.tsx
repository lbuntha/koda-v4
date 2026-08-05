import React from "react";
import { PanelProps, PanelSection, SelectField, SliderField } from "../panelKit";
import { clockLabel, normalizeClockConfig } from "../../canvases/ClockCanvas";

export const ClockPanel: React.FC<PanelProps> = ({ question, update }) => {
  const current = normalizeClockConfig({
    hour: question.config.clockHour,
    minute: question.config.clockMinute as 0 | 30,
  });

  const apply = (patch: Partial<typeof current>) => {
    const next = normalizeClockConfig({ ...current, ...patch });
    update({
      targetCount: next.hour,
      // "Half past 2" as a title is the answer, printed as the page heading above the clock.
      // The time the author is building stays visible in this panel's own section header.
      title: "What time is it?",
      instruction: "Read the clock. The short hand tells you the hour.",
      config: { ...question.config, clockHour: next.hour, clockMinute: next.minute },
    });
  };

  return (
    <PanelSection title={`Clock - ${clockLabel(current)}`}>
      <SliderField label="Hour" value={current.hour} min={1} max={12} onChange={hour => apply({ hour })} />
      <SelectField
        label="Minutes"
        value={String(current.minute)}
        onChange={value => apply({ minute: Number(value) as 0 | 30 })}
        options={[
          { value: "0", label: "O'clock - on the hour" },
          { value: "30", label: "Half past - hand between numbers" },
        ]}
      />
    </PanelSection>
  );
};
