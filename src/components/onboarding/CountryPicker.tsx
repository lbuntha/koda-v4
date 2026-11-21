/**
 * Pick a country: type to search, tap a name. Names come in the reader's own
 * language (Khmer or English) and either language finds a match, so "Cam" and
 * "កម្ពុ" both find Cambodia. Cambodia and its neighbours come first.
 */

import React, { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { countryName, searchCountries } from "../../lib/countries";
import { themeSystem } from "../../lib/themeSystem";
import { useT } from "../../lib/i18n";

export const CountryPicker: React.FC<{ value: string | null; onChange(code: string): void; label: string }> = ({
  value,
  onChange,
  label,
}) => {
  const { t, language } = useT();
  const [query, setQuery] = useState("");
  const matches = useMemo(() => searchCountries(query, language), [query, language]);
  return (
    <div>
      <label className="relative block">
        <span className="sr-only">{label}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          type="search"
          className={`${themeSystem.field("lg", "w-full")} pl-12`}
          value={query}
          placeholder={value ? countryName(value, language) : t("aboutYou.countrySearch")}
          autoComplete="country-name"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <ul role="listbox" aria-label={label} className="mt-2 max-h-60 overflow-y-auto rounded-2xl border-2 border-line bg-surface p-1">
        {matches.length === 0 && <li className="px-4 py-3 text-sm text-muted">{t("aboutYou.noCountry")}</li>}
        {matches.map((code) => {
          const selected = value === code;
          return (
            <li key={code} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => {
                  onChange(code);
                  setQuery("");
                }}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-4 text-left text-base font-bold transition ${
                  selected ? "bg-violet-600 text-white" : "text-ink hover:bg-surface-muted"
                }`}
              >
                <span>{countryName(code, language)}</span>
                {selected && <Check className="h-5 w-5 shrink-0" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
