/**
 * A photo redrawn as a colouring page by the AI: for a Studio author
 * (/api/trace/colouring-page, `trace.ai`) or for a child painting their own
 * photo (/api/paint/photo-page, the family's `ai.koda`). What comes back is an
 * ordinary colouring page, read like any upload.
 */

import { tutorHeaders } from "../../lib/tutorApi";

export class AiPageError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** The error codes the Studio has words for; anything else reads as ai_failed. */
export const AI_PAGE_ERRORS = ["not_a_trace_creator", "no_ai_key", "offline", "plan_required", "no_image"] as const;

/** Ask the AI for the page, as a data URL. Throws an AiPageError with the server's code. */
export async function askForColouringPage(photo: string, detail: "simple" | "patterns", route: "studio" | "child" = "studio"): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(route === "child" ? "/api/paint/photo-page" : "/api/trace/colouring-page", {
      method: "POST",
      headers: await tutorHeaders(),
      signal: controller.signal,
      body: JSON.stringify({ image: photo, detail }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AiPageError(data?.error?.code ?? data?.code ?? `http_${res.status}`);
    if (typeof data?.image !== "string") throw new AiPageError("no_image");
    return data.image;
  } catch (e) {
    if (e instanceof AiPageError) throw e;
    throw new AiPageError("offline");
  } finally {
    clearTimeout(timer);
  }
}

/** A data URL as a File, so the AI's page is shrunk and flattened like any upload (`readFile`). */
export function dataUrlFile(url: string): File {
  const [head, body] = url.split(",");
  const type = /data:([^;]+)/.exec(head)?.[1] ?? "image/png";
  const bytes = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return new File([bytes], "colouring-page", { type });
}
