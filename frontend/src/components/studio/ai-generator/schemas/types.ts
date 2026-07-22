/**
 * Base types for the AI Schema Registry.
 *
 * Each canvas component defines a schema that tells the AI:
 *  - What the component does (description for LLM)
 *  - What config fields it accepts (with types, enums, defaults)
 *  - What assets are available
 *  - How to detect this technique from a prompt
 *  - How to validate the AI's output
 *  - Example output for few-shot learning
 */

import { CountingTechnique } from "../../../../types";
import { AiPreset, ParsedSlideConfig } from "../types";

/** Describes a single config field the AI can set */
export interface SchemaField {
  /** JSON key name */
  key: string;
  /** Human-readable label */
  label: string;
  /**
   * Data type. "json" is for small structured content (e.g. a list of themed
   * items) — use only for content, never coordinates/layout: let validate()
   * compute positions deterministically instead of asking the model for
   * pixels, the same way Sudoku/Pattern keep constraint logic out of the prompt.
   */
  type: "string" | "number" | "boolean" | "enum" | "json";
  /** Valid enum values (if type is "enum") */
  enumValues?: string[];
  /** For type "json": a compact shape example shown in the prompt, e.g. '[{"emoji":"🍎","bin":"Fruit"}]' */
  jsonShape?: string;
  /** Default value if AI doesn't specify */
  defaultValue: any;
  /** Description for the LLM system prompt */
  description: string;
  /** Whether this field is required */
  required?: boolean;
  /**
   * Whether the AI is asked to fill this field (default true).
   * Set false for fields the validator derives or defaults — they cost prompt
   * AND completion tokens on every request while adding nothing.
   */
  exposeToAI?: boolean;
  /** Ultra-short hint used in the compact prompt (falls back to description) */
  promptHint?: string;
}

/** Describes an available asset */
export interface SchemaAsset {
  id: string;
  emoji: string;
  label: string;
  /** "vector" = pre-built SVG, "emoji" = system emoji */
  renderType: "vector" | "emoji";
}

/** A complete component schema */
export interface ComponentSchema {
  /** Which CountingTechnique this schema is for */
  technique: CountingTechnique;

  /** Human-readable name */
  name: string;

  /** Description of how this component works (docs & generator UI) */
  description: string;

  /**
   * 1–2 line summary used in the system prompt instead of `description`.
   * Write it for the model: what the child does, what varies between slides.
   */
  promptSummary?: string;

  /** Config fields the AI can configure */
  configFields: SchemaField[];

  /** Available assets for this component */
  assets: SchemaAsset[];

  /** Keywords that trigger this technique from a prompt */
  triggerKeywords: string[];

  /** Top-level fields with constraints */
  topLevelFields: {
    targetCount: { min: number; max: number; default: number };
  };

  /** Example JSON output for few-shot prompting */
  exampleOutput: Record<string, any>;

  /** User guide tip shown in the AI generator UI sidebar */
  tip?: string;

  /** Preset prompt chips shown in the generator UI for this component */
  presets: AiPreset[];

  /**
   * Optional rule-based generator used when no API key is configured.
   * Keeps the generator usable offline; omit if the component has none.
   */
  offlineFallback?: (prompt: string, count: number) => ParsedSlideConfig[];

  /** Validate and normalize AI output for this component */
  validate: (raw: any, index: number) => ParsedSlideConfig;
}
