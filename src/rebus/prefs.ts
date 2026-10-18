/**
 * What this player prefers, kept on this device.
 *
 * Whether to move to the next puzzle by themselves or wait to be tapped. Every
 * read and write is guarded: with no storage the default (tap Next) is used.
 */

const AUTO_KEY = "koda.rebus.autoNext";

export const loadAutoNext = (): boolean => {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
};

export const saveAutoNext = (on: boolean): void => {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {
    /* Not remembered this time. */
  }
};

const ADAPTIVE_KEY = "koda.rebus.adaptive";

/**
 * Where "adaptive" left off, so a child who has been beating the Machine does
 * not start every round on medium. 0 easy, 1 medium, 2 hard; anything unreadable is medium.
 */
export const loadAdaptive = (): 0 | 1 | 2 => {
  try {
    const raw = localStorage.getItem(ADAPTIVE_KEY);
    return raw === "0" ? 0 : raw === "2" ? 2 : 1;
  } catch {
    return 1;
  }
};

export const saveAdaptive = (level: 0 | 1 | 2): void => {
  try {
    localStorage.setItem(ADAPTIVE_KEY, String(level));
  } catch {
    /* Not remembered this time. */
  }
};
