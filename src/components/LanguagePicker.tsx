import React from "react";
import { Languages } from "lucide-react";
import { availableLanguages, useT } from "../lib/i18n";
import { PreferencesAPI } from "../lib/preferences";
import { playSound } from "../utils/audio";
import { UISelect } from "./ui";

/**
 * The language switch, for however many languages there are.
 *
 * A select rather than a row of buttons: the list is whatever catalogs this
 * build carries, and a segmented control that fits two will not fit five. Each
 * option is written in its own script with the English name beside it — a
 * reader looks for their language by how it looks, and the helper setting up
 * the tablet looks for it by the name they know.
 *
 * Writes the family's `preferences` document, so a parent switching on their
 * phone switches the child's tablet too.
 */
export const LanguagePicker: React.FC<{ className?: string; compact?: boolean }> = ({
  className = "",
  compact = false,
}) => {
  const { t, language } = useT();
  const languages = availableLanguages();

  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      {compact && <Languages className="w-4 h-4 text-muted shrink-0" aria-hidden />}
      <UISelect
        aria-label={t("settings.language.title")}
        value={language}
        onChange={(event) => {
          playSound("pop");
          PreferencesAPI.update({ language: event.target.value });
        }}
        className={compact ? "w-auto! min-h-9! py-1! text-sm!" : "w-auto! max-w-[14rem]"}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code} lang={lang.code}>
            {lang.name === lang.englishName ? lang.name : `${lang.name} · ${lang.englishName}`}
          </option>
        ))}
      </UISelect>
    </label>
  );
};
