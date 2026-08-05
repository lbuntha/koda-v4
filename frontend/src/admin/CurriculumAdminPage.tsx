import React, { useState } from "react";
import { useSvgLibrary } from "../assets/SvgLibraryContext";
import { CurriculumLibraryPage } from "../components/curriculum/CurriculumLibraryPage";
import { CurriculumStudioPage } from "../components/curriculum/CurriculumStudioPage";
import { CurriculumStudioSkeleton } from "../components/curriculum/CurriculumStudioSkeleton";
import { useQuestionDeck } from "../studio/useQuestionDeck";
import { DEFAULT_QUESTIONS } from "../templates";

interface CurriculumAdminPageProps {
  onOpenAssets: () => void;
}

export const CurriculumAdminPage: React.FC<CurriculumAdminPageProps> = ({ onOpenAssets }) => {
  const [curriculumId, setCurriculumId] = useState<string | null>(null);

  if (!curriculumId) return <CurriculumLibraryPage onOpen={setCurriculumId} />;

  return <CurriculumStudioHost key={curriculumId} curriculumId={curriculumId} onBack={() => setCurriculumId(null)} onOpenAssets={onOpenAssets} />;
};

interface CurriculumStudioHostProps extends CurriculumAdminPageProps {
  curriculumId: string;
  onBack: () => void;
}

const CurriculumStudioHost: React.FC<CurriculumStudioHostProps> = ({ curriculumId, onBack, onOpenAssets }) => {
  const { assets, persistenceStatus: assetStatus } = useSvgLibrary();
  const { questions, setQuestions, persistenceStatus: questionStatus } = useQuestionDeck(DEFAULT_QUESTIONS);
  const loading = questionStatus === "loading" || assetStatus === "loading";

  if (loading) return <CurriculumStudioSkeleton />;

  return (
    <CurriculumStudioPage
      curriculumId={curriculumId}
      questions={questions}
      saveQuestions={setQuestions}
      onOpenSvgMaker={onOpenAssets}
      onBack={onBack}
    />
  );
};
