import { accessToken, request } from "./sync";

/**
 * The four digits between a child's session and their parent's.
 *
 * Setting and clearing live here rather than in `lib/sync/session.ts`, which
 * carries only the two calls the switcher itself needs — a parent managing the
 * PIN is a different job from a switch being asked to prove itself, and keeping
 * them apart is what stops `session.ts` growing a settings API.
 *
 * On what this protects, and what it does not, see the comment on the PIN
 * routes in `server/app/routers/family.py`. Short version: it stops a child
 * tapping into billing, and it does not stop an adult holding the tablet.
 */

/** Four digits. Long enough to not be guessed by accident, short enough to recall. */
export const PIN_LENGTH = 4;

export const isWellFormed = (pin: string): boolean =>
  new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

export const FamilyPin = {
  /** Whether the family has one. Readable by anyone signed in, child included. */
  async isSet(): Promise<boolean> {
    const token = await accessToken();
    const state = await request<{ isSet: boolean }>("/family/pin", { token });
    return state.isSet;
  },

  /** Set or replace it. Needs `family:update`, which no child role holds. */
  async set(pin: string): Promise<void> {
    const token = await accessToken();
    await request("/family/pin", { method: "PUT", token, body: { pin } });
  },

  /** Remove it, returning the switcher to how it behaved before there was one. */
  async clear(): Promise<void> {
    const token = await accessToken();
    await request("/family/pin", { method: "DELETE", token });
  },
};
