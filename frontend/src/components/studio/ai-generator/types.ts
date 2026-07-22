/**
 * Types for the AI Activity Generator
 */

import { CountingTechnique } from "../../../types";

/** A single preset prompt template for teachers */
export interface AiPreset {
  id: string;
  label: string;
  prompt: string;
  emoji: string;
  technique: CountingTechnique;
  theme: string;
}

/** The structured output the parser returns */
export interface ParsedSlideConfig {
  id: string;
  technique: CountingTechnique;
  title: string;
  instruction: string;
  objectId: string;
  targetCount: number;
  config: Record<string, any>;
}

/** Progress step during generation animation */
export interface GenerationStep {
  label: string;
  done: boolean;
}
