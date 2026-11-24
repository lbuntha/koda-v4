import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SvgAsset } from "../../assets/svg";
import { translate } from "../../lib/i18n";
import { UIBurst } from "./UIBurst";
import { UIButton } from "./ThemeUI";

export interface UILevelUpProps {
  /** The level just reached, or null when there is nothing to celebrate. */
  level: number | null;
  onClose(): void;
}

/**
 * The moment a child's XP fills a level.
 *
 * Every activity pays XP into one total, so this is shown once, from the one
 * place XP is added, instead of each result screen noticing in its own way —
 * a level reached by reading a book deserves the same moment as one reached
 * in a lesson. It sits above whatever result screen is open; closing it
 * reveals that screen underneath.
 *
 * Quiet by design: a burst and a pop, nothing that loops, and no sound of its
 * own — the result screen under it already plays one, and two at once is noise.
 */
export const UILevelUp: React.FC<UILevelUpProps> = ({ level, onClose }) => {
  const card = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (level === null) return;
    card.current?.querySelector("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [level, onClose]);

  if (level === null || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] grid place-items-center bg-slate-900/50 p-4 backdrop-blur-sm dark:bg-slate-950/80"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-level-up-title"
        data-testid="level-up"
        ref={card}
        className="koda-celebrate relative w-full max-w-sm rounded-[32px] border-2 border-violet-200 bg-surface p-6 text-center shadow-2xl dark:border-violet-500/30"
        onClick={(event) => event.stopPropagation()}
      >
        <UIBurst className="left-1/2 top-16" />
        <div className="ui-pop-in mx-auto grid h-24 w-24 place-items-center rounded-full border-2 border-violet-200 bg-violet-50 shadow-[0_8px_30px_rgba(139,92,246,0.35)] dark:border-violet-500/40 dark:bg-violet-950/60">
          <SvgAsset untitled id="kit-trophy" size={56} />
        </div>
        <p className="mt-4 font-mono text-[11px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
          {translate("praise.levelUp.tag")}
        </p>
        <h2 id="ui-level-up-title" className="mt-1 text-3xl font-black tracking-tight text-ink">
          {translate("praise.levelUp.headline", { level })}
        </h2>
        <p className="mt-1 text-sm font-medium text-body">{translate("praise.levelUp.note")}</p>
        <UIButton fullWidth className="mt-5" onClick={onClose}>
          {translate("levelUpMoment.continue")}
        </UIButton>
      </div>
    </div>,
    document.body,
  );
};
