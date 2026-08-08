/**
 * Rule-based offline generator for MOVE_AND_COUNT — the Count family.
 *
 * Wired into count.schema.ts as `offlineFallback` — the panel never imports
 * this directly. A new component that wants offline support ships its own
 * parser (or none) and wires it the same way.
 *
 * It only ever produces the `move` staging, which is the default the canvas
 * falls back to anyway. Offline is the no-API-key path, so a sensible single
 * shape beats guessing which of four the teacher meant.
 */

import { CountingTechnique } from "../../../types";
import { ParsedSlideConfig } from "./types";
import { clampAddend } from "../../canvases/additionTutorModel";
import { ASSET_SHAPES } from "../../Assets";

// ─── Asset Dictionary ───────────────────────────────────────────────────────

interface AssetEntry {
  id: string;
  emoji: string;
  label: string;
  keywords: string[];
}

const ASSET_DICTIONARY: AssetEntry[] = [
  { id: "apple",     emoji: "🍎", label: "Apple",     keywords: ["apple", "apples", "fruit", "fruits"] },
  { id: "star",      emoji: "⭐", label: "Star",      keywords: ["star", "stars", "twinkle"] },
  { id: "dino",      emoji: "🦕", label: "Dinosaur",  keywords: ["dino", "dinosaur", "dinosaurs", "dinos", "rex"] },
  { id: "car",       emoji: "🚗", label: "Toy Car",   keywords: ["car", "cars", "vehicle", "vehicles", "truck"] },
  { id: "bear",      emoji: "🧸", label: "Bear",      keywords: ["bear", "bears", "teddy", "teddies"] },
  { id: "fish",      emoji: "🐟", label: "Fish",      keywords: ["fish", "fishes", "goldfish", "aquarium fish"] },
  { id: "rocket",    emoji: "🚀", label: "Rocket",    keywords: ["rocket", "rockets", "spaceship", "shuttle"] },
  { id: "butterfly", emoji: "🦋", label: "Butterfly", keywords: ["butterfly", "butterflies", "moth"] },
  { id: "sun",       emoji: "☀️", label: "Sun",       keywords: ["sun", "suns", "sunshine"] },
  { id: "flower",    emoji: "🌸", label: "Flower",    keywords: ["flower", "flowers", "blossom", "bloom"] },
  { id: "heart",     emoji: "❤️", label: "Heart",     keywords: ["heart", "hearts", "love"] },
  { id: "duck",      emoji: "🦆", label: "Duck",      keywords: ["duck", "ducks", "duckling"] },
  { id: "cupcake",   emoji: "🧁", label: "Cupcake",   keywords: ["cupcake", "cupcakes", "cake", "muffin"] },
  { id: "balloon",   emoji: "🎈", label: "Balloon",   keywords: ["balloon", "balloons"] },
  { id: "cookie",    emoji: "🍪", label: "Cookie",    keywords: ["cookie", "cookies", "biscuit"] },
];

// ─── Location / Theme Dictionary ────────────────────────────────────────────

interface LocationEntry {
  keywords: string[];
  sourceBinLabel: string;
  destinationBinLabel: string;
  frameColor: string;
}

const LOCATION_DICTIONARY: LocationEntry[] = [
  { keywords: ["aquarium", "fish bowl", "ocean", "sea", "pond", "water", "lake"],
    sourceBinLabel: "Fish Bowl", destinationBinLabel: "Aquarium", frameColor: "emerald" },
  { keywords: ["launch pad", "space", "hangar", "mission", "orbit", "moon"],
    sourceBinLabel: "Hangar", destinationBinLabel: "Launch Pad", frameColor: "purple" },
  { keywords: ["forest", "woods", "jungle", "wild", "nature"],
    sourceBinLabel: "Toy Shelf", destinationBinLabel: "Forest", frameColor: "emerald" },
  { keywords: ["basket", "fruit basket", "picnic"],
    sourceBinLabel: "Tree", destinationBinLabel: "Fruit Basket", frameColor: "indigo" },
  { keywords: ["sky", "night sky", "cloud", "clouds", "heaven"],
    sourceBinLabel: "Star Box", destinationBinLabel: "Night Sky", frameColor: "purple" },
  { keywords: ["garage", "driveway", "parking", "lot"],
    sourceBinLabel: "Driveway", destinationBinLabel: "Garage", frameColor: "indigo" },
  { keywords: ["garden", "meadow", "field", "patch"],
    sourceBinLabel: "Meadow", destinationBinLabel: "Garden", frameColor: "pink" },
  { keywords: ["cave", "den", "nest", "burrow"],
    sourceBinLabel: "Valley", destinationBinLabel: "Cozy Cave", frameColor: "emerald" },
  { keywords: ["vase", "pot", "jar", "pitcher"],
    sourceBinLabel: "Garden Bed", destinationBinLabel: "Vase", frameColor: "pink" },
  { keywords: ["box", "gift box", "present", "treasure", "chest"],
    sourceBinLabel: "Table", destinationBinLabel: "Gift Box", frameColor: "rose" },
  { keywords: ["horizon", "sunrise", "sunset"],
    sourceBinLabel: "Behind Clouds", destinationBinLabel: "Horizon", frameColor: "indigo" },
  { keywords: ["shelf", "cupboard", "display"],
    sourceBinLabel: "Storage", destinationBinLabel: "Shelf", frameColor: "indigo" },
  { keywords: ["plate", "dish", "tray", "kitchen", "table"],
    sourceBinLabel: "Kitchen Counter", destinationBinLabel: "Plate", frameColor: "indigo" },
];

// ─── Number Words ───────────────────────────────────────────────────────────

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// ─── Main Parser ────────────────────────────────────────────────────────────

function extractNumber(prompt: string): number {
  // Try digit extraction first
  const digitMatch = prompt.match(/\b(\d{1,2})\b/);
  if (digitMatch) return Math.min(10, Math.max(1, parseInt(digitMatch[1])));

  // Try number words
  const lower = prompt.toLowerCase();
  for (const [word, num] of Object.entries(NUMBER_WORDS)) {
    if (lower.includes(word)) return num;
  }

  // Default fallback
  return 5;
}

function extractAsset(prompt: string): AssetEntry {
  const lower = prompt.toLowerCase();
  for (const asset of ASSET_DICTIONARY) {
    for (const kw of asset.keywords) {
      if (lower.includes(kw)) return asset;
    }
  }
  // Default to apple
  return ASSET_DICTIONARY[0];
}

function extractLocation(prompt: string): LocationEntry {
  const lower = prompt.toLowerCase();
  // Score each location by how many keywords match
  let bestMatch: LocationEntry | null = null;
  let bestScore = 0;
  for (const loc of LOCATION_DICTIONARY) {
    let score = 0;
    for (const kw of loc.keywords) {
      if (lower.includes(kw)) score += kw.length; // Longer keyword = better specificity
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = loc;
    }
  }
  return bestMatch || {
    keywords: [],
    sourceBinLabel: "Uncounted",
    destinationBinLabel: "Counted",
    frameColor: "indigo"
  };
}

/**
 * Both addends span 1-99, so a prompt like "7 ducks plus 5 ducks" stays a
 * single-digit problem instead of being forced up into double digits.
 */
function extractTwoNumbers(prompt: string): [number, number] {
  const matches = prompt.match(/\b\d{1,2}\b/g);
  if (matches && matches.length >= 2) {
    return [clampAddend(matches[0]), clampAddend(matches[1])];
  }
  if (matches && matches.length === 1) {
    return [clampAddend(matches[0]), 7];
  }
  return [18, 7];
}

function detectTechnique(prompt: string): CountingTechnique {
  const lower = prompt.toLowerCase();

  if (lower.includes("add") || lower.includes("plus") || lower.includes("sum") || 
      lower.includes("tutor") || lower.includes("addition") || lower.includes("carry") || 
      lower.includes("making ten") || lower.includes("make ten")) {
    return CountingTechnique.ADDITION_TUTOR;
  }

  if (lower.includes("move") || lower.includes("drag") || lower.includes("put") || lower.includes("place") ||
      lower.includes("park") || lower.includes("pick") || lower.includes("guide") || lower.includes("help") ||
      lower.includes("arrange") || lower.includes("walk") || lower.includes("transfer")) {
    return CountingTechnique.MOVE_AND_COUNT;
  }

  return CountingTechnique.MOVE_AND_COUNT;
}

function generateInstruction(asset: AssetEntry, count: number, location: LocationEntry): string {
  const countSequence = Array.from({ length: Math.min(count, 5) }, (_, i) => i + 1).join(", ");
  const suffix = count > 5 ? `... ${count}!` : "!";
  return `Move the ${count} ${asset.label.toLowerCase()}${count > 1 ? "s" : ""} from the ${location.sourceBinLabel} to the ${location.destinationBinLabel} while counting: ${countSequence}${suffix}`;
}

function generateTitle(asset: AssetEntry, location: LocationEntry): string {
  return `Count ${asset.label}s → ${location.destinationBinLabel}`;
}

export function parsePromptToSlide(prompt: string): ParsedSlideConfig {
  const technique = detectTechnique(prompt);
  const asset = extractAsset(prompt);
  const location = extractLocation(prompt);
  const uniqueId = `q-ai-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  const svgAssetIds = ASSET_SHAPES.map(s => s.type as string);
  const assetType = svgAssetIds.includes(asset.id) ? asset.id : "emoji";

  if (technique === CountingTechnique.ADDITION_TUTOR) {
    const [num1, num2] = extractTwoNumbers(prompt);
    return {
      id: uniqueId,
      technique,
      title: `Orchard Math: ${num1} + ${num2}`,
      instruction: `Help Koda add ${num1} and ${num2} together using base-10 rods and units!`,
      objectId: asset.id,
      targetCount: num1 + num2,
      config: {
        num1,
        num2,
        assetType,
        frameColor: location.frameColor as any
      }
    };
  }

  const count = extractNumber(prompt);

  return {
    id: uniqueId,
    technique,
    title: generateTitle(asset, location),
    instruction: generateInstruction(asset, count, location),
    objectId: asset.id,
    targetCount: count,
    config: {
      assetType,
      frameColor: location.frameColor as any,
      sourceBinLabel: location.sourceBinLabel,
      destinationBinLabel: location.destinationBinLabel,
      defaultRepresentation: "concrete",
      showItemFrame: true,
      showLayoutRulers: true
    }
  };
}

/**
 * Batch generator: creates N slides from a single theme prompt.
 * Useful for "Generate a lesson plan" type requests.
 */
export function generateMultipleSlides(prompt: string, count: number = 3): ParsedSlideConfig[] {
  const baseSlide = parsePromptToSlide(prompt);
  const slides: ParsedSlideConfig[] = [];

  for (let i = 0; i < count; i++) {
    const targetCount = Math.min(10, Math.max(1, baseSlide.targetCount - 1 + i));
    slides.push({
      ...baseSlide,
      id: `q-ai-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
      title: `${i + 1}. ${baseSlide.title}`,
      targetCount,
      instruction: generateInstruction(
        extractAsset(prompt),
        targetCount,
        extractLocation(prompt)
      )
    });
  }

  return slides;
}
