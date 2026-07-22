/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Thin wrapper around AiGeneratorPanel in its skill-scoped mode (targetSkillId
 * set) — no second AI flow. The placeholder activeQuestion only exists to
 * satisfy the panel's prop contract; its "apply to current slide" path is
 * unreachable here since targetSkillId hides that button entirely.
 */

import React from "react";
import { CountingQuestion, CountingTechnique } from "../../types";
import { Skill, SkillCoverage } from "../../curriculum/types";
import { Drawer } from "../ui";
import { AiGeneratorPanel } from "../studio/ai-generator/AiGeneratorPanel";
import { createBlankSkillQuestion } from "./questionOps";

interface FillWithAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  skill: Skill;
  skillQuestions: CountingQuestion[];
  coverage: SkillCoverage;
  onAddSlides: (slides: CountingQuestion[]) => void;
}

export const FillWithAiDrawer: React.FC<FillWithAiDrawerProps> = ({
  isOpen,
  onClose,
  skill,
  skillQuestions,
  coverage,
  onAddSlides,
}) => {
  const initialPrompt = [skill.label, skill.description].filter(Boolean).join(" — ");
  const initialBatchCount = Math.max(1, coverage.shortfall);
  const placeholderQuestion = skillQuestions[0] ?? createBlankSkillQuestion(CountingTechnique.ONE_TO_ONE, skill.id);

  const handleAddSlides = (slides: CountingQuestion[]) => {
    onAddSlides(slides);
    onClose();
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={`Fill with AI — ${skill.label}`} widthClassName="w-full sm:w-[460px]">
      <AiGeneratorPanel
        key={skill.id}
        activeQuestion={placeholderQuestion}
        questions={skillQuestions}
        updateActiveQuestion={() => {}}
        onAddSlides={handleAddSlides}
        targetSkillId={skill.id}
        initialPrompt={initialPrompt}
        initialBatchCount={initialBatchCount}
      />
    </Drawer>
  );
};
