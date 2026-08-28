/**
 * Asking a model to draw an asset.
 *
 * On the Node tutor server rather than the data API, for the reason every AI
 * call is: that is the process holding the keys. The browser sends a sentence
 * and its access token and gets markup back — it never learns which provider
 * answered with what credential.
 *
 * What comes back is a *draft*. Nothing here saves: the markup lands in the
 * editor the author was already in, goes through the same sanitiser a paste
 * goes through, and is filed under a name a person chose. A model cannot put
 * anything in the library on its own.
 */

import { tutorHeaders } from "./tutorApi";

/** The frame the artwork is drawn to. */
export type ArtShape = "thumbnail" | "square" | "free";

/** Which model draws. Unset follows the deployment's default. */
export type ArtProvider = "gemini" | "chatgpt" | "claude";

/**
 * How closely to follow the house style.
 *
 * `koda` (the default) draws the app's own look — rounded, chunky, the brand
 * purple/pink/yellow — so a new asset sits beside the existing ones instead of
 * next to them. `plain` drops it, for the occasions where a subject genuinely
 * needs to look like something else.
 */
export type ArtStyle = "koda" | "plain";

export interface GenerateArtOptions {
  shape?: ArtShape;
  style?: ArtStyle;
  provider?: ArtProvider;
}

export async function generateSvg(
  prompt: string,
  options: GenerateArtOptions = {},
): Promise<string> {
  const response = await fetch("/api/art/generate", {
    method: "POST",
    headers: await tutorHeaders(),
    body: JSON.stringify({
      prompt,
      shape: options.shape ?? "free",
      style: options.style ?? "koda",
      provider: options.provider,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { markup?: string; error?: { message?: string } }
    | null;

  if (!response.ok || !body?.markup) {
    // The server's own sentence where there is one: "no key is configured" and
    // "the model did not return an SVG" are different problems with different
    // fixes, and flattening them into "generation failed" helps nobody.
    throw new Error(body?.error?.message ?? "The artwork could not be generated.");
  }

  return body.markup;
}
