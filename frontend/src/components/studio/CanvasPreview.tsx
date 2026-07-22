/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Live, read-only render of a question's actual canvas — same component a
 * student would see (CANVAS_BY_TECHNIQUE), just wrapped in a fixed-height box
 * instead of the Studio tab's full zoom/grid chrome. Used wherever a teacher
 * is authoring a question but isn't inside the main Studio tab (e.g. the
 * Curriculum Studio "Add Question" drawer) and would otherwise have no way
 * to see what they're building before saving it.
 */

import React from "react";
import { CountingQuestion } from "../../types";
import { CANVAS_BY_TECHNIQUE } from "./canvasRegistry";
import { OneToOneCanvas } from "../canvases/OneToOneCanvas";
import { LazyBoundary } from "../LazyBoundary";

interface CanvasPreviewProps {
  question: CountingQuestion;
  isDark?: boolean;
  className?: string;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({ question, isDark = false, className }) => {
  const Canvas = CANVAS_BY_TECHNIQUE[question.technique] || OneToOneCanvas;

  return (
    <div className={className ?? "w-full min-h-[320px] rounded-2xl border border-slate-200 bg-white p-2 overflow-hidden"}>
      <LazyBoundary>
        <Canvas
          key={`${question.id}-${question.technique}`}
          question={question}
          isPlayMode
          isDark={isDark}
          onSuccess={() => {}}
        />
      </LazyBoundary>
    </div>
  );
};
