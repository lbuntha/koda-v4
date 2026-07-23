/** Schema-driven AI generation through Koda's authenticated backend proxy. */

import { api } from "../../../api/client";
import { ParsedSlideConfig } from "./types";
import { AI_CONFIG } from "./config";
import { detectTechniqueFromPrompt, buildSystemPrompt } from "./schemas";
import type { CustomSvgAsset } from "../../../types";

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export async function generateWithAI(
  prompt: string,
  count: number = 1,
  existingQuestions: Array<{ title: string; objectId: string; targetCount: number }> = [],
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
    const parsed = Array.isArray(result)
      ? result
      : Array.isArray(result?.slides)
        ? result.slides
        : [result];
    return parsed.map((item, index) => applyCustomAssetSelection(item, schema.validate(item, index), customAssets));
  } catch (cause) {
    if (cause instanceof SyntaxError) throw new Error("AI returned invalid JSON. Please try again.");
    throw cause;
  }
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
