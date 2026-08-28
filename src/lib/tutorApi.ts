/**
 * Calling the tutor endpoints, now that the key is not the browser's to send.
 *
 * These routes live on the Node server, not the data API, so they are the one
 * place the app calls `fetch` outside `lib/sync/api.ts`. What changed is what
 * goes with the request: it used to carry the family's Gemini key out of
 * `localStorage`, and now it carries the access token the session already
 * holds. The Node server turns that into the key, server-side, and the browser
 * never learns what the key is.
 *
 * Signed out, there is no token and no header — the tutor server falls back to
 * the deployment's own `GEMINI_API_KEY`, which is what a device with no account
 * has always used.
 */

import { currentPersonaId } from "./personas";
import { accessToken } from "./sync";

export async function tutorHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = await accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Offline, or the refresh failed. The call still goes; it just falls back.
  }
  return headers;
}

/** The live socket cannot set headers, so its token travels in the URL. */
export async function tutorSocketToken(): Promise<string> {
  try {
    return (await accessToken()) ?? "";
  } catch {
    return "";
  }
}

/**
 * What Koda is told about the screen behind the question.
 *
 * Every Koda surface fills the same three fields, so the model is handed the
 * same shape whether a child asked from the home page or mid-round. Absent
 * fields are absent on purpose: telling Koda about a question that is not on
 * screen is worse than telling it nothing, because it will answer about that
 * one — which is exactly what the home page used to do.
 */
export interface KodaContext {
  /** What the child is learning about, if it is known. */
  topic?: string;
  /** The question on screen. Omitted when there is none. */
  question?: string;
  /** Where they are and what they are doing, in a sentence. */
  where?: string;
}

/** One turn of a written conversation with Koda. */
export interface KodaTurn {
  sender: "koda" | "student";
  text: string;
}

/** Why a written answer did not arrive, when one did not. */
export type KodaReplyError = "plan" | "off" | "network";

export interface KodaReply {
  text: string | null;
  error: KodaReplyError | null;
  /**
   * True when the text is the server's stand-in rather than Koda's answer.
   *
   * The tutor route answers 200 with a canned nudge when it has no key or the
   * model call throws, so a child mid-question is never left with nothing. That
   * is the right call and a terrible one to hide: every reply then looks
   * plausible and none of them is Koda, which is how a deployment with a stale
   * model id or an expired key goes unnoticed. The panel marks these.
   */
  degraded: boolean;
}

/**
 * Ask Koda a question in writing.
 *
 * Kept here rather than in the modal because the two Koda surfaces — the ask
 * panel and the round's own hint button — must send the same shape or the
 * server's context prompt means different things on each. The refusals are
 * translated into the three a person can be told apart:
 *
 * * **plan** (402) — the family's subscription does not cover Koda. Answerable.
 * * **off** (503) — the operator switched written help off. Not answerable, and
 *   nothing should have offered it; a control that is drawn anyway says so
 *   plainly rather than pretending Koda is thinking.
 * * **network** — everything else, including a model that failed. The caller
 *   decides whether to fall back to the local socratic engine.
 */
export async function askKodaInWriting(input: {
  /** What the child typed. */
  question: string;
  context?: KodaContext;
  history?: KodaTurn[];
}): Promise<KodaReply> {
  try {
    const res = await fetch("/api/tutor/respond", {
      method: "POST",
      headers: await tutorHeaders(),
      body: JSON.stringify({
        userMessage: input.question,
        // Which teacher, as an id. The manner behind it is resolved on the
        // server from the roster an operator controls — a browser that could
        // send prose could rewrite the tutor.
        personaId: currentPersonaId(),
        topic: input.context?.topic,
        // The route puts this in the prompt verbatim, so it carries only what
        // is true: no `question` key at all when no question is on screen.
        problem: {
          ...(input.context?.question ? { question: input.context.question } : {}),
          ...(input.context?.where ? { situation: input.context.where } : {}),
        },
        state: {},
        history: (input.history ?? []).slice(-6),
      }),
    });
    if (res.status === 402) return { text: null, error: "plan", degraded: false };
    if (res.status === 503) return { text: null, error: "off", degraded: false };
    if (!res.ok) return { text: null, error: "network", degraded: false };
    const data = (await res.json()) as { replyText?: string; degraded?: string };
    return data.replyText
      ? { text: data.replyText, error: null, degraded: Boolean(data.degraded) }
      : { text: null, error: "network", degraded: false };
  } catch {
    return { text: null, error: "network", degraded: false };
  }
}
