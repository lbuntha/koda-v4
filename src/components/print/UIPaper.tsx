import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Paper. The one printable surface, for everything the app puts on it.
 *
 * A worksheet is the first, not the last — a child's report, a certificate, a
 * term's plan for a parents' evening are all the same object: a sheet with a
 * heading, a body and a rule about where the page breaks. Written once so the
 * second one is a layout rather than another argument with a print stylesheet.
 *
 * ## Printing exactly one thing
 *
 * The hard part is not the sheet, it is everything else on the screen. The first
 * version hid the app with `visibility: hidden`, which hides the ink and keeps
 * the *layout* — so a learning path eleven screens tall still paginated, and a
 * fifteen-question worksheet printed as twelve pages, eleven of them blank.
 *
 * So the printed copy lives outside the app entirely, in a `#print-root`
 * alongside `#root`, and printing hides every other child of `body` — stated
 * that way round because `UIModal` and anything else that portals is a sibling
 * of the app, not a descendant of it, and naming `#root` printed an empty
 * dialog frame. One flow on the page, which is the only way the page count can
 * be right. `PrintPreview` puts
 * the same paper in both places: the copy inside the dialog is what a person
 * reads, the copy in the portal is what the printer gets, and they cannot drift
 * because they are one element rendered twice.
 *
 * ## Why not a PDF library
 *
 * The browser has a print engine, a page size, a preview and a "save as PDF",
 * and it knows what paper this family has. A bundled renderer is a megabyte of
 * JavaScript spent arriving somewhere worse.
 */

/** Where the printed copy goes: a sibling of `#root`, so hiding the app is one rule. */
const PRINT_ROOT_ID = "print-root";

const printRoot = (): HTMLElement => {
  const existing = document.getElementById(PRINT_ROOT_ID);
  if (existing) return existing;
  const created = document.createElement("div");
  created.id = PRINT_ROOT_ID;
  document.body.appendChild(created);
  return created;
};

/**
 * Show `children` on screen, and give the printer its own copy.
 *
 * Mounted where the preview belongs. The portal copy is created on mount and
 * torn down with it, so nothing is left behind to print after a dialog closes.
 */
export const PrintPreview: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const node = printRoot();
    setTarget(node);
    return () => {
      // Only ours to remove, and only when nothing else is using it.
      if (node.childElementCount === 0) node.remove();
    };
  }, []);

  return (
    <>
      {/* The preview. Dropped at print time — the portal copy is the one that
          goes on the page, and printing both would print everything twice. */}
      <div data-print-hide className={className}>
        {children}
      </div>
      {target ? createPortal(children, target) : null}
    </>
  );
};

/** Send the printed copy to the printer. The browser takes it from here. */
export const printPaper = (): void => window.print();

export interface UIPaperProps {
  /** Small caps above the title — the skill, the child, whatever names the source. */
  eyebrow?: string;
  title: string;
  /** One line under the title. An instruction, a date range, a subtitle. */
  subtitle?: string;
  /**
   * Ruled blanks under the heading, for whoever fills the sheet in by hand.
   *
   * Paper convention rather than decoration: a worksheet that comes back to a
   * teacher without a name on it is a worksheet nobody can return.
   */
  blanks?: string[];
  /** Printed small at the foot of every sheet. Where it came from, usually. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * One sheet.
 *
 * Deliberately outside `themeSystem`: every other surface follows the viewer's
 * theme and this one follows the paper. A dark-mode worksheet is either an
 * unreadable preview or an empty ink cartridge.
 */
export const UIPaper: React.FC<UIPaperProps> = ({
  eyebrow,
  title,
  subtitle,
  blanks,
  footer,
  children,
}) => (
  <div className="paper bg-white text-slate-900 p-6 sm:p-8 rounded-xl border border-slate-200">
    <header className="border-b-2 border-slate-900 pb-3">
      {eyebrow && (
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{eyebrow}</p>
      )}
      <h1 className="mt-0.5 text-2xl font-black">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}

      {blanks && blanks.length > 0 && (
        <div className="mt-4 flex gap-8 text-[11px] uppercase tracking-widest text-slate-500">
          {blanks.map((label) => (
            <span key={label} className="flex flex-1 items-end gap-2">
              {label}
              <span className="min-w-0 flex-1 border-b border-slate-400" />
            </span>
          ))}
        </div>
      )}
    </header>

    <div className="mt-5">{children}</div>

    {footer && (
      <footer className="mt-8 border-t border-slate-200 pt-2 text-[10px] text-slate-400">
        {footer}
      </footer>
    )}
  </div>
);

/**
 * A boxed aside on the sheet — a worked example, a rule, a reminder.
 *
 * Reused rather than styled per sheet: whatever prints next will want to say
 * something before it starts asking, and a second hand-built panel is how two
 * printed pages come to look like they came from two different products.
 */
export const UIPaperNote: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = "" }) => (
  <aside className={`rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 ${className}`}>
    <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">{title}</h2>
    <div className="mt-1.5 text-[13px] leading-relaxed text-slate-700">{children}</div>
  </aside>
);

/**
 * A section that starts on a new page.
 *
 * The answer key is the reason: a grown-up hands over the questions and keeps
 * the answers, which only works if the two are not on the same sheet.
 */
export const UIPaperBreak: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = "",
}) => <section className={`paper-break ${className}`}>{children}</section>;
