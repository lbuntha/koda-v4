// Defined alongside the portrait art it selects; re-exported here so onboarding
// code keeps importing its types from one place.
import type { LearnerGender } from "../../components/LearnerPortrait";
export type { LearnerGender };
export type PlacementChoice = "beginning" | "check";
export type LevelChoice = "age" | "grade";

export interface KidOnboardingDraft {
  profileGender: LearnerGender;
  name: string;
  gradeLevel: string;
  levelChoice: LevelChoice;
  age: number;
  learningGoals: string[];
  placementChoice: PlacementChoice;
  avatar: string;
  pin: string;
}

export const ONBOARDING_STEPS = [
  { id: "learner", label: "Learner" },
  { id: "name", label: "Name" },
  { id: "grade", label: "Grade" },
  { id: "goals", label: "Goals" },
  { id: "placement", label: "Placement" },
  { id: "avatar", label: "Avatar" },
  { id: "finish", label: "Finish" },
] as const;
