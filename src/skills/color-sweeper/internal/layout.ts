import type { BoardSize } from "./board";

export const BOARD_LAYOUT = {
  minTile: 44, maxTile: 64, gap: 8, inset: 12,
} as const;
/** Width includes the board's own insets; the host owns page padding. */
export function boardLayout(size: BoardSize, availableWidth: number) {
  if (![3, 4].includes(size) || !Number.isFinite(availableWidth) || availableWidth <= 0) throw new Error("Invalid board layout");
  const room = (availableWidth - 2 * BOARD_LAYOUT.inset - (size - 1) * BOARD_LAYOUT.gap) / size;
  const tile = Math.max(BOARD_LAYOUT.minTile, Math.min(BOARD_LAYOUT.maxTile, Math.floor(room)));
  const width = size * tile + (size - 1) * BOARD_LAYOUT.gap + 2 * BOARD_LAYOUT.inset;
  return { tile, width, scrollInside: width > availableWidth };
}
/**
 * The skill's motion vocabulary, declared once.
 *
 * Springs for anything that moves — a tap, a tile settling into a colour —
 * because a spring is what makes a thing feel physical. Not for the board
 * fade: opacity has no momentum, so a spring only contributes its own settling
 * time, and `SPRING.enter` is underdamped enough that a board sat visibly
 * washed out while a child was already trying to read it. A short tween says
 * "a new board arrived" and gets out of the way.
 */
export const MOTION_PLAN = {
  /** Tween, not spring. Inside the 120-200ms feedback budget. */
  boardEnterMs: 180,
  selection: "tap", paint: "settle", undo: "settle",
  feedbackTargetMs: [120, 200], hintSequenceMaxMs: 800,
} as const;
export function motionPolicy(practice: boolean, reducedMotion: boolean) {
  return { animateInput: !reducedMotion, animateHint: !practice && !reducedMotion,
    staticHintAvailable: !practice, blockInputUntilAnimationEnds: false as const };
}
