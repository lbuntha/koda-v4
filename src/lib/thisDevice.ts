/**
 * What this device is called, in the one sentence a person can act on.
 *
 * It is read in two places that had each written their own answer, and the
 * weaker one was the one that mattered most. `session.ts` sent "Mac" with every
 * sign-in — which names the device list *and* fills `{device}` in "New sign-in
 * to Koda" — while `push/index.ts` was already saying "Chrome on Mac" when it
 * registered a token. A security notice reading "Mac just signed in" tells a
 * parent with a Mac nothing they can check; the browser is the half that says
 * whether it was them.
 *
 * So: one function, and the better sentence wins.
 *
 * **Deliberately coarse.** It is built from the two or three tokens in a user
 * agent that a person would recognise, and never from the version strings — a
 * notification is not a fingerprint, and "Chrome 141.0.7390.55 on macOS 26.1"
 * is both harder to read and more than anybody needs to answer "was that me?".
 * Where a browser cannot be named it says "Browser", which is honest and still
 * leaves the platform doing its job.
 *
 * Existing device records keep whatever name they were saved under; this is
 * what the next sign-in writes.
 */

/** Just the platform: "Mac", "Android", "Windows", … */
const platformOf = (ua: string): string => {
  if (/Android/.test(ua)) return "Android";
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone|iPod/.test(ua)) return "iPhone";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/CrOS/.test(ua)) return "Chromebook";
  if (/Linux/.test(ua)) return "Linux";
  return "";
};

/** Just the browser: "Chrome", "Safari", … Order matters — see below. */
const browserOf = (ua: string): string => {
  // Edge and Opera both carry "Chrome/" in their user agent, and Chrome carries
  // "Safari/". Tested most specific first, or every browser here is Chrome and
  // Chrome is Safari.
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser\//.test(ua)) return "Samsung Internet";
  if (/Firefox\/|FxiOS\//.test(ua)) return "Firefox";
  if (/CriOS\//.test(ua)) return "Chrome";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "";
};

/**
 * This device, as a person would name it: "Chrome on Mac".
 *
 * Falls back through everything it can still say rather than to a placeholder:
 * a browser with no recognisable platform is still "Firefox", a platform with
 * no recognisable browser is still "Mac", and only a user agent that says
 * neither reaches "This device".
 */
export function describeThisDevice(ua: string = navigator.userAgent): string {
  const browser = browserOf(ua);
  const platform = platformOf(ua);

  if (browser && platform) return `${browser} on ${platform}`;
  return browser || platform || "This device";
}
