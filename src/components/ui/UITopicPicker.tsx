import React from "react";
import { Lock } from "lucide-react";
import { TOPICS, cleanTopics, type Topic } from "../../lib/topics";
import { useT } from "../../lib/i18n";
import { UIButton } from "./ThemeUI";

export interface UITopicPickerProps {
  /** The topics the author chose. */
  value: readonly string[] | null | undefined;
  onChange(next: Topic[]): void;
  /**
   * Topics the content already has without being chosen — a book's shelf,
   * reading for every book, writing for a set of letters. Shown on and
   * locked, so an author sees the whole picture and picks only what is extra.
   */
  implied?: readonly Topic[];
  className?: string;
}

/** What it is about, from the shared list (`src/lib/topics.ts`). Optional, so no warning when empty. */
export const UITopicPicker: React.FC<UITopicPickerProps> = ({ value, onChange, implied = [], className = "" }) => {
  const { t } = useT();
  const chosen = cleanTopics(value ?? []);
  const toggle = (topic: Topic) => onChange(chosen.includes(topic) ? chosen.filter((x) => x !== topic) : cleanTopics([...chosen, topic]));

  return (
    <fieldset className={`flex flex-col gap-2 ${className}`}>
      <legend className="mb-1 text-xs font-extrabold uppercase tracking-wider text-muted">{t("topics.label")}</legend>
      <div className="flex flex-wrap gap-1.5">
        {TOPICS.map((topic) => {
          const locked = implied.includes(topic);
          const on = locked || chosen.includes(topic);
          return (
            <UIButton
              key={topic}
              type="button"
              size="sm"
              variant={on ? "primary" : "secondary"}
              aria-pressed={on}
              disabled={locked}
              title={locked ? t("topics.implied") : undefined}
              icon={locked ? <Lock className="h-3 w-3" aria-hidden="true" /> : undefined}
              className="rounded-full disabled:opacity-80"
              onClick={() => toggle(topic)}
            >
              {t(`topics.name.${topic}`)}
            </UIButton>
          );
        })}
      </div>
      <p className="text-xs text-muted">{t("topics.note")}</p>
    </fieldset>
  );
};
