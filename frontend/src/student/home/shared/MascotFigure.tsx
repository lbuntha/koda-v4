import React from "react";
import { KidAvatar } from "../../../components/KidAvatar";
import { MASCOT } from "./dimensions";

export type MascotTone = "amber" | "violet" | "emerald" | "sky" | "rose";

interface Props {
  /** The learner's chosen avatar key (an emoji), mapped to SVG artwork. */
  avatar?: string | null;
  tone?: MascotTone;
  /** Small floating shapes around the figure, as in the welcome-band design. */
  confetti?: boolean;
}

const GLOW: Record<MascotTone, string> = {
  amber: "bg-[image:radial-gradient(circle,rgba(255,196,75,0.30)_0%,transparent_66%)]",
  violet: "bg-[image:radial-gradient(circle,rgba(124,99,245,0.26)_0%,transparent_66%)]",
  emerald: "bg-[image:radial-gradient(circle,rgba(63,201,138,0.26)_0%,transparent_66%)]",
  sky: "bg-[image:radial-gradient(circle,rgba(63,169,245,0.26)_0%,transparent_66%)]",
  rose: "bg-[image:radial-gradient(circle,rgba(255,122,156,0.26)_0%,transparent_66%)]",
};

const DISC: Record<MascotTone, string> = {
  amber: "bg-[image:linear-gradient(160deg,#FFD277,#F5A22E)]",
  violet: "bg-[image:linear-gradient(160deg,#9A85FF,#5B43DD)]",
  emerald: "bg-[image:linear-gradient(160deg,#5FDCA6,#159C68)]",
  sky: "bg-[image:linear-gradient(160deg,#6FC0FA,#1D6FD0)]",
  rose: "bg-[image:linear-gradient(160deg,#FF9BB4,#E23E67)]",
};

/** Decorative shapes: fixed positions so they never overlap the figure's face. */
const Confetti: React.FC = () => (
  <>
    <span className="absolute -left-6 top-2 h-2.5 w-2.5 rounded-full bg-amber-300" />
    <span className="absolute -right-3 top-8 h-2 w-2 rounded-full bg-pink-300" />
    <span className="absolute -left-8 bottom-8 h-3 w-3 rotate-12 rounded-[4px] bg-violet-300/70" />
    <span className="absolute -right-6 bottom-4 h-2.5 w-2.5 rounded-full bg-sky-300" />
  </>
);

/**
 * The learner's mascot in the welcome band. The artwork is a white silhouette (it is the same
 * set the parent profile tiles use), so it sits on a tinted disc with a soft glow behind —
 * without that it would vanish on the light page.
 */
export const MascotFigure: React.FC<Props> = ({ avatar, tone = "amber", confetti = true }) => (
  <div className="relative flex shrink-0 items-center justify-center">
    <span aria-hidden className={`pointer-events-none absolute inset-[-18%] rounded-full blur-xl ${GLOW[tone]}`} />
    {confetti && <Confetti />}
    <span
      className={`relative flex items-center justify-center overflow-hidden rounded-full ring-4 ring-white/70 dark:ring-white/10 ${MASCOT} ${DISC[tone]}`}
    >
      <KidAvatar avatar={avatar} className="h-[74%] w-[74%] translate-y-[6%] text-5xl" />
    </span>
  </div>
);
