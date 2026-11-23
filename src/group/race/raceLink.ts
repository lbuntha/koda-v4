/** The invitation to a lesson race: the app's address with `?race=CODE`, kept apart from Rebus's `?room=`. */

import { CODE_PATTERN, cleanCode } from "../../rebus/group/roomLink";

export const raceCodeFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const code = cleanCode(new URL(window.location.href).searchParams.get("race") ?? "");
    return CODE_PATTERN.test(code) ? code : null;
  } catch {
    return null;
  }
};

export const raceLinkFor = (code: string): string => `${window.location.origin}/?race=${code}`;

/** Take the code off the address once used, so a refresh does not reopen it. */
export const clearRaceFromUrl = (): void => {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("race")) return;
    url.searchParams.delete("race");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* The address stays as it is. */
  }
};
