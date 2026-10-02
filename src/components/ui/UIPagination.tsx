import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { UIButton } from "./ThemeUI";
import { themeSystem } from "../../lib/themeSystem";
import { useT } from "../../lib/i18n";

/**
 * Paging for a long list: first, previous, a page you can type, next, last.
 *
 * Previous/Next alone is fine for three pages and useless for three hundred —
 * an admin looking for the books they wrote last spring should be able to jump
 * there. The typed page is only applied on Enter or leaving the box, so typing
 * "12" does not fetch page 1 on the way.
 */
export const UIPagination: React.FC<{
  page: number;
  pages: number;
  onPage(page: number): void;
  disabled?: boolean;
  className?: string;
}> = ({ page, pages, onPage, disabled = false, className = "" }) => {
  const { t } = useT();
  const [typed, setTyped] = useState(String(page));
  useEffect(() => setTyped(String(page)), [page]);
  if (pages <= 1) return null;
  const go = (n: number) => {
    const next = Math.min(pages, Math.max(1, Math.round(n)));
    setTyped(String(next));
    if (next !== page) onPage(next);
  };
  const commit = () => (Number.isFinite(Number(typed)) && typed.trim() ? go(Number(typed)) : setTyped(String(page)));
  return (
    <nav aria-label={t("pager.label")} className={`flex items-center gap-1 ${className}`}>
      <UIButton type="button" variant="ghost" size="icon" icon={<ChevronsLeft />} disabled={disabled || page <= 1} onClick={() => go(1)} aria-label={t("pager.first")} title={t("pager.first")} />
      <UIButton type="button" variant="ghost" size="icon" icon={<ChevronLeft />} disabled={disabled || page <= 1} onClick={() => go(page - 1)} aria-label={t("pager.previous")} title={t("pager.previous")} />
      <label className="flex items-center gap-1.5 text-sm text-muted">
        <span className="sr-only">{t("pager.page")}</span>
        <input
          type="text"
          inputMode="numeric"
          value={typed}
          disabled={disabled}
          onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          aria-label={t("pager.page")}
          className={themeSystem.field("sm", "w-14 text-center text-sm")}
        />
        <span className="whitespace-nowrap">{t("pager.of", { pages })}</span>
      </label>
      <UIButton type="button" variant="ghost" size="icon" icon={<ChevronRight />} disabled={disabled || page >= pages} onClick={() => go(page + 1)} aria-label={t("pager.next")} title={t("pager.next")} />
      <UIButton type="button" variant="ghost" size="icon" icon={<ChevronsRight />} disabled={disabled || page >= pages} onClick={() => go(pages)} aria-label={t("pager.last")} title={t("pager.last")} />
    </nav>
  );
};
