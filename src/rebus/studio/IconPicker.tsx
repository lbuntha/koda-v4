/**
 * Choose a drawing for a puzzle from the library: every icon, searchable by
 * name, so an author adds what exists instead of describing what they wish did.
 */

import React, { useMemo, useState } from "react";
import { useT } from "../../lib/i18n";
import { UISearchInput } from "../../components/ui";
import { SvgMarkup } from "../../assets/svg";
import { useRebusIcons } from "../icons/useRebusIcons";

/** Drawings made for math questions (a clock for any time, a slice for any fraction): there are many, so they come last. */
const MATH_DRAWING = /^(shape|dice|frame|frac|clock|tally|array|grid|angle|thermo|length)-/;

export const IconPicker: React.FC<{ onPick(id: string, name: string): void }> = ({ onPick }) => {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const icons = useRebusIcons();
  const shown = useMemo(() => {
    const found = icons.filter((i) => i.name.includes(query.trim().toLowerCase()));
    return [...found.filter((i) => !MATH_DRAWING.test(i.name)), ...found.filter((i) => MATH_DRAWING.test(i.name))];
  }, [icons, query]);
  return (
    <div className="flex flex-col gap-2">
      <UISearchInput size="sm" label={t("rebus.studio.searchIcons")} value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="grid max-h-56 grid-cols-5 gap-1.5 overflow-y-auto rounded-2xl border border-line bg-surface-muted p-2 sm:grid-cols-7 lg:grid-cols-9" role="group" aria-label={t("rebus.studio.icons")}>
        {shown.map(({ id, name, markup }) => (
          <button
            key={name}
            type="button"
            onClick={() => onPick(id, name)}
            aria-label={name}
            title={name}
            className="flex aspect-square flex-col items-center justify-center rounded-xl border border-line bg-white p-1 hover:border-indigo-400 pointer-coarse:min-h-11"
          >
            <SvgMarkup markup={markup} raw size="100%" />
          </button>
        ))}
        {shown.length === 0 && <p className="col-span-full p-2 text-sm text-muted">{t("rebus.studio.noIcons")}</p>}
      </div>
    </div>
  );
};
