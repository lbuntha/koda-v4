import React from "react";
import { PanelProps, PanelSection, SelectField, TextField, ToggleField } from "../panelKit";

const CONTAINER_PLACEHOLDER: Record<string, string> = {
  jar: "Star Magnet Jar",
  basket: "Star Basket",
  box: "Star Box"
};

export const CountMagnetsPanel: React.FC<PanelProps> = ({ question, updateConfig }) => {
  const shape = question.config.containerShape || "jar";

  return (
    <PanelSection>
      <SelectField
        label="Container Shape"
        value={shape}
        onChange={(value) => updateConfig({ containerShape: value as any })}
        options={[
          { value: "jar", label: "🍯 Kawaii Glass Jar" },
          { value: "basket", label: "🧺 Kawaii Woven Basket" },
          { value: "box", label: "📦 Kawaii Cardboard Box" }
        ]}
      />

      <TextField
        label="Container Label"
        value={question.config.jarLabel || ""}
        placeholder={CONTAINER_PLACEHOLDER[shape] || CONTAINER_PLACEHOLDER.jar}
        onChange={(value) => updateConfig({ jarLabel: value })}
      />

      {/* Warm yellow is the one thing the canvas palette rules out, so the old
          "Warm Gold" option is gone; slides that chose it read as violet. */}
      <SelectField
        label="Theme Colour"
        value={question.config.jarColorAccent === "amber" ? "violet" : (question.config.jarColorAccent || "blue")}
        onChange={(value) => updateConfig({ jarColorAccent: value as any })}
        options={[
          { value: "blue", label: "Electric Indigo" },
          { value: "violet", label: "Deep Violet" },
          { value: "rose", label: "Sunset Crimson" },
          { value: "emerald", label: "Forest Meadow" }
        ]}
      />

      <ToggleField
        label="Show card frame on magnet objects"
        checked={question.config.showItemFrame ?? true}
        onChange={(checked) => updateConfig({ showItemFrame: checked })}
      />

      <ToggleField
        label="Require answer input after collecting"
        checked={question.config.requireAnswerInput ?? true}
        onChange={(checked) => updateConfig({ requireAnswerInput: checked })}
      />
    </PanelSection>
  );
};
