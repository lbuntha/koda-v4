/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Registry-style self-check surfaced for teachers — same spirit as
 * ai-generator's auditRegistry() results shown to developers, just aimed at
 * curriculum content instead of schema config. Errors (broken FK references)
 * are structural bugs; warnings (a unit with no skills, a skill short of its
 * minimum) are just things worth a teacher's attention.
 */

import React from "react";
import { AlertOctagon, AlertTriangle, ChevronRight, CheckCircle2 } from "lucide-react";
import { Drawer, Badge, Button } from "../ui";
import { CurriculumIssue } from "../../curriculum/types";

interface CurriculumHealthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  issues: CurriculumIssue[];
  onJumpToIssue: (issue: CurriculumIssue) => void;
  onRepairQuestionIssue: (issue: CurriculumIssue) => void;
}

const LEVEL_LABEL: Record<CurriculumIssue["level"], string> = {
  grade: "Grade",
  subject: "Subject",
  unit: "Unit",
  skill: "Skill",
  question: "Question",
  rewards: "Rewards",
};

export const CurriculumHealthDrawer: React.FC<CurriculumHealthDrawerProps> = ({
  isOpen,
  onClose,
  issues,
  onJumpToIssue,
  onRepairQuestionIssue,
}) => {
  const errors = issues.filter(i => i.severity === "error");
  const warnings = issues.filter(i => i.severity === "warning");

  const canJumpTo = (issue: CurriculumIssue) => issue.level === "unit" || issue.level === "skill" || issue.level === "subject" || issue.level === "grade";

  const renderRow = (issue: CurriculumIssue, index: number) => {
    const jumpable = canJumpTo(issue);
    return (
      <div
        key={`${issue.level}-${issue.id}-${index}`}
        onClick={() => jumpable && onJumpToIssue(issue)}
        role={jumpable ? "button" : undefined}
        tabIndex={jumpable ? 0 : undefined}
        className={`flex w-full items-start gap-2.5 rounded-xl p-3 text-left ring-1 transition-colors ${
          issue.severity === "error" ? "bg-rose-50/70 ring-rose-200" : "bg-amber-50/70 ring-amber-200"
        } ${jumpable ? "cursor-pointer hover:brightness-95" : ""}`}
      >
        {issue.severity === "error" ? (
          <AlertOctagon size={14} className="text-rose-500 flex-shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge variant="outline" className="text-2xs px-1.5 py-0">{LEVEL_LABEL[issue.level]}</Badge>
          </div>
          <p className={`text-xs leading-snug ${issue.severity === "error" ? "text-rose-700" : "text-amber-700"}`}>
            {issue.message}
          </p>
          {issue.level === "question" && (
            <div className="mt-2">
              <Button
                variant="outline"
                size="xs"
                onClick={event => {
                  event.stopPropagation();
                  onRepairQuestionIssue(issue);
                }}
              >
                Unassign safely
              </Button>
              <p className="mt-1 text-[10px] leading-4 text-rose-600/80">Keeps the question; removes only its broken skill link.</p>
            </div>
          )}
        </div>
        {jumpable && <ChevronRight size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />}
      </div>
    );
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Curriculum Health" widthClassName="w-full sm:w-[420px]">
      {issues.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 gap-2">
          <CheckCircle2 size={28} className="text-emerald-500" />
          <p className="text-xs font-bold text-slate-600">Everything checks out.</p>
          <p className="text-2xs text-slate-400">No structural issues or coverage gaps.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {errors.length > 0 && (
            <div className="space-y-2">
              <span className="koda-admin-chip text-rose-600">Errors ({errors.length})</span>
              <div className="space-y-1.5">{errors.map(renderRow)}</div>
            </div>
          )}
          {warnings.length > 0 && (
            <div className="space-y-2">
              <span className="koda-admin-chip text-amber-600">Warnings ({warnings.length})</span>
              <div className="space-y-1.5">{warnings.map(renderRow)}</div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
};
