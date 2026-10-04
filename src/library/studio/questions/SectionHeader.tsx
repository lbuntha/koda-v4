import type { ReactNode } from "react";
import { Plus, Sparkles } from "lucide-react";
import { UIButton, UIProgressBar } from "../../../components/ui";
import { useT } from "../../../lib/i18n";

/**
 * The top of every Review section — Understand, Words, Spell, Match and Read &
 * opposite all start the same way: what the section is, how far it is, and the
 * two ways to fill it, by hand or with AI. A book starts with every section
 * empty, so this is also where an author makes the first item.
 */
export function SectionHeader({ title, help, have, want, manualLabel, onManual, aiLabel, onAi, aiBusy, aiDisabled, children }: {
  title: string;
  help: string;
  have: number;
  /** The section's target. Absent: optional, only the count is shown. */
  want?: number;
  manualLabel: string;
  onManual(): void;
  aiLabel: string;
  onAi(): void;
  aiBusy: boolean;
  /** Why AI cannot add here now (the section is full), or nothing. */
  aiDisabled?: string;
  /** Anything that belongs under the bar: a message, a picker. */
  children?: ReactNode;
}) {
  const { t } = useT();
  const met = want !== undefined && have >= want;
  return (
    <section className="grid gap-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 grow basis-64">
          <h3 className="text-lg font-extrabold text-ink">{title}</h3>
          <p className="mt-0.5 text-sm text-muted">{help}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <UIButton type="button" variant="outline" size="sm" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={onManual} disabled={aiBusy}>
            {manualLabel}
          </UIButton>
          <UIButton type="button" variant="primary" size="sm" icon={<Sparkles className="h-4 w-4" aria-hidden="true" />} onClick={onAi} isLoading={aiBusy} disabled={aiBusy || Boolean(aiDisabled)} title={aiDisabled}>
            {aiBusy ? t("studio.section.making") : aiLabel}
          </UIButton>
        </div>
      </div>
      {want !== undefined ? (
        <UIProgressBar value={have} max={want} size="sm" tone={met ? "emerald" : "primary"} label={title}
          caption={met ? t("studio.section.ready", { have, want }) : t("studio.section.progress", { have, want })} />
      ) : (
        <p className="text-xs font-bold text-muted">{t("studio.section.optional", { have })}</p>
      )}
      {children}
    </section>
  );
}

/** What an empty section shows under its header: nothing made yet, and how to start. */
export function SectionEmpty({ text }: { text: string }) {
  return (
    <div className="grid place-items-center gap-2 rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center">
      <Sparkles className="h-6 w-6 text-indigo-500" aria-hidden="true" />
      <p className="max-w-md text-sm font-semibold text-muted">{text}</p>
    </div>
  );
}
