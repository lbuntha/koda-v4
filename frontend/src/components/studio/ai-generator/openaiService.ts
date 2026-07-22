/**
 * OpenAI Service — Schema-driven AI generation service.
 *
 * Uses the Schema Registry to auto-build system prompts for any component.
 * The system prompt is generated from schema definitions, NOT hardcoded.
 *
 * Architecture:
 *   Frontend (now)  → calls OpenAI directly with user's API key
 *   Backend (later)  → swap config.API_ENDPOINT, set DIRECT_MODE=false
 *
 * Your backend endpoint should accept:
 *   POST { prompt: string, count: number, technique?: string }
 *   Response: { slides: ParsedSlideConfig[] }
 */

import { ParsedSlideConfig } from "./types";
import { AI_CONFIG } from "./config";
import { detectTechniqueFromPrompt, buildSystemPrompt } from "./schemas";

// ─── API Key Management ─────────────────────────────────────────────────────

export function getStoredApiKey(): string {
  try {
    return localStorage.getItem(AI_CONFIG.STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function setStoredApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(AI_CONFIG.STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(AI_CONFIG.STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable
  }
}

export function hasApiKey(): boolean {
  return getStoredApiKey().length > 0;
}

export function getStoredModel(): string {
  try {
    return localStorage.getItem(AI_CONFIG.MODEL_STORAGE_KEY) || AI_CONFIG.MODEL;
  } catch {
    return AI_CONFIG.MODEL;
  }
}

export function setStoredModel(model: string): void {
  try {
    localStorage.setItem(AI_CONFIG.MODEL_STORAGE_KEY, model);
  } catch {
    // localStorage unavailable
  }
}

// ─── Core API Call ──────────────────────────────────────────────────────────

/**
 * Generate slides using AI with schema-driven prompts.
 *
 * 1. Detects the technique from the prompt (via schema triggerKeywords)
 * 2. Builds a system prompt from that schema's fields, assets, rules
 * 3. Calls OpenAI (or your backend)
 * 4. Validates output using the schema's validate() function
 */
export async function generateWithAI(
  prompt: string,
  count: number = 1,
  existingQuestions: Array<{ title: string; objectId: string; targetCount: number }> = []
): Promise<ParsedSlideConfig[]> {
  const apiKey = getStoredApiKey();

  // Detect which component schema to use
  const schema = detectTechniqueFromPrompt(prompt);

  // Dedup context: object+count pairs are all the model needs to avoid repeats
  const existingContext = existingQuestions.length > 0
    ? `\nAlready used (avoid repeating): ${existingQuestions.map(q => `${q.objectId}x${q.targetCount}`).join(", ")}`
    : "";

  // ── Backend proxy mode (future) ──
  if (!AI_CONFIG.DIRECT_MODE) {
    const response = await fetch(AI_CONFIG.API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, count, technique: schema.technique, existingContext })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any)?.message || `Server error: ${response.status}`);
    }

    const data = await response.json();
    const raw = Array.isArray(data.slides) ? data.slides : Array.isArray(data) ? data : [data];
    return raw.map((item: any, i: number) => schema.validate(item, i));
  }

  // ── Direct OpenAI mode (current) ──
  if (!apiKey) {
    throw new Error("No API key set. Enter your OpenAI API key above.");
  }

  // Build system prompt from schema (auto-generated, not hardcoded!)
  const systemPrompt = buildSystemPrompt(schema);

  const userMessage = `Teacher request: "${prompt}". Generate ${count} slide${count > 1 ? "s" : ""}.${existingContext}`;

  const response = await fetch(AI_CONFIG.API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: getStoredModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: AI_CONFIG.TEMPERATURE,
      // Guaranteed-parseable JSON: no markdown fences, no retry burn
      response_format: { type: "json_object" },
      // Scale the budget with the ask instead of paying for 2000 every time
      max_tokens: Math.min(AI_CONFIG.MAX_TOKENS, 180 * count + 120)
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = (errorData as any)?.error?.message || "";
    if (response.status === 401) throw new Error("Invalid API key. Check your OpenAI key.");
    if (response.status === 429) throw new Error("Rate limit exceeded. Wait a moment and retry.");
    if (response.status === 402) throw new Error("Insufficient credits. Check your OpenAI billing.");
    throw new Error(msg || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content?.trim();
  if (!rawContent) throw new Error("Empty response from OpenAI.");

  // response_format guarantees JSON, but stay tolerant of fenced output from
  // older models or a future backend proxy.
  let cleanJson = rawContent;
  if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: any[];
  try {
    const result = JSON.parse(cleanJson);
    // Accept {"slides":[...]}, a bare array, or a single object
    parsed = Array.isArray(result) ? result
      : Array.isArray(result?.slides) ? result.slides
      : [result];
  } catch {
    throw new Error("AI returned invalid JSON. Please try again.");
  }

  // Validate using the schema's own validator
  return parsed.map((item, i) => schema.validate(item, i));
}
