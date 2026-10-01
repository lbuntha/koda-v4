import { System } from "./sync";

/** The AI companies an admin can make the default for a job. */
export type AiCompany = "gemini" | "openai" | "claude";

export type AiDefaultSetting = "ai.libraryProvider" | "ai.pictureProvider" | "ai.artProvider";

export const AI_COMPANY_NAME: Record<AiCompany, string> = { gemini: "Gemini", openai: "OpenAI", claude: "Claude" };

/**
 * Which company the admin set for a job on Admin → API keys. Older rows said
 * "chatgpt" for OpenAI, and anything unknown falls back to Gemini, the one key
 * every deployment has.
 */
export function aiDefault(setting: AiDefaultSetting): AiCompany {
  const value = System.snapshot()[setting];
  if (value === "openai" || value === "chatgpt") return "openai";
  if (value === "claude") return "claude";
  return "gemini";
}
