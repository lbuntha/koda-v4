const UNSAFE_SVG = /<\s*(script|foreignobject|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html/i;

export function isSafeSvgMarkup(markup: string): boolean {
  const cleaned = markup.trim();
  return cleaned.toLowerCase().startsWith("<svg") && !UNSAFE_SVG.test(cleaned);
}

export function sanitizeSvgMarkup(markup: string): string {
  return isSafeSvgMarkup(markup) ? markup.trim() : "";
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
