/**
 * What the hand-test page can reach.
 *
 * `scripts/build-library-pages.mjs` bundles this into a single HTML file, so the
 * page runs the same code the tests do — not a copy of it. If the page and the
 * tests ever disagree, one of them is wrong, and that is worth knowing.
 */
export { BANDS, RING_MAX, MAX_TILES, MIN_TILES } from "../data/passage";
export { STARTER_PASSAGES } from "../data/starterPassages";
export { buildSpellingDeck, judgeSpelling, ringOf } from "../data/spellingDeck";
export { core, gapOf, parseStory, sentenceText } from "../data/text";
export { pickExtras, spellsWord, tilesOf, whyUnspellable } from "../data/tiles";
export { RULES, verifyPassage } from "../data/verifyPassage";
