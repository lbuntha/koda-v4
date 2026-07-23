/** Schema-driven AI generation through Koda's authenticated backend proxy. */

import { api } from "../../../api/client";
import { ParsedSlideConfig } from "./types";
import { AI_CONFIG } from "./config";
import { detectTechniqueFromPrompt, buildSystemPrompt } from "./schemas";
import type { ComponentSchema } from "./schemas";
import type { CustomSvgAsset } from "../../../types";

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function generateWithAI(
  prompt: string,
  count: number = 1,
  existingQuestions: Array<{ id?: string; title: string; objectId: string; targetCount: number }> = [],
  customAssets: CustomSvgAsset[] = []
): Promise<ParsedSlideConfig[]> {
  const schema = detectTechniqueFromPrompt(prompt);
  const existingContext = existingQuestions.length > 0
    ? `\nAlready used (avoid repeating): ${existingQuestions.map((question) => `${question.objectId}x${question.targetCount}`).join(", ")}`
    : "";
  const userMessage = `Teacher request: "${prompt}". Generate ${count} slide${count > 1 ? "s" : ""}.${existingContext}`;

  // Keep provider prompts compact and never send SVG markup upstream. The
  // full asset is joined back onto the validated slide in the browser.
  const aiAssetCatalog: Array<{ id: string; label: string }> = [];
  let catalogSize = 0;
  for (const asset of customAssets) {
    const item = { id: asset.id.slice(0, 120), label: asset.label.slice(0, 160) };
    const encodedSize = JSON.stringify(item).length;
    if (catalogSize + encodedSize > 6_000) break;
    aiAssetCatalog.push(item);
    catalogSize += encodedSize;
  }

  const data = await api.post<ChatCompletionResponse>("/ai/generate", {
    messages: [
      { role: "system", content: buildSystemPrompt(schema, aiAssetCatalog) },
      { role: "user", content: userMessage },
    ],
    temperature: AI_CONFIG.TEMPERATURE,
    response_format: { type: "json_object" },
    max_tokens: Math.min(AI_CONFIG.MAX_TOKENS, 180 * count + 120),
  });

  const rawContent = data.choices?.[0]?.message?.content?.trim();
  if (!rawContent) throw new Error("The AI provider returned an empty response.");

  const cleanJson = rawContent.startsWith("```")
    ? rawContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    : rawContent;

  try {
    const result = JSON.parse(cleanJson);
    return normalizeGeneratedSlides(
      result,
      schema,
      customAssets,
      existingQuestions.flatMap((question) => question.id ? [question.id] : []),
    );
  } catch (cause) {
    if (cause instanceof SyntaxError) throw new Error("AI returned invalid JSON. Please try again.");
    throw cause;
  }
}

/**
 * Convert the common JSON shapes returned by providers into complete,
 * MongoDB-safe question rows. Keeping this boundary strict means Apply never
 * sends a wrapper object, a missing field, an overlong id, or a duplicate id
 * into the question deck.
 */
export function normalizeGeneratedSlides(
  result: unknown,
  schema: ComponentSchema,
  customAssets: CustomSvgAsset[] = [],
  reservedIds: string[] = [],
): ParsedSlideConfig[] {
  const items = extractGeneratedItems(result);
  if (items.length === 0) throw new Error("AI returned no questions. Please try again.");

  const usedIds = new Set(reservedIds);
  return items.map((item, index) => {
    const validated = applyCustomAssetSelection(item, schema.validate(item, index), customAssets);
    const missing = [
      !validated.title?.trim() && "title",
      !validated.technique && "technique",
      !validated.instruction?.trim() && "instruction",
      !validated.objectId?.trim() && "objectId",
      (!Number.isFinite(validated.targetCount) || validated.targetCount <= 0) && "targetCount",
      (!validated.config || typeof validated.config !== "object" || Array.isArray(validated.config)) && "config",
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`Generated question ${index + 1} is missing required schema fields: ${missing.join(", ")}.`);
    }

    return {
      ...validated,
      id: uniqueQuestionId(validated.id, usedIds, index),
      title: validated.title.trim(),
      instruction: validated.instruction.trim(),
      config: { ...validated.config },
    };
  });
}

function extractGeneratedItems(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result.filter(isRecord);
  if (!isRecord(result)) throw new Error("AI returned an unsupported question schema.");

  for (const key of ["slides", "questions"] as const) {
    const value = result[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  for (const key of ["slide", "question"] as const) {
    const value = result[key];
    if (isRecord(value)) return [value];
  }
  if ("title" in result || "instruction" in result || "config" in result) return [result];
  throw new Error("AI response did not contain a slide or question object.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function uniqueQuestionId(preferred: unknown, usedIds: Set<string>, index: number): string {
  const preferredId = typeof preferred === "string" ? preferred.trim() : "";
  const base = preferredId && preferredId.length <= 120
    ? preferredId
    : `q-ai-${Date.now()}-${index}`;
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    const tail = `-${suffix++}`;
    candidate = `${base.slice(0, 120 - tail.length)}${tail}`;
  }
  usedIds.add(candidate);
  return candidate;
}

export function applyCustomAssetSelection(
  raw: unknown,
  validated: ParsedSlideConfig,
  customAssets: CustomSvgAsset[]
): ParsedSlideConfig {
  if (!raw || typeof raw !== "object") return validated;
  const requestedId = (raw as { objectId?: unknown }).objectId;
  if (typeof requestedId !== "string") return validated;
  const asset = customAssets.find(candidate => candidate.id === requestedId);
  if (!asset) return validated;

  return {
    ...validated,
    objectId: "custom_svg",
    config: {
      ...validated.config,
      assetType: "custom_svg",
      customSvgAssetId: asset.id,
      customSvgMarkup: asset.markup,
      customSvgLabel: asset.label,
      customSvgScale: asset.scale,
    },
  };
}
