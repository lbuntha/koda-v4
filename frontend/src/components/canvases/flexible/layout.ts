import { FlexibleItem, FlexibleTarget } from "./types";

/** Authoring coordinate space for items and bins (design units). */
export const STAGE_W = 480;
export const STAGE_H = 320;
/** Item hit box, in design units. */
export const ITEM_SIZE = 44;

/** Bin sizing bounds — bins shrink toward BIN_MIN_W as more of them are added. */
export const BIN_MAX_W = 175;
export const BIN_MIN_W = 90;
export const BIN_H = 110;

/**
 * Deterministically lay items and bins out into a tidy default: bins evenly
 * spaced along the bottom of the stage, items in a centered grid above them.
 * Pure — returns new arrays and never mutates the inputs. Shared by the studio
 * "Auto-arrange" button and the canvas so a fresh activity is neat by default.
 */
export function autoArrangeLayout(
  items: FlexibleItem[],
  targets: FlexibleTarget[]
): { items: FlexibleItem[]; targets: FlexibleTarget[] } {
  // ── Bins: a single row along the bottom, sized to fit however many there are.
  const marginX = 20;
  const binGap = 16;
  const n = targets.length;

  let arrangedTargets = targets;
  let binTop = STAGE_H - BIN_H - 16;
  if (n > 0) {
    const rawW = (STAGE_W - 2 * marginX - (n - 1) * binGap) / n;
    const binW = Math.round(Math.max(BIN_MIN_W, Math.min(BIN_MAX_W, rawW)));
    const rowW = n * binW + (n - 1) * binGap;
    const startX = Math.round((STAGE_W - rowW) / 2);
    binTop = STAGE_H - BIN_H - 16;
    arrangedTargets = targets.map((t, i) => ({
      ...t,
      x: startX + i * (binW + binGap),
      y: binTop,
      width: binW,
      height: BIN_H
    }));
  }

  // ── Items: a centered grid filling the space above the bins.
  const m = items.length;
  let arrangedItems = items;
  if (m > 0) {
    const cols = Math.min(5, m);
    const cellW = ITEM_SIZE + 24;
    const cellH = ITEM_SIZE + 18;
    const rows = Math.ceil(m / cols);
    const gridW = cols * cellW - (cellW - ITEM_SIZE);
    const startX = Math.round(Math.max(10, (STAGE_W - gridW) / 2));

    // Vertically center the grid within the open area above the bins.
    const topBound = 16;
    const bottomBound = binTop - 12;
    const gridH = rows * cellH - (cellH - ITEM_SIZE);
    const startY = Math.round(Math.max(topBound, topBound + (bottomBound - topBound - gridH) / 2));

    arrangedItems = items.map((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        ...item,
        x: startX + col * cellW,
        y: startY + row * cellH
      };
    });
  }

  return { items: arrangedItems, targets: arrangedTargets };
}
