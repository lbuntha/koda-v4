import type { GradeBand } from "../api/auth";

export interface PlacementBandPresentation {
  defaultDark: boolean;
  allowThemeToggle: boolean;
  eyebrow: string;
  fallbackInstruction: string;
  completionEyebrow: string;
  completionTitle: string;
  completionBody: string;
  continueLabel: string;
  showCompletionMetrics: boolean;
}

const PRESENTATION: Record<GradeBand, PlacementBandPresentation> = {
  kid: {
    defaultDark: false,
    allowThemeToggle: false,
    eyebrow: "Koda’s warm-up",
    fallbackInstruction: "Show Koda what you know. It’s okay to have a go!",
    completionEyebrow: "Great job!",
    completionTitle: "You’re ready to play!",
    completionBody: "Koda found a great place for your next adventure.",
    continueLabel: "Let’s play",
    showCompletionMetrics: false,
  },
  student: {
    defaultDark: false,
    allowThemeToggle: true,
    eyebrow: "Quick placement",
    fallbackInstruction: "Solve the challenge. Your first checked answer is recorded.",
    completionEyebrow: "Placement complete",
    completionTitle: "Your starting point is ready",
    completionBody: "We found the right place to begin. You’ll build mastery during lessons.",
    continueLabel: "Start practice",
    showCompletionMetrics: true,
  },
  focus: {
    defaultDark: true,
    allowThemeToggle: true,
    eyebrow: "Placement check",
    fallbackInstruction: "Complete the item. Your first checked response is recorded.",
    completionEyebrow: "Placement complete",
    completionTitle: "Starting point confirmed",
    completionBody: "Placement sets the initial sequence. Mastery is earned during study sessions.",
    continueLabel: "Continue to plan",
    showCompletionMetrics: true,
  },
};

export const placementBandPresentation = (
  band: GradeBand,
): PlacementBandPresentation => PRESENTATION[band] ?? PRESENTATION.student;
