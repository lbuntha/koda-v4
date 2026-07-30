import React from "react";
import { PanelProps, PanelSection, SelectField, SliderField, TextField } from "../panelKit";
import {
  allowedUnknowns,
  normalizeStoryProblemConfig,
  StoryProblemType,
  StoryScene,
  StoryUnknown,
  storyAnswer,
  storyText,
} from "../../canvases/storyProblemModel";
import { COUNT_OBJECTS } from "../../../types";

const UNKNOWN_LABELS: Record<StoryUnknown, string> = {
  result: "Result · what happens at the end",
  change: "Change · how many joined or left",
  start: "Start · how many at first",
  part: "Part · one group is missing",
};

export const StoryProblemMatPanel: React.FC<PanelProps> = ({ question, update }) => {
  const current = normalizeStoryProblemConfig({
    type: question.config.storyProblemType,
    unknown: question.config.storyUnknown,
    first: question.config.storyStart,
    second: question.config.storyPart2 ?? question.config.storyChange,
    third: question.config.storyPart3,
    scene: question.config.storyScene,
    characterName: question.config.storyCharacterName,
  });
  const object = COUNT_OBJECTS.find(item => item.id === question.objectId) || COUNT_OBJECTS[0];

  const apply = (patch: Partial<typeof current>) => {
    const next = normalizeStoryProblemConfig({ ...current, ...patch });
    update({
      targetCount: storyAnswer(next),
      instruction: storyText(next, object.label),
      config: {
        ...question.config,
        storyProblemType: next.type,
        storyUnknown: next.unknown,
        storyStart: next.first,
        storyChange: next.second,
        storyPart2: next.second,
        storyPart3: next.third,
        storyScene: next.scene,
        storyCharacterName: next.characterName,
      },
    });
  };

  const firstLabel = current.type === "take_apart" ? "Whole" : current.type === "compare" ? "Larger group" : "First group";
  const secondLabel = current.type === "take_from" ? "How many leave" : current.type === "take_apart" ? "Known part" : current.type === "compare" ? "Smaller group" : "Second group";

  return (
    <PanelSection title="Story Structure">
      <SelectField
        label="Problem type"
        value={current.type}
        onChange={value => apply({ type: value as StoryProblemType })}
        options={[
          { value: "add_to", label: "Add to · a group grows" },
          { value: "take_from", label: "Take from · a group shrinks" },
          { value: "put_together", label: "Put together · two parts" },
          { value: "take_apart", label: "Take apart · find a part" },
          { value: "compare", label: "Compare · how many more" },
          { value: "three_addends", label: "Three groups · add within 20" },
        ]}
      />
      <SelectField
        label="Unknown"
        value={current.unknown}
        onChange={value => apply({ unknown: value as StoryUnknown })}
        options={allowedUnknowns(current.type).map(value => ({ value, label: UNKNOWN_LABELS[value] }))}
      />
      <SliderField label={firstLabel} value={current.first} min={1} max={current.type === "three_addends" ? 18 : 19} onChange={first => apply({ first })} />
      <SliderField label={secondLabel} value={current.second} min={1} max={current.type === "take_from" || current.type === "take_apart" || current.type === "compare" ? current.first : Math.max(1, 20 - current.first)} onChange={second => apply({ second })} />
      {current.type === "three_addends" && (
        <SliderField label="Third group" value={current.third} min={1} max={Math.max(1, 20 - current.first - current.second)} onChange={third => apply({ third })} />
      )}
      <SelectField
        label="Scene"
        value={current.scene}
        onChange={value => apply({ scene: value as StoryScene })}
        options={[
          { value: "park", label: "Park" },
          { value: "picnic", label: "Picnic" },
          { value: "pond", label: "Pond" },
          { value: "space", label: "Space" },
          { value: "classroom", label: "Classroom" },
        ]}
      />
      <TextField label="Character name" value={current.characterName} placeholder="Koda" onChange={characterName => apply({ characterName })} />
    </PanelSection>
  );
};
