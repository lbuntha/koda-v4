/**
 * Everything a page can ask a keyboard to do so that it does not suggest, correct or
 * complete what a child types. Spread onto every Rebus answer box.
 *
 * A fast typist loses to a suggestion bar: the keyboard swaps the word as they press
 * Enter. Chrome on Android turns these hints into "no suggestions" for the keyboard;
 * a keyboard app that ignores them (some Samsung and third-party ones) cannot be
 * stopped from a web page, which is what letter tiles are for.
 */
export const NO_SUGGESTIONS = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "none",
  spellCheck: false,
  enterKeyHint: "done",
  // Writing assistants and password managers add their own pop-ups to text boxes.
  "data-gramm": "false",
  "data-gramm_editor": "false",
  "data-enable-grammarly": "false",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-form-type": "other",
} as const;
