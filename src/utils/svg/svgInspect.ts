import { isSafeSvgMarkup, sanitizeSvgMarkup } from "./svgSafety";
import { preprocessSvgMarkup } from "./svgPreprocess";

/** Elements and attributes in a document, for comparing before and after sanitising. */
function countMarkup(markup: string): { elements: number; attributes: number } | null {
  if (!markup || typeof DOMParser === "undefined") return null;
  const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
  if (parsed.getElementsByTagName("parsererror").length > 0) return null;
  const elements = parsed.querySelectorAll("*");
  let attributes = 0;
  elements.forEach((element) => {
    attributes += element.attributes.length;
  });
  return { elements: elements.length, attributes };
}

export type SvgVerdict =
  | { state: "empty" }
  | { state: "invalid"; message: string }
  | { state: "ok"; droppedElements: number; droppedAttributes: number };

/**
 * What the pipeline will do to this markup, worked out before it is saved.
 *
 * The sanitiser drops silently by design, so the one place that must not be
 * silent is wherever markup is accepted: save artwork using something outside
 * the allowlist and the count tells you before it becomes a blank space in a
 * lesson. Every surface that accepts artwork — the Art page's editor, the
 * Library Studio's drawer — asks this same question, so a picture drawn in one
 * place is judged exactly as a picture pasted in the other.
 */
export function inspectSvgMarkup(markup: string): SvgVerdict {
  const trimmed = markup.trim();
  if (!trimmed) return { state: "empty" };
  if (!isSafeSvgMarkup(trimmed)) {
    return {
      state: "invalid",
      message: "Must start with <svg> and carry no <script>, on… handlers, or embedded documents.",
    };
  }

  const normalised = preprocessSvgMarkup(trimmed);
  const sanitised = sanitizeSvgMarkup(normalised);
  if (!sanitised) {
    return {
      state: "invalid",
      message: "The SVG could not be parsed. Check its tags and quoting.",
    };
  }

  const before = countMarkup(normalised);
  const after = countMarkup(sanitised);
  return {
    state: "ok",
    droppedElements: before && after ? Math.max(0, before.elements - after.elements) : 0,
    droppedAttributes: before && after ? Math.max(0, before.attributes - after.attributes) : 0,
  };
}
