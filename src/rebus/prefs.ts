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
