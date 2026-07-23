import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";
import { learningApi, PublishedCurriculum } from "../api/learning";
import { useAuth } from "../auth/AuthContext";
import { GameLauncher } from "../components/GameLauncher";
import { Button } from "../components/ui";
import { analyticsLogger } from "../services/analyticsLogger";

export const StudentCurriculumPlayer: React.FC = () => {
  const { account, playSession, endChildPlay, logout } = useAuth();
  const [curriculum, setCurriculum] = useState<PublishedCurriculum | null>(null);
  const [activeId, setActiveId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.id) return;
    analyticsLogger.enableServerSync(account.id);
    void learningApi.curriculum().then(
      data => {
        setCurriculum(data);
        setActiveId(data.questions[0]?.id || "");
      },
      reason => setError(reason instanceof Error ? reason.message : "Unable to load curriculum"),
    );
    return () => analyticsLogger.disableServerSync();
  }, [account?.id]);

  const orderedQuestions = useMemo(() => {
    if (!curriculum) return [];
    const tree = curriculum.tree;
    const skillOrder = tree.grades
      .slice().sort((a, b) => a.order - b.order)
      .flatMap(grade => tree.subjects.filter(subject => subject.gradeId === grade.id).sort((a, b) => a.order - b.order))
      .flatMap(subject => tree.units.filter(unit => unit.subjectId === subject.id).sort((a, b) => a.order - b.order))
      .flatMap(unit => tree.skills.filter(skill => skill.unitId === unit.id).sort((a, b) => a.order - b.order))
      .map(skill => skill.id);
    const positions = new Map(skillOrder.map((id, index) => [id, index]));
    return curriculum.questions
      .map((question, index) => ({ question, index }))
      .sort((a, b) => (positions.get(a.question.skillId || "") ?? 9999) - (positions.get(b.question.skillId || "") ?? 9999) || a.index - b.index)
      .map(item => item.question);
  }, [curriculum]);

  const exit = async () => {
    await analyticsLogger.flush();
    if (playSession) await endChildPlay();
    else logout();
  };

  if (error || (curriculum && orderedQuestions.length === 0)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FBFAFF] p-5">
        <div className="max-w-sm rounded-2xl border border-[#E7E3F6] bg-white p-6 text-center shadow-sm">
          <BookOpen className="mx-auto text-[#534AB7]" />
          <h1 className="mt-3 text-base font-semibold text-[#0E0B55]">No lesson available</h1>
          <p className="mt-1 text-xs text-[#6D6997]">{error || "The published curriculum has no linked worksheet questions yet."}</p>
          <Button className="mt-4" onClick={() => void exit()}>Back</Button>
        </div>
      </div>
    );
  }
  if (!curriculum || !activeId) return <div className="flex min-h-screen items-center justify-center bg-[#FBFAFF]"><Loader2 className="animate-spin text-[#534AB7]" /></div>;

  return (
    <GameLauncher
      questions={orderedQuestions}
      activeId={activeId}
      setActiveId={setActiveId}
      onClose={() => void exit()}
      learningContext={{ curriculumId: curriculum.curriculumId, curriculumRevision: curriculum.revision }}
    />
  );
};
