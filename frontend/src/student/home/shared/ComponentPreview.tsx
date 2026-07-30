/**
 * Component gallery for the learner cards, mounted at `/?preview=learner-cards`.
 *
 * It renders the *real* components rather than a mock-up, so what is reviewed here is exactly
 * what ships. Unlinked from the app; it exists to check a design against a reference before the
 * page is rebuilt around it.
 */

import React from "react";
import { CheckCircle2, Flame, RotateCcw, Sparkles, Star, Target, Zap } from "lucide-react";
import {
  ActivityCard,
  MedallionCard,
  NextUpCard,
  ProgressMeter,
  SectionHeader,
  MascotFigure,
  RecommendationCard,
  SkillPathCard,
  StatTile,
  StreakChip,
  type MedallionTone,
} from "./index";
import { useThemeMode } from "../../../theme/appTheme";
import { ThemeToggle } from "../../../theme/ThemeToggle";

const ART = {
  baskets: "/assets/components/move-and-count.svg",
  ten: "/assets/curriculum/count-to-10.svg",
  owl: "/assets/owl-mascot.svg",
};

const Block: React.FC<{ title: string; note?: string; children: React.ReactNode }> = ({ title, note, children }) => (
  <section className="mt-10 first:mt-0">
    <h2 className="text-sm font-black uppercase tracking-[0.14em] text-[#6F5CC4] dark:text-[#C3B4FF]">{title}</h2>
    {note && <p className="mt-1 text-xs font-semibold text-[#6E6480] dark:text-[#9A94B8]">{note}</p>}
    <div className="mt-4">{children}</div>
  </section>
);

const Frame: React.FC<{ label: string; width: number; children: React.ReactNode }> = ({ label, width, children }) => (
  <div className="shrink-0">
    <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#9187A3]">{label} · {width}px</p>
    <div style={{ width }} className="rounded-2xl bg-white/40 p-3 ring-1 ring-inset ring-black/5 dark:bg-white/5 dark:ring-white/10">
      {children}
    </div>
  </div>
);

export const ComponentPreview: React.FC = () => {
  const [theme, toggleTheme] = useThemeMode();
  const tones: MedallionTone[] = ["purple", "blue", "green", "amber", "pink"];

  return (
    <div
      className={`min-h-screen bg-[#F7F4FF] px-5 py-8 text-[#21183D] sm:px-8 dark:bg-[#0E0A20] dark:text-[#EDE9FF] ${
        theme === "dark" ? "dark" : ""
      }`}
    >
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Learner cards — preview</h1>
            <p className="mt-1 text-sm font-semibold text-[#6E6480] dark:text-[#9A94B8]">
              The real components. Toggle the theme to check both, and compare widths for phone / tablet / computer.
            </p>
          </div>
          <ThemeToggle theme={theme} onToggle={toggleTheme} variant="round" />
        </header>

        <Block title="Recommendation card" note="RecommendationCard — scene art, reason pill, minutes · XP, round play.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RecommendationCard
              tone="purple"
              title="Spot the number"
              subtitle="Counting & Number Sense"
              artUrl={ART.ten}
              reason="Because you practised counting"
              minutes={3}
              xp={20}
              onStart={() => undefined}
            />
            <RecommendationCard
              tone="green"
              title="Add within 10"
              subtitle="Addition"
              artUrl={ART.baskets}
              reason="Next in your plan"
              minutes={4}
              xp={24}
              onStart={() => undefined}
            />
            <RecommendationCard
              tone="pink"
              title="Take away within 10"
              subtitle="Subtraction"
              artUrl={ART.owl}
              reason="Because you missed two questions"
              minutes={5}
              xp={30}
              onStart={() => undefined}
            />
          </div>
        </Block>

        <Block title="Recommendation card — widths" note="Phone, tablet and computer column widths.">
          <div className="flex flex-wrap gap-5">
            {[
              { label: "Phone", width: 320 },
              { label: "Tablet", width: 380 },
              { label: "Computer", width: 460 },
            ].map(frame => (
              <Frame key={frame.label} {...frame}>
                <RecommendationCard
                  tone="purple"
                  title="Spot the number"
                  subtitle="Counting & Number Sense"
                  artUrl={ART.ten}
                  reason="Because you practised counting"
                  minutes={3}
                  xp={20}
                  onStart={() => undefined}
                />
              </Frame>
            ))}
          </div>
        </Block>

        <Block title="Medallion card (alternative)" note="MedallionCard — one per accent tone, whole card is the button.">
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {tones.map((tone, index) => (
              <MedallionCard
                key={tone}
                tone={tone}
                artUrl={[ART.baskets, ART.ten, ART.owl][index % 3]}
                title={["Count to 10", "Add within 10", "Take away within 10", "Spot the number", "Make ten pairs"][index]}
                subtitle="Counting & Number Sense"
                badge={{ icon: [Sparkles, Target, CheckCircle2, Sparkles, Star][index], label: ["New for you", "Practice", "Completed", "New for you", "Stretch"][index] }}
                meta={["3 min · 20 XP", "4 min · 24 XP", "+20 XP earned", "2 min · 16 XP", "5 min · 30 XP"][index]}
                onClick={() => undefined}
              />
            ))}
          </div>
        </Block>

        <Block title="Recommendation card — widths" note="Same component at phone, tablet and computer column widths.">
          <div className="flex flex-wrap gap-5">
            {[
              { label: "Phone", width: 168 },
              { label: "Tablet", width: 232 },
              { label: "Computer", width: 300 },
            ].map(frame => (
              <Frame key={frame.label} {...frame}>
                <MedallionCard
                  tone="pink"
                  artUrl={ART.ten}
                  title="Count to 10"
                  subtitle="Counting & Number Sense"
                  badge={{ icon: Sparkles, label: "New for you" }}
                  meta="3 min · 20 XP"
                  onClick={() => undefined}
                />
              </Frame>
            ))}
          </div>
        </Block>

        <Block title="Skill path card" note="SkillPathCard — due pill, one ladder segment per skill, next-up line, milestone row.">
          <div className="grid gap-4 lg:grid-cols-2">
            <SkillPathCard
              title="Counting & Number Sense"
              rungs={["master", "master", "proficient", "developing", "not_started"]}
              mastered={2}
              total={5}
              progress={0.65}
              duePractice={2}
              nextSkill={{ label: "Count to 20", level: "proficient" }}
              milestone="Count to 20"
              tone="violet"
            />
            <SkillPathCard
              title="Addition"
              rungs={["developing", "beginner", "not_started"]}
              mastered={0}
              total={3}
              progress={0.25}
              nextSkill={{ label: "Add within 10", level: "developing" }}
              tone="emerald"
            />
            <SkillPathCard
              title="Subtraction"
              rungs={["beginner", "not_started", "not_started"]}
              mastered={0}
              total={3}
              progress={0.083}
              duePractice={3}
              tone="rose"
            />
            {/* Fully mastered: every segment full, no next-up line. */}
            <SkillPathCard
              title="Shapes & Measures"
              rungs={["master", "master", "master", "master"]}
              mastered={4}
              total={4}
              progress={1}
              milestone="Sort by size"
              tone="amber"
            />
          </div>
        </Block>

        <Block title="Next up card" note="NextUpCard — welcome-band hero.">
          <div className="max-w-2xl">
            <NextUpCard
              title="Count to 10"
              description="Count each object once and discover how many there are."
              artUrl={ART.baskets}
              minutes={3}
              questionCount={2}
              xp={26}
              progress={0.65}
              onStart={() => undefined}
            />
          </div>
        </Block>

        <Block title="Activity card" note="ActivityCard — the alternative wide-art card, four states.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ActivityCard state="next" title="Count to 10" context="Counting" artUrl={ART.baskets} minutes={3} questionCount={2} xp={26} onStart={() => undefined} />
            <ActivityCard state="practice" title="Spot the number" context="Counting" artUrl={ART.ten} minutes={2} questionCount={2} xp={20} lastScore={0.6} onStart={() => undefined} />
            <ActivityCard state="completed" title="Add within 10" artUrl={ART.owl} xpEarned={20} onStart={() => undefined} />
            <ActivityCard state="new" title="Take away within 10" context="Subtraction" artUrl={ART.baskets} minutes={4} questionCount={3} xp={24} onStart={() => undefined} />
          </div>
        </Block>

        <Block title="Welcome band" note="MascotFigure + StatTile — sized to content, captions never clipped.">
          <div className="rounded-[1.5rem] bg-white/60 p-5 dark:bg-white/5">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0">
                <h3 className="text-2xl font-black tracking-tight sm:text-3xl">Ready to learn, Jutta?</h3>
                <p className="mt-1.5 text-sm font-bold text-[#6B6280] dark:text-[#A79FC4]">Your next adventure is ready.</p>
                <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] font-black text-[#5C46DF] dark:bg-white/10 dark:text-[#C3B4FF]">
                  <Star size={12} className="fill-current" /> Today’s number quest · 1 / 3 done
                </p>
              </div>
              <MascotFigure avatar="🐝" tone="amber" />
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <StatTile icon={Flame} tone="amber" value={5} label="day streak" />
              <StatTile icon={Zap} tone="violet" value={240} label="XP earned" />
              <StatTile icon={Star} tone="emerald" value={12} label="skills mastered" />
              <StatTile icon={CheckCircle2} tone="sky" value={8} label="activities done" />
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-6">
              {(["🐝", "🐼", "🦊", "🐳", "🦉"] as const).map((avatar, index) => (
                <MascotFigure
                  key={avatar}
                  avatar={avatar}
                  tone={(["amber", "violet", "rose", "sky", "emerald"] as const)[index]}
                  confetti={false}
                />
              ))}
            </div>
          </div>
        </Block>

        <Block title="Small parts" note="StatTile, StreakChip, SectionHeader, ProgressMeter.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile icon={Flame} tone="amber" value={5} label="day streak" />
              <StatTile icon={Zap} tone="violet" value={240} label="XP earned" />
              <StatTile icon={Star} tone="emerald" value={12} label="skills mastered" />
              <StatTile icon={CheckCircle2} tone="sky" value={8} label="activities done" />
            </div>
            <div className="space-y-4 rounded-2xl bg-white/70 p-4 dark:bg-white/5">
              <StreakChip days={5} />
              <SectionHeader icon={Sparkles} title="Your next activities" subtitle="A mix of new, practice and finished" action={{ label: "See all", onClick: () => undefined }} />
              <ProgressMeter value={0.65} label="65% mastered" trailing="18 of 25" />
              <ProgressMeter value={0.72} tone="amber" knob size="md" trailing="with handle" />
              <div className="flex items-center gap-2 text-xs font-bold text-[#6E6480] dark:text-[#9A94B8]">
                <RotateCcw size={13} /> Replay affordance
              </div>
            </div>
          </div>
        </Block>
      </div>
    </div>
  );
};
