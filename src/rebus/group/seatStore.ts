/**
 * The seat this device holds in a room, so a refresh or a dropped connection
 * comes back to the same game instead of losing it.
 *
 * Every read and write is guarded: with no storage the player simply has to
 * join again. Stored for one tab only (sessionStorage), because a seat belongs
 * to the person sitting at it, not to the device.
 */

const KEY = "koda.rebus.seat";

export interface StoredSeat {
  code: string;
  token: string;
}

export const loadSeat = (): StoredSeat | null => {
  try {
    const raw = sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredSeat>) : null;
    return parsed && typeof parsed.code === "string" && typeof parsed.token === "string" ? { code: parsed.code, token: parsed.token } : null;
  } catch {
    return null;
  }
};

export const saveSeat = (seat: StoredSeat): void => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(seat));
  } catch {
    /* Not remembered this time. */
  }
};

export const clearSeat = (): void => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Nothing to forget. */
  }
};
