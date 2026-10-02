/**
 * Which pages a batch of AI pictures is for, and what each is asked to show.
 *
 * Kept apart from the screen so the choices — what "pages still on Automatic"
 * means, which shape a page wants, what the model is told — are plain data and
 * can be tested without a DOM. The single-page drawer uses the same prompt, so
 * a page made in a batch is described exactly as one made by hand.
 */

import type { PagePicture } from "../bookLayout";
import type { PictureKind } from "../pictureShape";

/** 0 is the cover; n is page n. */
export type Slot = number;

export interface SlotInfo {
  slot: Slot;
  text: string;
  how: PagePicture["how"];
  at: PagePicture["at"] | null;
}

/** What the model is told for one page, or for the cover when `cover`. */
export function slotPrompt(text: string, title: string, cover: boolean): string {
  if (cover) return title.trim() ? `A cover illustration for the story titled “${title.trim()}”` : "A cover illustration for a children’s story";
  return `Illustrate this line from the story: “${text}”`;
}

/** A side picture is tall; everything else, the cover included, is wide. */
export const slotKind = (s: Pick<SlotInfo, "at">): PictureKind => (s.at === "left" || s.at === "right" ? "portrait" : "banner");

export type QuickPick = "all" | "missing" | "none";

/**
 * The slots a quick pick selects. "missing" is every page still on Automatic —
 * a page set to No picture was a decision, so it is left alone — and the cover
 * only when it has no picture of its own.
 */
export function pickSlots(slots: readonly SlotInfo[], pick: QuickPick, coverPicture: string): Slot[] {
  if (pick === "none") return [];
  if (pick === "all") return slots.map((s) => s.slot);
  return slots.filter((s) => (s.slot === 0 ? !coverPicture : s.how === "auto")).map((s) => s.slot);
}

export type SlotState = "queued" | "making" | "done" | "failed";
