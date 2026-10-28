import { skillLocales } from "../../kit/i18n";
import type { Board, Color } from "./board";

/**
 * Colour Sweeper's own words — `../locales/en.json`, `../locales/km.json`, and
 * any other language dropped beside them. See `kit/i18n.ts` for the pattern.
 */
export const { t: tw } = skillLocales("color-sweeper");

/** "Orange": the colour as a name, in the language on screen. */
export const colourTitle = (color: Color): string => tw(`colour.${color}.name`);

/** "orange": the colour in the middle of a sentence. */
export const colourWord = (color: Color): string => tw(`colour.${color}.word`);

/** "row 1, column 2": where a tile sits, for the middle of a sentence. */
export const whereLower = (board: Board, cell: number): string =>
  tw("where.lower", { row: String(Math.floor(cell / board.size) + 1), col: String((cell % board.size) + 1) });

/** "Row 1, column 2": where a tile sits, for the start of a label. */
export const whereTitle = (board: Board, cell: number): string =>
  tw("where.title", { row: String(Math.floor(cell / board.size) + 1), col: String((cell % board.size) + 1) });

/** "a, b or c": colours or options joined the way the language on screen joins them. */
export const joinOr = (items: string[]): string => items.reduce((a, b) => tw("or", { a, b }));
