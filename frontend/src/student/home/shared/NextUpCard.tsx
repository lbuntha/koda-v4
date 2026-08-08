import React from "react";
import { Clock3, Play, Sparkles, Zap } from "lucide-react";
import { Button, Card } from "../../../components/ui";

interface Props {
  title: string;
  description?: string;
  badge?: string;
  artUrl?: string;
  minutes?: number;
  questionCount: number;
  xp?: number;
  difficulty?: NextUpCardDifficulty;
  progress?: number;
  inProgress?: boolean;
  onStart: () => void;
}

export interface NextUpCardDifficulty {
  label: string;
  filled: number;
  level: "easy" | "medium" | "hard";
}

const DOT_COLOR: Record<NextUpCardDifficulty["level"], string> = {
  easy: "bg-emerald-400",
  medium: "bg-amber-400",
  hard: "bg-[#FF4D94]",
};
const DIFFICULTY_DOTS = [0, 1, 2] as const;

const DifficultyDots: React.FC<{ difficulty: NextUpCardDifficulty }> = ({ difficulty }) => (
  <span className="inline-flex items-center gap-1.5" title={`${difficulty.label} difficulty`}>
    <span className="flex gap-1" aria-hidden>
      {DIFFICULTY_DOTS.map(index => (
        <span
          key={index}
          className={`h-2.5 w-2.5 rounded-full ${
            index < difficulty.filled ? DOT_COLOR[difficulty.level] : "bg-[#E7E2F1] dark:bg-white/15"
          }`}
        />
      ))}
    </span>
    <span className="sr-only">{difficulty.label}</span>
  </span>
);

/** A featured skill card with only authored skill data and one clear launch action. */
export const NextUpCard: React.FC<Props> = ({
  title,
  description,
  badge = "Today’s skill",
  artUrl,
  minutes,
  questionCount,
  xp,
  difficulty,
  progress,
  inProgress,
  onStart,
}) => {
  const hasProgress = (progress ?? 0) > 0;
  const [artFailed, setArtFailed] = React.useState(false);

  React.useEffect(() => setArtFailed(false), [artUrl]);

  return (
    <section className="group relative mx-auto w-full max-w-5xl pb-3 sm:pr-32 lg:pr-44">
      <Card variant="activity" className="relative min-h-[20rem] overflow-hidden p-5 sm:min-h-60 sm:p-6 lg:min-h-64">
        <div className="max-w-[68%] sm:max-w-[66%]">
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#7C3AED] bg-[#7C3AED] px-3 py-1.5 text-[10px] font-black text-white shadow-[0_3px_0_#5421B8] sm:text-xs">
            <Sparkles size={13} className="shrink-0 fill-current" />
            <span className="truncate">{badge}</span>
          </span>

          <h2 className="mt-3 text-xl font-black leading-tight tracking-tight text-[#21143F] sm:text-2xl lg:text-[1.65rem] dark:text-[#F2EEFF]">
            {title}
          </h2>
          {description && (
            <p className="mt-1 line-clamp-2 text-sm font-bold text-[#9387AB] sm:text-base dark:text-[#A79FC4]">
              {description}
            </p>
          )}
        </div>

        <div className="absolute right-5 top-5 flex h-24 w-24 items-center justify-center sm:right-7 sm:top-6 sm:h-28 sm:w-28 lg:h-32 lg:w-32">
          {artUrl && !artFailed ? (
            <img
              src={artUrl}
              alt=""
              onError={() => setArtFailed(true)}
              className="h-full w-full object-contain drop-shadow-[0_10px_8px_rgba(59,48,92,0.16)] transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <span className="sr-only">{artFailed ? "Artwork failed to load" : "Skill artwork not available"}</span>
          )}
        </div>

        <div className="absolute inset-x-5 bottom-5 flex flex-col items-stretch gap-3 sm:inset-x-6 sm:bottom-6 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs font-black text-[#665D7B] sm:text-sm dark:text-[#BBB4CF]">
            {difficulty && <DifficultyDots difficulty={difficulty} />}
            {typeof minutes === "number" && (
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={16} className="text-[#8B82A3]" /> {minutes} min
              </span>
            )}
            {typeof xp === "number" && (
              <span className="inline-flex items-center gap-1.5">
                <Zap size={16} className="fill-current text-[#FFD22E]" /> {xp} XP
              </span>
            )}
            {!difficulty && typeof minutes !== "number" && typeof xp !== "number" && questionCount > 0 && (
              <span>{questionCount} question{questionCount === 1 ? "" : "s"}</span>
            )}
          </div>

          <Button
            type="button"
            size="lg"
            onClick={onStart}
            className="w-full shrink-0 sm:w-auto"
          >
            <Play size={16} className="fill-current" />
            {inProgress || hasProgress ? "Continue" : "Play"}
          </Button>
        </div>
      </Card>

      <img
        src="/assets/koda-bear-mascot.png"
        alt=""
        className="pointer-events-none absolute bottom-0 right-0 z-20 hidden h-48 w-auto object-contain drop-shadow-[0_14px_13px_rgba(62,51,102,0.2)] transition-transform duration-300 group-hover:-translate-y-1 sm:block lg:h-56"
      />
    </section>
  );
};
