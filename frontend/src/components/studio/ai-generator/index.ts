/**
 * AI Generator barrel export
 */
export { AiGeneratorPanel } from "./AiGeneratorPanel";
export { generateWithAI, getStoredApiKey, setStoredApiKey, hasApiKey, getStoredModel, setStoredModel } from "./openaiService";
export { AI_CONFIG } from "./config";
export type { AiPreset, ParsedSlideConfig, GenerationStep } from "./types";
