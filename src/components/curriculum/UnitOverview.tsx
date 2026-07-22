/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Grid of skill cards for one Unit. The progress-bar markup below is
 * copied verbatim from App.tsx's dashboard "Focus Areas" block (bg-slate-100
 * track + bg-indigo-600 fill) rather than invented fresh, so a teacher sees
 * the same visual language for "how much progress" everywhere in the app.
 */

import React from "react";
import { Unit, Skill, SkillCoverage } from "../../curriculum/types";
import { Card, Badge } from "../ui";

interface UnitOverviewProps {
  unit: Unit;
  skills: Skill[];
  coverageBySkillId: Map<string, SkillCoverage>;
  onSelectSkill: (skillId: string) => void;
}

export const UnitOverview: React.FC<UnitOverviewProps> = ({ unit, skills, coverageBySkillId, onSelectSkill }) => {
  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <span className="text-2xs font-mono uppercase tracking-widest text-slate-400">Unit</span>
        <h1 className="text-xl font-extrabold text-slate-800">{unit.label}</h1>
      </div>

      {skills.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center">
          <p className="text-xs text-slate-400">No skills yet — add one from the sidebar tree.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map(skill => {
            const cov = coverageBySkillId.get(skill.id);
            const questionCount = cov?.questionCount ?? 0;
            const minQuestions = cov?.minQuestions ?? skill.minQuestions;
            const pct = minQuestions > 0 ? Math.min(100, Math.round((questionCount / minQuestions) * 100)) : 0;

            return (
              <Card
                key={skill.id}
                onClick={() => onSelectSkill(skill.id)}
                className="p-4 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-sm font-bold text-slate-800 leading-snug">{skill.label}</h3>
                  <Badge variant={cov?.isComplete ? "success" : "warning"} className="flex-shrink-0">
                    {questionCount}/{minQuestions}
                  </Badge>
                </div>

                {skill.standardRef && (
                  <span className="inline-block text-2xs font-mono text-slate-400 mb-3">{skill.standardRef}</span>
                )}

                <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
                  <span>Coverage</span>
                  <span>{pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
