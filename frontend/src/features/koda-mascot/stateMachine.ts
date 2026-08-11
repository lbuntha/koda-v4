export type KodaMascotState =
  | "idle"
  | "welcome"
  | "talking"
  | "listening"
  | "waiting"
  | "thinking"
  | "hint"
  | "happy"
  | "excited"
  | "oops"
  | "sad"
  | "loading"
  | "goodbye";

export type KodaMascotEvent =
  | "RESET"
  | "WELCOME"
  | "SPEAK"
  | "LISTEN"
  | "WAIT"
  | "THINK"
  | "SHOW_HINT"
  | "SUCCEED"
  | "CELEBRATE"
  | "FAIL_SOFTLY"
  | "FEEL_SAD"
  | "LOAD"
  | "GOODBYE";

const EVENT_STATE: Record<KodaMascotEvent, KodaMascotState> = {
  RESET: "idle",
  WELCOME: "welcome",
  SPEAK: "talking",
  LISTEN: "listening",
  WAIT: "waiting",
  THINK: "thinking",
  SHOW_HINT: "hint",
  SUCCEED: "happy",
  CELEBRATE: "excited",
  FAIL_SOFTLY: "oops",
  FEEL_SAD: "sad",
  LOAD: "loading",
  GOODBYE: "goodbye",
};

export const ONE_SHOT_STATE_DURATION_MS: Partial<Record<KodaMascotState, number>> = {
  welcome: 1500,
  happy: 1300,
  excited: 1800,
  oops: 1100,
  goodbye: 1400,
};

/** Pure transition helper so lessons can drive Koda without knowing animation details. */
export const nextKodaMascotState = (_current: KodaMascotState, event: KodaMascotEvent): KodaMascotState => EVENT_STATE[event];

