import React from "react";
import { PanelProps, PanelSection, SelectField, SliderField } from "../panelKit";
import { dataAnswer, dataPrompt, normalizeDataConfig, type DataQuestionKind } from "../../canvases/DataChartCanvas";
import { SVG_OBJECTS } from "../../../types";

export const DataChartPanel: React.FC<PanelProps> = ({ question, update }) => {
  const current = normalizeDataConfig({
    kind: question.config.dataKind as DataQuestionKind,
    categories: question.config.dataCategories as string[],
    counts: question.config.dataCounts as number[],
    focus: question.config.dataFocus as number,
    against: question.config.dataAgainst as number,
    assets: question.config.dataAssets as string[],
  });

  const apply = (patch: Partial<typeof current>) => {
    const next = normalizeDataConfig({ ...current, ...patch });
    update({
      targetCount: dataAnswer(next),
      // The title names the task and the instruction asks the question. Using the prompt for
      // both prints the same sentence twice — once as the heading, once as the hint.
      title: "Read the chart",
      instruction: dataPrompt(next),
      config: {
        ...question.config,
        dataKind: next.kind,
        dataCategories: next.categories,
        dataCounts: next.counts,
        dataFocus: next.focus,
        dataAgainst: next.against,
        dataAssets: next.assets,
      },
    });
  };

  const setCount = (index: number, value: number) => {
    const counts = [...current.counts];
    counts[index] = value;
    apply({ counts });
  };

  /* A chart is read by telling its columns apart, so each one gets its own
     artwork — it used to be three hardcoded fruit emoji whatever the slide was
     about. "" keeps that fruit as the default. */
  const setAsset = (index: number, value: string) => {
    const assets = [...current.assets];
    assets[index] = value;
    apply({ assets });
  };

  return (
    <PanelSection title={`Data - answer ${dataAnswer(current)}`}>
      <SelectField
        label="Question"
        value={current.kind}
        onChange={value => apply({ kind: value as DataQuestionKind })}
        options={[
          { value: "count", label: "How many in one group" },
          { value: "total", label: "How many altogether" },
          { value: "more", label: "How many more than" },
          { value: "most", label: "Which group has the most" },
        ]}
      />
      {current.counts.map((count, index) => (
        <React.Fragment key={index}>
        <SliderField
          label={`${current.categories[index]} count`}
          value={count}
          min={0}
          max={10}
          onChange={value => setCount(index, value)}
        />
        <SelectField
          label={`${current.categories[index]} artwork`}
          value={current.assets[index] || ""}
          onChange={value => setAsset(index, value)}
          options={[
            { value: "", label: "Default fruit emoji" },
            { value: "emoji", label: "Emoji (from the object picker)" },
            ...SVG_OBJECTS.map(item => ({ value: item.assetType || item.id, label: `${item.label} · artwork` })),
          ]}
        />
        </React.Fragment>
      ))}
      {(current.kind === "count" || current.kind === "more") && (
        <SelectField
          label="Asked about"
          value={String(current.focus)}
          onChange={value => apply({ focus: Number(value) })}
          options={current.categories.map((label, index) => ({ value: String(index), label }))}
        />
      )}
      {current.kind === "more" && (
        <SelectField
          label="Compared with"
          value={String(current.against)}
          onChange={value => apply({ against: Number(value) })}
          options={current.categories.map((label, index) => ({ value: String(index), label }))}
        />
      )}
    </PanelSection>
  );
};
