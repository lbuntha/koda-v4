/**
 * Reading a push message, defensively.
 *
 * Everything here runs on bytes that arrived from the network, in a service
 * worker, before anyone has looked at them. That is the whole reason these are
 * functions in their own file rather than three lines inside the handler: this
 * is where the security of a push notification actually lives, and it is
 * testable here (`pushPayload.test.ts`) in a way it is not inside a worker.
 *
 * Two rules, and both of them are about not trusting the wire:
 *
 * 1. **A notification is always shown.** A push event that resolves without one
 *    is what makes Chrome post "This site has been updated in the background" —
 *    a notice in words nobody here chose. So a payload that is missing, empty
 *    or unparseable still produces something honest to read.
 * 2. **The tap target is a path on our own origin, or it is `/`.** A
 *    notification that can be steered to an arbitrary URL is a phishing
 *    primitive wearing Koda's icon.
 */

export interface PushPayload {
  title: string;
  body: string;
  /** Always a same-origin path beginning with `/`. */
  path: string;
  /** Collapses a repeat of the same thing in place rather than stacking. */
  tag?: string;
  /** Which notification this is, for the app to act on if it is open. */
  kind?: string;
}

/** What a message says when the message itself said nothing useful. */
const FALLBACK: PushPayload = {
  title: "Koda",
  body: "Open Koda to see what's new.",
  path: "/",
};

/**
 * A path on this origin, or `/`.
 *
 * Refuses anything that could leave the origin: an absolute URL, a
 * protocol-relative `//host`, a backslash (which some browsers normalise into a
 * slash), and anything that is not a string in the first place. A query and a
 * fragment are kept — they address a screen, not a host.
 */
export function safePath(raw: unknown): string {
  if (typeof raw !== "string") return "/";

  const path = raw.trim();
  if (!path.startsWith("/")) return "/";
  // `//evil.example` is a URL, not a path, and so is `/\evil.example` once a
  // browser has normalised the backslash.
  if (path.startsWith("//") || path.startsWith("/\\")) return "/";
  if (path.includes("\\")) return "/";

  return path;
}

/**
 * FCM's envelope, opened.
 *
 * `fcm.envelope` sends `data` only and no `notification` block, deliberately —
 * with a notification payload the browser draws its own and the copy, the icon
 * and the tap target stop being ours. What that misses is that FCM then wraps
 * those fields again on the way to the browser. What actually arrives at a raw
 * `push` listener is
 *
 *     {"data": {"title": …, "body": …}, "from": …, "fcmMessageId": …}
 *
 * and this file was reading the outer object. So every real notification on
 * every device fell through to the fallback: "Open Koda to see what's new" on a
 * lock screen, over a server that had composed "Chrome on Mac just signed in"
 * and written it correctly into the history the app shows. Two workers is the
 * thing `docs/PUSH.md` §3 refuses, and binding the token to our own worker is
 * right — it just means the unwrapping the Firebase SDK would have done is ours
 * to do.
 *
 * The outer object wins where it says anything, so a flat payload — the console
 * driver's log line, a hand-sent test, anything not from FCM — reads exactly as
 * it did before.
 */
function unwrap(data: Record<string, unknown>): Record<string, unknown> {
  const inner = data.data;
  if (!inner || typeof inner !== "object" || Array.isArray(inner)) return data;
  return { ...(inner as Record<string, unknown>), ...data };
}

/**
 * The payload as a message we are willing to display.
 *
 * Never throws and never returns a partial object: every field a caller reads
 * is present, so the handler has no branch in which it fails to show anything.
 */
export function safeParse(raw: string | null | undefined): PushPayload {
  if (!raw) return { ...FALLBACK };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not JSON. Rather than drop it, treat the text as the body — a plain
    // string is what a hand-sent test message looks like.
    const body = raw.trim();
    return body ? { ...FALLBACK, body } : { ...FALLBACK };
  }

  if (typeof parsed !== "object" || parsed === null) return { ...FALLBACK };
  const data = unwrap(parsed as Record<string, unknown>);

  const text = (value: unknown, fallback: string): string => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    // Long enough for a real sentence, short enough that a notification cannot
    // be used to paste a wall of text onto a lock screen.
    return trimmed ? trimmed.slice(0, 300) : fallback;
  };

  return {
    title: text(data.title, FALLBACK.title),
    body: text(data.body, FALLBACK.body),
    path: safePath(data.path),
    tag: typeof data.tag === "string" ? data.tag.slice(0, 120) : undefined,
    kind: typeof data.kind === "string" ? data.kind.slice(0, 60) : undefined,
  };
}
