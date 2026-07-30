import React from "react";
import type { LearnerSubject } from "../../api/course";

export interface LearnerSubjectState {
  subjects: LearnerSubject[];
  activeSubjectId: string | null;
  switching: boolean;
  onChange: (subjectId: string) => void;
}

const LearnerSubjectContext = React.createContext<LearnerSubjectState | null>(null);

export const LearnerSubjectProvider: React.FC<React.PropsWithChildren<{ value: LearnerSubjectState }>> = ({
  value,
  children,
}) => (
  <LearnerSubjectContext.Provider value={value}>
    {children}
  </LearnerSubjectContext.Provider>
);

export const useLearnerSubject = (): LearnerSubjectState => {
  const value = React.useContext(LearnerSubjectContext);
  if (!value) throw new Error("useLearnerSubject must be used inside LearnerSubjectProvider");
  return value;
};
