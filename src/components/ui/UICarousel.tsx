import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { UIButton } from "./ThemeUI";
import { useT } from "../../lib/i18n";

/**
 * A titled row that scrolls sideways — the shelf of a streaming home.
 *
 * Arrows appear where there is a mouse to need them (from `sm` up) and only
 * light up when there is more to that side. Once a row holds more than fits,
 * "See all" opens it out into a grid, so a long shelf is one tap from being
 * browsable rather than an endless swipe. Children are `<li>`s; `itemClass`
 * sizes them in the strip and `gridClass` lays them out when opened.
 */
export const UICarousel: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  count: number;
  /** Width of each `<li>` in the strip, e.g. `[&>li]:w-40`. */
  itemClass: string;
  /** Columns of the opened-out grid. */
  gridClass: string;
  /** Offer "See all" above this many. */
  seeAllAfter?: number;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon, count, itemClass, gridClass, seeAllAfter = 5, children, className = "" }) => {
  const { t } = useT();
  const strip = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [edge, setEdge] = useState({ left: false, right: false });
  const measure = () => {
    const el = strip.current;
    if (el) setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [count, open]);
  const nudge = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * strip.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink sm:text-xl">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {!open && (edge.left || edge.right) && (
          <div className="hidden gap-1 sm:flex">
            <UIButton type="button" variant="ghost" size="icon" icon={<ChevronLeft />} disabled={!edge.left} onClick={() => nudge(-1)} aria-label={t("common.scrollBack")} />
            <UIButton type="button" variant="ghost" size="icon" icon={<ChevronRight />} disabled={!edge.right} onClick={() => nudge(1)} aria-label={t("common.scrollOn")} />
          </div>
        )}
        {(count > seeAllAfter || open) && (
          <UIButton type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? t("common.showLess") : t("common.seeAll", { count })}
          </UIButton>
        )}
      </div>
      {open ? (
        <ul className={`grid gap-3 ${gridClass}`}>{children}</ul>
      ) : (
        <ul
          ref={strip}
          onScroll={measure}
          className={`-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>li]:shrink-0 [&>li]:snap-start sm:mx-0 sm:px-0 ${itemClass}`}
        >
          {children}
        </ul>
      )}
    </section>
  );
};
