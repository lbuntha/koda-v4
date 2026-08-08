import React from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui";

export interface StudentFooterLink {
  label: string;
  targetId: string;
}

interface StudentFooterProps {
  links?: StudentFooterLink[];
  brand?: string;
  tagline?: string;
}

/** Shared footer for learner-facing pages. Navigation targets real page sections. */
export const StudentFooter: React.FC<StudentFooterProps> = ({
  links = [],
  brand = "Koda Learning",
  tagline = "Making practice feel like play.",
}) => {
  const navigate = (targetId: string) => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <footer className="border-t-2 border-[#E7E3F6] bg-[#F8F6FF] px-5 py-6 shadow-[0_-8px_28px_-24px_rgba(83,74,183,0.38)] sm:px-8 dark:border-white/10 dark:bg-[#141827] dark:shadow-[0_-8px_28px_-24px_rgba(0,0,0,0.7)]">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div>
          <p className="text-sm font-extrabold text-[#332750] dark:text-[#D6D2EC]">
            © {new Date().getFullYear()} {brand}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[#6E6480] dark:text-[#9B95B5]">{tagline}</p>
        </div>

        {links.length > 0 && (
          <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Footer navigation">
            {links.map(link => (
              <Button
                key={link.targetId}
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => navigate(link.targetId)}
                className="h-8 rounded-xl border-2 border-[#E2DCF3] bg-white px-3 text-[#655A78] shadow-[0_3px_0_#E2DCF3] hover:border-[#D7CFF0] hover:bg-[#FDFBFF] hover:text-[#534AB7] dark:border-white/10 dark:bg-white/5 dark:text-[#C8C1DC] dark:shadow-[0_3px_0_#292D45] dark:hover:bg-white/10"
              >
                {link.label}
              </Button>
            ))}
          </nav>
        )}

        <div className="inline-flex h-9 items-center gap-1.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-3 text-[10px] font-extrabold text-emerald-800 shadow-[0_3px_0_#A7F3D0] dark:border-emerald-400/15 dark:bg-emerald-400/10 dark:text-emerald-300 dark:shadow-[0_3px_0_#183B35]">
          <ShieldCheck size={14} /> Safe learner space
        </div>
      </div>
    </footer>
  );
};
