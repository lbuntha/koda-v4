/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Read-only preview for a single question, scoped to whatever skill the
 * teacher is looking at in Curriculum Studio — deliberately not a jump into
 * the Studio tab, whose left-hand list is the entire worksheet deck (a
 * different grouping than curriculum skills) and would surface unrelated
 * cards. Reuses CanvasPreview, the same live-render component the Studio tab
 * itself renders from, so this always matches what a student would see.
 */

import React from "react";
import { CountingQuestion } from "../../types";
import { Dialog, Badge } from "../ui";
import { CanvasPreview } from "../studio/CanvasPreview";
import { formatTechniqueLabel } from "./questionOps";

interface QuestionPreviewModalProps {
  question: CountingQuestion | null;
  onClose: () => void;
}

export const QuestionPreviewModal: React.FC<QuestionPreviewModalProps> = ({ question, onClose }) => {
  return (
    <Dialog isOpen={!!question} onClose={onClose} maxWidthClassName="max-w-2xl">
      {question && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 pr-8">
            <h3 className="text-sm font-extrabold text-slate-800">{question.title}</h3>
            <Badge variant="outline" className="text-2xs">{formatTechniqueLabel(question.technique)}</Badge>
          </div>
          {question.instruction && <p className="text-xs text-slate-500">{question.instruction}</p>}
          <CanvasPreview
            question={question}
            className="w-full min-h-[420px] rounded-2xl border border-slate-200 bg-white p-3 overflow-hidden"
          />
        </div>
      )}
    </Dialog>
  );
};
