import React, { useEffect, useMemo, useState } from "react";
import { Award, Check, Circle, Crown, Sprout, TrendingUp } from "lucide-react";
import { ScoringConfig } from "../api/settings";
import { Badge, Button, Card } from "../components/ui";

interface Props {
  config: ScoringConfig;
}

const LEVELS = [
  { key: "not_started", label: "Not started", icon: Circle, color: "text-[#8D89AE]", well: "bg-[#F1EFF7]" },
  { key: "beginner", label: "Beginner", icon: Sprout, color: "text-sky-600", well: "bg-sky-50" },
  { key: "developing", label: "Developing", icon: TrendingUp, color: "text-[#6D55D8]", well: "bg-[#F1EDFF]" },
  { key: "proficient", label: "Proficient", icon: Award, color: "text-emerald-600", well: "bg-emerald-50" },
  { key: "master", label: "Master", icon: Crown, color: "text-amber-600", well: "bg-amber-50" },
] as const;

interface Requirement {
  label: string;
  value: string;
  explanation: string;
}

export const MasteryJourneySimulator: React.FC<Props> = ({ config }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [config]);

  const stage = useMemo(() => {
    const developingPlays = config.gates.developing.minPlays;
    const beginnerPossible = developingPlays > 1;
    const proficient = config.gates.proficient;
    const master = config.gates.master;
    const stages: Array<{
      title: string;
      summary: string;
      requirements: Requirement[];
      next: string;
    }> = [
      {
        title: "Mina has not practiced this skill yet",
        summary: "There is no verified evidence, so the skill has no mastery level.",
        requirements: [
          { label: "Questions completed", value: "0", explanation: "No attempt has been recorded." },
          { label: "Current score", value: "—", explanation: "A score needs at least one verified answer." },
        ],
        next: "Complete the first question.",
      },
      {
        title: beginnerPossible ? "Mina starts as Beginner" : "This draft skips Beginner",
        summary: beginnerPossible
          ? "The first verified answer proves that practice has started, but there is not enough evidence for Developing."
          : "Developing requires only one play, so a perfect first answer immediately satisfies that gate. The engine always awards the highest gate reached.",
        requirements: [
          {
            label: "Questions completed",
            value: `1 of ${developingPlays}`,
            explanation: beginnerPossible
              ? `${developingPlays - 1} more strong question${developingPlays - 1 === 1 ? "" : "s"} needed for the Developing play gate.`
              : "The first question already meets the Developing play gate.",
          },
          { label: "Sample score", value: "100%", explanation: "This example assumes a correct first try without hints." },
        ],
        next: `Reach ${developingPlays} questions and a ${Math.round(config.developingScore * 100)}% score.`,
      },
      {
        title: "Mina reaches Developing",
        summary: "She has enough early evidence, but Proficient requires more volume, multiple sessions, and challenge.",
        requirements: [
          { label: "Questions completed", value: `${developingPlays}`, explanation: `Developing requires at least ${developingPlays}.` },
          { label: "Score", value: `100% ≥ ${Math.round(config.developingScore * 100)}%`, explanation: "The sample score passes the Developing threshold." },
        ],
        next: `Reach ${proficient.minPlays} questions across ${proficient.minSessions} sessions, including ${proficient.minHardPlays} hard questions.`,
      },
      {
        title: "Mina reaches Proficient",
        summary: "She now shows strong understanding across enough practice sessions and difficult questions.",
        requirements: [
          { label: "Questions", value: `${proficient.minPlays}`, explanation: "The Proficient play gate is met." },
          { label: "Sessions", value: `${proficient.minSessions}`, explanation: "Evidence comes from separate learning sessions." },
          { label: "Hard questions", value: `${proficient.minHardPlays}`, explanation: "She has demonstrated the skill with challenge." },
          { label: "Score", value: `100% ≥ ${Math.round(config.proficientScore * 100)}%`, explanation: "The Proficient score threshold is met." },
        ],
        next: `Reach ${master.minPlays} questions across ${master.minDistinctDays} days and keep recent work at ${Math.round(master.minRecentScore * 100)}% or higher.`,
      },
      {
        title: "Mina reaches Master",
        summary: "Her evidence is accurate, challenging, and spaced over time. Master is earned—not assigned by placement.",
        requirements: [
          { label: "Questions", value: `${master.minPlays}`, explanation: "The Master play gate is met." },
          { label: "Practice days", value: `${master.minDistinctDays}`, explanation: "Practice is spaced across different calendar days." },
          { label: "Hard questions", value: `${master.minHardPlays}`, explanation: "The Master challenge gate is met." },
          { label: "Overall score", value: `100% ≥ ${Math.round(config.masterScore * 100)}%`, explanation: "The Master score threshold is met." },
          { label: "Recent score", value: `100% ≥ ${Math.round(master.minRecentScore * 100)}%`, explanation: "Recent work confirms the skill is still strong." },
        ],
        next: `Review again in ${config.reviewIntervalDays.master} days to keep the skill current.`,
      },
    ];
    return stages[step];
  }, [config, step]);

  const CurrentIcon = LEVELS[step].icon;

  return (
    <Card className="border-[#D9D1F5] bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EEEAF8] pb-3">
        <h3 className="koda-admin-section-title">Beginner-to-Master simulator</h3>
        <Badge variant="outline">Mina · sample learner</Badge>
      </div>

      <div className="mt-2.5 overflow-x-auto">
        <div className="flex min-w-[520px] items-center">
          {LEVELS.map((level, index) => {
            const Icon = level.icon;
            const complete = index < step;
            const active = index === step;
            return (
              <React.Fragment key={level.key}>
                <button
                  type="button"
                  onClick={() => setStep(index)}
                  className={`flex w-24 shrink-0 items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 text-center transition-colors ${
                    active ? "bg-[#F3F0FF]" : "hover:bg-[#FAF9FF]"
                  }`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${complete ? "bg-emerald-500 text-white" : `${level.well} ${level.color}`}`}>
                    {complete ? <Check size={13} /> : <Icon size={13} />}
                  </span>
                  <span className={`text-[11px] ${active ? "font-semibold text-[#17143D]" : "font-medium text-[#6D6997]"}`}>{level.label}</span>
                </button>
                {index < LEVELS.length - 1 && (
                  <span className={`h-1 min-w-6 flex-1 rounded-full ${index < step ? "bg-emerald-400" : "bg-[#E7E3F6]"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
        <div className="rounded-lg bg-[#FAF9FF] p-3">
          <div className="flex items-start gap-2.5">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${LEVELS[step].well} ${LEVELS[step].color}`}>
              <CurrentIcon size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#17143D]">{stage.title}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-[#6D6997]">{stage.summary}</p>
            </div>
          </div>
          <div className="mt-2.5 border-t border-[#E7E3F6] pt-2.5">
            <p className="koda-admin-chip text-[#8D89AE]">{step === LEVELS.length - 1 ? "Next review" : "Next level"}</p>
            <p className="mt-0.5 text-xs font-medium leading-4 text-[#534AB7]">{stage.next}</p>
          </div>
        </div>

        <div className="p-1">
          <p className="koda-admin-chip text-[#8D89AE]">Evidence at this step</p>
          <div className="mt-1 grid sm:grid-cols-2 2xl:grid-cols-3">
            {stage.requirements.map(requirement => (
              <div key={requirement.label} className="border-b border-[#EEEAF8] px-2 py-2 sm:odd:border-r">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-medium text-[#17143D]">{requirement.label}</p>
                  <span className="text-[11px] font-semibold text-[#534AB7]">{requirement.value}</span>
                </div>
                <p className="mt-0.5 text-[10px] leading-3.5 text-[#6D6997]">{requirement.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setStep(current => Math.max(0, current - 1))} disabled={step === 0}>Previous</Button>
          <Button size="sm" onClick={() => setStep(current => Math.min(LEVELS.length - 1, current + 1))} disabled={step === LEVELS.length - 1}>
            {step === 0 ? "Start practice" : "Next step"}
          </Button>
      </div>
    </Card>
  );
};
