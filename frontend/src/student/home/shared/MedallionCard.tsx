import React from "react";
import type { LucideIcon } from "lucide-react";
import { MEDALLION } from "./dimensions";

export type MedallionTone = "purple" | "blue" | "green" | "amber" | "pink";

interface Props {
  tone?: MedallionTone;
  /** Authored skill artwork. */
  artUrl: string;
  title: string;
  /** Line under the title, e.g. the unit. */
  subtitle?: string;
  /** State pill — "New for you", "Practice", "Completed". */
  badge?: { icon?: LucideIcon; label: string };
  /** Number pills — minutes, XP, last score. Same pill grammar as the state badge. */
  meta?: string | string[];
  onClick: () => void;
  /** Announced instead of the bare title, e.g. "Play Count to 10". */
  actionLabel?: string;
}

/**
 * Recommendation card: a tinted card holding a ringed art medallion, the title, and pills.
 *
 * The whole card is the button — a child should not have to find a small target — and the tint
 * comes from the skill's authored accent so a row of recommendations reads as distinct cards
 * rather than a striped list.
 */
const TONE: Record<MedallionTone, { card: string; ring: string; medallion: string; pill: string }> = {
  purple: {
    card: "bg-[#F3EFFF] ring-[#E4DBFF] dark:bg-violet-400/10 dark:ring-violet-400/20",
    ring: "ring-white/85 dark:ring-white/15",
    medallion: "bg-[image:radial-gradient(circle_at_32%_28%,#FFFFFF_0%,#E7DEFF_46%,#C9B8FF_100%)] dark:bg-[image:radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.22)_0%,rgba(160,130,255,0.28)_100%)]",
    pill: "bg-white/80 text-[#5C46DF] dark:bg-white/10 dark:text-[#C3B4FF]",
  },
  blue: {
    card: "bg-[#EAF4FF] ring-[#D6E9FF] dark:bg-sky-400/10 dark:ring-sky-400/20",
    ring: "ring-white/85 dark:ring-white/15",
    medallion: "bg-[image:radial-gradient(circle_at_32%_28%,#FFFFFF_0%,#DDEEFF_46%,#AFD8FF_100%)] dark:bg-[image:radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.22)_0%,rgba(110,180,255,0.28)_100%)]",
    pill: "bg-white/80 text-[#2A6FB8] dark:bg-white/10 dark:text-sky-200",
  },
  green: {
    card: "bg-[#E8F8EF] ring-[#D2EFDF] dark:bg-emerald-400/10 dark:ring-emerald-400/20",
    ring: "ring-white/85 dark:ring-white/15",
    medallion: "bg-[image:radial-gradient(circle_at_32%_28%,#FFFFFF_0%,#DCF5E7_46%,#A9E7C6_100%)] dark:bg-[image:radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.22)_0%,rgba(90,220,160,0.26)_100%)]",
    pill: "bg-white/80 text-[#1E7A55] dark:bg-white/10 dark:text-emerald-200",
  },
  amber: {
    card: "bg-[#FFF5E4] ring-[#FCE7C6] dark:bg-amber-400/10 dark:ring-amber-400/20",
    ring: "ring-white/85 dark:ring-white/15",
    medallion: "bg-[image:radial-gradient(circle_at_32%_28%,#FFFFFF_0%,#FFF0D6_46%,#FFD99B_100%)] dark:bg-[image:radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.22)_0%,rgba(255,190,90,0.26)_100%)]",
    pill: "bg-white/80 text-[#9A6212] dark:bg-white/10 dark:text-amber-200",
  },
  pink: {
    card: "bg-[#FFEEF4] ring-[#FBD9E5] dark:bg-pink-400/10 dark:ring-pink-400/20",
    ring: "ring-white/85 dark:ring-white/15",
    medallion: "bg-[image:radial-gradient(circle_at_32%_28%,#FFFFFF_0%,#FFE3EE_46%,#FFB9D3_100%)] dark:bg-[image:radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.22)_0%,rgba(255,150,190,0.26)_100%)]",
    pill: "bg-white/80 text-[#B03A69] dark:bg-white/10 dark:text-pink-200",
  },
};

/** Three sparkles inside the medallion, fixed so they never land on the subject's face. */
const Sparkles: React.FC = () => (
  <>
    <span className="pointer-events-none absolute left-[14%] top-[18%] h-1.5 w-1.5 rounded-full bg-white/90" />
    <span className="pointer-events-none absolute right-[16%] top-[26%] h-1 w-1 rounded-full bg-white/80" />
    <span className="pointer-events-none absolute left-[22%] bottom-[16%] h-1 w-1 rounded-full bg-white/70" />
  </>
);

export const MedallionCard: React.FC<Props> = ({
  tone = "purple",
  artUrl,
  title,
  subtitle,
  badge,
  meta,
  onClick,
  actionLabel,
}) => {
  const styles = TONE[tone];
  const BadgeIcon = badge?.icon;
  const metaPills = (Array.isArray(meta) ? meta : meta ? [meta] : []).filter(Boolean);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={actionLabel ?? title}
      className={`group flex flex-col items-center rounded-[1.75rem] px-4 py-5 text-center ring-1 ring-inset outline-none transition-transform hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:translate-y-0 ${styles.card}`}
    >
      <span
        className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-4 ${MEDALLION} ${styles.medallion} ${styles.ring}`}
      >
        <Sparkles />
        <img
          src={artUrl}
          alt=""
          className="h-[76%] w-[76%] object-contain mix-blend-multiply dark:mix-blend-normal"
        />
      </span>

      <h3 className="mt-4 text-lg font-black leading-tight text-[#21183D] dark:text-[#F2EEFF]">{title}</h3>
      {subtitle && (
        <p className="mt-0.5 line-clamp-1 text-[11px] font-bold text-[#6E6480] dark:text-[#9A94B8]">{subtitle}</p>
      )}

      {(badge || metaPills.length > 0) && (
        <span className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
          {badge && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black ${styles.pill}`}>
              {BadgeIcon && <BadgeIcon size={12} />} {badge.label}
            </span>
          )}
          {metaPills.map(pill => (
            <span
              key={pill}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${styles.pill}`}
            >
              {pill}
            </span>
          ))}
        </span>
      )}
    </button>
  );
};
