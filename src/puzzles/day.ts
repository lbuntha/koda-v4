/**
 * The puzzle day: midnight in Phnom Penh, for every device.
 *
 * Not the device's own midnight, or two children in one class would get
 * different words on a phone set to another zone, and a share card would name
 * a different day from the one the friend is playing.
 */

/** Cambodia is UTC+7 all year; it has no daylight saving. */
export const PUZZLE_TZ_OFFSET_MINUTES = 7 * 60;

export const puzzleDay = (now: Date = new Date()): string =>
  new Date(now.getTime() + PUZZLE_TZ_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);

export const dayNumber = (day: string): number => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

export const addDays = (day: string, n: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
