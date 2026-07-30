import React from "react";

const FOOTER_LINKS = [
  { label: "About", href: "/about" },
  { label: "Learning", href: "#learning" },
  { label: "For parents", href: "#for-parents" },
  { label: "FAQ", href: "#faq" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
] as const;

export const LandingFooter: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => (
  <footer className={`bg-white px-4 py-6 transition-colors dark:bg-[#080B18] sm:px-8 ${isDark ? "dark" : ""}`}>
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 pt-5 sm:flex-row">
      <a href="#hero" className="flex items-center gap-2" aria-label="Koda home">
        <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-lg" />
        <span className="text-sm font-black text-indigo-600 dark:text-indigo-300">Koda</span>
      </a>
      <p className="text-[10px] font-medium text-slate-400">A safe learning space for every child.</p>
      <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {FOOTER_LINKS.map(({ label, href }) => <a key={href} href={href} className="text-[10px] font-semibold text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300">{label}</a>)}
      </nav>
    </div>
  </footer>
);
