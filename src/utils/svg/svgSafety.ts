import { isAllowedAttribute, isAllowedElement, isAllowedStyleSheet } from "./svgPolicy";

/**
 * A cheap first pass, kept only to reject obvious junk before parsing and to give the
 * designer an immediate "this won't work" while typing. It is *not* the security boundary —
 * `sanitizeSvgMarkup` is. A blocklist cannot be trusted as one; see svgPolicy.ts.
 */
const OBVIOUSLY_UNSAFE = /<\s*(script|foreignobject|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html/i;

export function isSafeSvgMarkup(markup: string): boolean {
  const cleaned = markup.trim();
  return cleaned.toLowerCase().startsWith("<svg") && !OBVIOUSLY_UNSAFE.test(cleaned);
}

/**
 * Rebuild the markup keeping only what svgPolicy allows, and return "" if it cannot be
 * parsed. This is what must run before any `dangerouslySetInnerHTML`.
 *
 * The browser's own parser does the parsing, so there is no second implementation of HTML
 * quirks to get wrong — the tree that gets inspected is exactly the tree that would render.
 */
export function sanitizeSvgMarkup(markup: string): string {
  const cleaned = markup.trim();
  if (!cleaned.toLowerCase().startsWith("<svg")) return "";

  // No DOMParser (server render, unit test): refuse rather than pass markup through
  // unchecked. Failing closed here costs a missing image, never an execution.
  if (typeof DOMParser === "undefined") return "";

  const parsed = new DOMParser().parseFromString(cleaned, "image/svg+xml");
  if (parsed.getElementsByTagName("parsererror").length > 0) return "";

  const root = parsed.documentElement;
  if (!root || !isAllowedElement(root.nodeName)) return "";
  prune(root);
  return new XMLSerializer().serializeToString(root);
}

/** Depth-first, and iterated over a static copy because the walk removes as it goes. */
function prune(element: Element): void {
  for (const attribute of [...element.attributes]) {
    if (!isAllowedAttribute(attribute.name, attribute.value)) {
      element.removeAttribute(attribute.name);
    }
  }
  for (const child of [...element.children]) {
    if (!isAllowedElement(child.nodeName)) {
      child.remove();
    } else if (child.nodeName.toLowerCase() === "style") {
      // Admitted for real artwork, but only when its text stays inside the document.
      if (!isAllowedStyleSheet(child.textContent || "")) child.remove();
    } else {
      prune(child);
    }
  }
}

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";

/**
 * Presentation attributes that authors paste in React (JSX) spelling. Inside JSX these
 * work, but library artwork is also served as a standalone SVG document to `<img>` (the
 * student hero thumbnail), where camelCase names are simply ignored — a pasted
 * `strokeWidth="4"` silently renders as hairline. Only names that are genuinely
 * hyphenated in SVG belong here: `viewBox`, `gradientUnits`, `preserveAspectRatio` and
 * friends are correctly camelCase and must be left alone.
 */
const JSX_ATTRIBUTE_NAMES = [
  "strokeWidth", "strokeLinecap", "strokeLinejoin", "strokeDasharray", "strokeDashoffset",
  "strokeOpacity", "strokeMiterlimit", "fillOpacity", "fillRule", "clipPath", "clipRule",
  "stopColor", "stopOpacity", "fontFamily", "fontSize", "fontWeight", "fontStyle",
  "textAnchor", "letterSpacing", "dominantBaseline", "paintOrder", "vectorEffect",
  "markerStart", "markerMid", "markerEnd", "floodColor", "floodOpacity",
  "colorInterpolationFilters",
] as const;

const kebab = (name: string): string => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/**
 * Make markup valid as a *standalone document*, not just as a JSX fragment: guarantee the
 * SVG namespace and hyphenate JSX-style presentation attributes. Without `xmlns` a browser
 * refuses to parse the file at all, so an `<img src="…svg">` renders as a broken image —
 * which is how every skill thumbnail from the SVG Library reaches the student home.
 */
export function normalizeSvgDocumentMarkup(markup: string): string {
  const cleaned = markup.trim();
  if (!cleaned.toLowerCase().startsWith("<svg")) return cleaned;

  const openingTagEnd = cleaned.indexOf(">");
  if (openingTagEnd === -1) return cleaned;

  let openingTag = cleaned.substring(0, openingTagEnd);
  const body = cleaned.substring(openingTagEnd);

  if (!/\bxmlns\s*=/i.test(openingTag)) {
    openingTag = `<svg xmlns="${SVG_NS}"${openingTag.slice(4)}`;
  }
  if (/\bxlink:[a-z]/i.test(cleaned) && !/\bxmlns:xlink\s*=/i.test(openingTag)) {
    openingTag = `<svg xmlns:xlink="${XLINK_NS}"${openingTag.slice(4)}`;
  }

  let normalized = openingTag + body;
  JSX_ATTRIBUTE_NAMES.forEach(name => {
    normalized = normalized.replace(new RegExp(`\\b${name}(\\s*=)`, "g"), `${kebab(name)}$1`);
  });
  return normalized;
}
