import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "../../../components/ui";
import type { KidUnitCard } from "../kidHomeModel";
import { LearningPathSkillCard } from "../shared";

interface Props {
  units: KidUnitCard[];
  subtitle: string;
  thumbnailBySkillId: ReadonlyMap<string, string | undefined>;
  nextSkillId?: string | null;
  onStartSkill: (skillId: string) => void;
  onViewAll: () => void;
}

/** One continuous curriculum path composed from the reusable skill-node cards. */
export const LearningPathSection: React.FC<Props> = ({
  units,
  subtitle,
  thumbnailBySkillId,
  nextSkillId,
  onStartSkill,
  onViewAll,
}) => {
  const skills = units.flatMap(unit => unit.skills);

  if (skills.length === 0) return null;

  return (
    <section
      id="kid-paths"
      aria-label={subtitle}
      className="mt-6 overflow-hidden rounded-[1.6rem] bg-white px-4 pb-5 pt-4 shadow-[0_18px_42px_-34px_rgba(26,42,68,0.65)] sm:px-5 dark:bg-[#0D2035] dark:shadow-none"
    >
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-base font-black text-[#27334A] sm:text-lg dark:text-white">Your Learning Path</h2>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onViewAll}
          className="shrink-0 rounded-full px-2 text-[10px] font-extrabold text-[#6954D9] hover:bg-violet-50 dark:text-[#9C89FF] dark:hover:bg-white/5"
        >
          View all <ArrowRight size={13} />
        </Button>
      </header>

      <div className="relative mt-4">
        <ol
          className="relative flex snap-x gap-4 overflow-x-auto px-1 pb-2 pt-1 [scrollbar-color:#CBD3E0_transparent] [scrollbar-width:thin] sm:gap-5"
        >
          {skills.map(skill => (
            <li key={skill.skillId} className="snap-start">
              <LearningPathSkillCard
                skill={skill}
                artUrl={thumbnailBySkillId.get(skill.skillId)}
                isNext={skill.skillId === nextSkillId}
                onStart={onStartSkill}
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
