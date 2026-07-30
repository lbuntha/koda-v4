import React, { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Badge, Button, Card } from "../components/ui";

const FAQ_ITEMS = [
  {
    question: "How does my child get started?",
    answer: "Create a learner profile, then open Today’s learning path. Koda serves activities from the curriculum assigned to that child.",
  },
  {
    question: "What can children practice today?",
    answer: "The current library includes number sense, addition, subtraction, multiplication, sorting, patterns, Sudoku, and logic activities.",
  },
  {
    question: "How does Koda choose what comes next?",
    answer: "Koda uses assigned curriculum, recorded mastery, completed work, and review timing to suggest reinforcement, review, or a new skill.",
  },
  {
    question: "What can parents see?",
    answer: "Authorized guardians can view recorded activity, time on task, accuracy, independence, mastery, streaks, XP, and recent recommendations.",
  },
  {
    question: "How do XP and streaks work?",
    answer: "Rewards come from verified learning events and curriculum rules. Repeated event records do not create duplicate XP, and streaks count eligible activity days.",
  },
  {
    question: "Can I manage my child’s learning data?",
    answer: "Yes. An authorized guardian can export a child’s learning data or permanently delete it with the child profile.",
  },
] as const;

export const LandingFaq: React.FC<{ isDark?: boolean }> = ({ isDark = false }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className={`scroll-mt-20 bg-slate-50 px-4 py-16 transition-colors dark:bg-[#080B18] sm:px-8 sm:py-20 ${isDark ? "dark" : ""}`}
    >
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
        <div className="lg:pt-3">
          <Badge variant="default" className="gap-1.5"><HelpCircle size={12} /> FAQ</Badge>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            Clear answers about Koda.
          </h2>
          <p className="mt-4 max-w-md text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            A quick guide to learning paths, progress, rewards, and family controls already available in the app.
          </p>
        </div>

        <Card className="divide-y divide-slate-100 overflow-hidden border-slate-200/70 bg-white shadow-[0_12px_36px_rgba(62,49,126,0.06)] dark:divide-white/10 dark:border-white/10 dark:bg-[#141A2C]">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            const panelId = `faq-answer-${index}`;
            return (
              <div key={item.question}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className={`h-auto w-full justify-between gap-5 rounded-none px-5 py-4 text-left text-sm font-semibold transition-colors sm:px-6 ${
                    isOpen
                      ? "bg-indigo-50/70 text-indigo-950 hover:bg-indigo-50 dark:bg-indigo-400/10 dark:text-indigo-100 dark:hover:bg-indigo-400/15"
                      : "text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-white/5"
                  }`}
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-indigo-600 dark:text-indigo-300" : "text-slate-400"}`}
                  />
                </Button>
                {isOpen && (
                  <div id={panelId} className="bg-indigo-50/25 px-5 pb-5 pt-1 text-sm font-medium leading-relaxed text-slate-600 dark:bg-indigo-400/[0.04] dark:text-slate-300 sm:px-6">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </section>
  );
};
