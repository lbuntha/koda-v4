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
    <footer className="border-t border-[#E6E0F5] bg-[#F8F7FD]/90 px-5 py-5 sm:px-8 dark:border-white/10 dark:bg-[#141827]/90">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
        <div>
          <p className="text-xs font-extrabold text-[#332750] dark:text-[#D6D2EC]">
            © {new Date().getFullYear()} {brand}
          </p>
          <p className="mt-1 text-[10px] font-bold text-[#8A809E] dark:text-[#8B85A6]">{tagline}</p>
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
                className="rounded-full text-[#655A78] dark:text-[#B6B0CE] dark:hover:bg-white/10"
              >
                {link.label}
              </Button>
            ))}
          </nav>
        )}

        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[10px] font-extrabold text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/10 dark:text-emerald-300">
          <ShieldCheck size={13} /> Safe learner space
        </div>
      </div>
    </footer>
  );
};
