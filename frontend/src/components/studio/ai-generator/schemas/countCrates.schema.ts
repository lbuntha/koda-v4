import { CountingTechnique } from "../../../../types";
import { ComponentSchema } from "./types";
import { ParsedSlideConfig } from "../types";
import { normalizeCustomLevel } from "../../../canvases/countCratesModel";

/**
 * Turn whatever the model produced into a board the game guarantees is playable.
 *
 * A curated `levelId` with no shelf of its own is left alone — the ladder already certifies
 * those. Anything carrying its own crates goes through the normaliser and comes back with
 * an order the shelf can pay exactly.
 */
function repairedConfig(raw: any): Record<string, any> {
  const stock = raw?.config?.cratesStock;
  const isCustom = !!stock || raw?.config?.cratesCustom === true;
  if (!isCustom) {
    return { levelId: raw?.config?.levelId || "crates_1", cratesCustom: false };
  }

  const level = normalizeCustomLevel({
    cratesCustom: true,
    orderTotal: typeof raw?.config?.orderTotal === "number" ? raw.config.orderTotal : raw?.targetCount,
    cratesStock: stock && typeof stock === "object" ? stock : { 10: 2, 5: 2, 1: 9 },
    cratesConstraint: raw?.config?.cratesConstraint,
    cratesExactly: raw?.config?.cratesExactly,
    cratesOpensAllowed: raw?.config?.cratesOpensAllowed,
    goodsEmoji: raw?.config?.goodsEmoji,
    goodsLabel: raw?.config?.goodsLabel,
  });

  return {
    cratesCustom: true,
    orderTotal: level.orderTotal,
    cratesStock: level.stock,
    cratesConstraint: level.constraint,
    cratesExactly: level.exactCrates,
    cratesOpensAllowed: level.opensAllowed,
    goodsEmoji: level.goodsEmoji,
    goodsLabel: level.goodsLabel,
  };
}

export const countCratesSchema: ComponentSchema = {
  technique: CountingTechnique.COUNT_CRATES,
  name: "Counting Crates",
  description:
    "A counting puzzle: fill an order for exactly N items using crates of 1, 5, 10 and 100.",
  promptSummary:
    "Counting crates. The learner loads crates of 1/5/10/100 into a tray until it totals the "
    + "order exactly, and may open a crate to break it into smaller ones.",
  topLevelFields: { targetCount: { min: 1, max: 120, default: 10 } },
  configFields: [
    {
      key: "levelId",
      label: "Curriculum Level",
      type: "string",
      defaultValue: "crates_1",
      description: "Selected curriculum level (crates_1 to crates_24), or omit for a custom order",
    },
    {
      key: "orderTotal",
      label: "Order Total",
      type: "number",
      defaultValue: 10,
      description: "How many items the order asks for (1-120). Custom boards only",
    },
    {
      key: "cratesConstraint",
      label: "Constraint",
      type: "string",
      defaultValue: "none",
      description: "none | fewest (use as few crates as possible) | exactly (a set crate count)",
    },
    {
      key: "cratesOpensAllowed",
      label: "Openings Allowed",
      type: "number",
      defaultValue: 0,
      description: "How many crates may be broken into smaller ones (0-3)",
    },
  ],
  assets: [],
  triggerKeywords: [
    "counting crates", "count crates", "pack the order", "fill the order",
    "tens and ones crates", "count out", "market stall counting",
  ],
  exampleOutput: {
    id: "q-ai-count-crates",
    technique: "COUNT_CRATES",
    title: "Counting Crates",
    instruction: "Load crates into the tray until it matches the order exactly.",
    targetCount: 23,
    config: {
      cratesCustom: true,
      orderTotal: 23,
      cratesStock: { 10: 3, 5: 2, 1: 9 },
      cratesConstraint: "none",
      cratesOpensAllowed: 0,
    },
  },
  presets: [
    {
      id: "preset-crates-count-out",
      label: "Count Out Ten (Ones only)",
      prompt: "Create a counting crates order for 10 using only single crates",
      emoji: "🍎",
      technique: CountingTechnique.COUNT_CRATES,
      theme: "classic",
    },
    {
      id: "preset-crates-tens-and-ones",
      label: "Tens and Ones (Fewest crates)",
      prompt: "Create a counting crates order for 37 using tens, fives and ones, fewest crates",
      emoji: "📦",
      technique: CountingTechnique.COUNT_CRATES,
      theme: "playful",
    },
  ],
  /**
   * Every generated board is put through the game's own normaliser before it is accepted.
   *
   * A model asked for "an order of 15 from two crates of ten" will happily produce exactly
   * that, and it cannot be built — 15 is not reachable from {10, 10}. Rather than trust the
   * numbers, `normalizeCustomLevel` snaps the order to the largest total the shelf can
   * actually pay, drops a constraint the shelf cannot meet, and clamps the opening budget.
   * What is written back into the config is the corrected board, so an AI-authored question
   * is playable by construction rather than by luck.
   */
  validate(raw: any, index: number): ParsedSlideConfig {
    const stock = raw.config?.cratesStock;
    return {
      id: raw.id || `q-count-crates-${index}`,
      technique: CountingTechnique.COUNT_CRATES,
      title: raw.title || "Counting Crates",
      instruction:
        raw.instruction || "Load crates into the tray until it matches the order exactly.",
      targetCount: typeof raw.targetCount === "number" ? raw.targetCount : 10,
      objectId: raw.objectId || "star",
      config: repairedConfig(raw),
    };
  },
};
