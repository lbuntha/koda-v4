/** The invitation link: the app's own address with the room code on it. */

export const CODE_PATTERN = /^[A-Z0-9]{6}$/;

/** Whatever was typed or pasted, as a code if it can be one. */
export const cleanCode = (raw: string): string => {
  const letters = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return letters.startsWith("KODA") && letters.length > 6 ? letters.slice(4, 10) : letters.slice(0, 6);
};

export const roomCodeFromUrl = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    const code = cleanCode(new URL(window.location.href).searchParams.get("room") ?? "");
    return CODE_PATTERN.test(code) ? code : null;
  } catch {
    return null;
  }
};

export const linkFor = (code: string): string => `${window.location.origin}/?room=${code}`;

/** Take the code off the address once it has been used, so a refresh does not reopen it. */
export const clearRoomFromUrl = (): void => {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("room")) return;
    url.searchParams.delete("room");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* The address stays as it is. */
  }
};
