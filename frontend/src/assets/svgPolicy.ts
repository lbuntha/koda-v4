/**
 * What is allowed to survive inside library SVG.
 *
 * The previous guard was a single regex listing things to *reject*. A blocklist over markup
 * has to anticipate every syntax an attacker might use, while the browser's parser is busy
 * normalising forms the regex never sees — entity-encoded scheme prefixes in an attribute
 * value, animated attribute names, external references pulled in by `<use>` or `<style>`.
 * Getting that list complete is not a thing anyone manages to do once and be done with.
 *
 * So the rule is inverted: nothing survives unless it is named here. An unknown element or
 * attribute is dropped rather than inspected. New drawing features occasionally need a name
 * added — that is the intended cost, and it fails closed (artwork looks wrong) rather than
 * open (artwork runs code).
 *
 * The policy lives apart from the DOM walk so it can be tested without a browser.
 */

/** Drawing, grouping, text, gradients, filters — everything artwork legitimately needs. */
export const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "defs", "symbol", "title", "desc", "metadata",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textpath",
  "lineargradient", "radialgradient", "stop", "pattern", "clippath", "mask", "marker",
  "filter", "fegaussianblur", "feoffset", "feblend", "femerge", "femergenode",
  "fecolormatrix", "fecomposite", "feflood", "fedropshadow", "fturbulence", "feturbulence",
  "use",
  // Real library artwork uses <style> with class selectors, so refusing it outright would
  // break existing assets. Its text is checked by `isAllowedStyleSheet` instead.
  "style",
]);

/**
 * Attributes that only ever describe appearance or geometry.
 *
 * Event handlers are absent by construction rather than by pattern-matching `on*`, which is
 * the point of an allowlist. `style` is absent too: it can reference external URLs, and every
 * effect it provides is available through presentation attributes.
 */
export const ALLOWED_ATTRIBUTES = new Set([
  "id", "class", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
  "width", "height", "points", "transform", "viewbox", "preserveaspectratio",
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap",
  "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset", "stroke-opacity",
  "stroke-miterlimit", "opacity", "color", "offset", "stop-color", "stop-opacity",
  "gradientunits", "gradienttransform", "spreadmethod", "patternunits", "patterncontenttunits",
  "patterntransform", "clip-path", "clip-rule", "mask", "filter", "marker-start",
  "marker-mid", "marker-end", "paint-order", "vector-effect", "shape-rendering",
  "font-family", "font-size", "font-weight", "font-style", "text-anchor", "letter-spacing",
  "dominant-baseline", "dx", "dy", "rotate", "textlength", "lengthadjust",
  "xmlns", "xmlns:xlink", "version", "fr", "fx", "fy",
  "stddeviation", "in", "in2", "result", "mode", "type", "values", "flood-color",
  "flood-opacity", "operator", "k1", "k2", "k3", "k4",
]);

/**
 * `href` is allowed only as a same-document fragment (`#gradient-1`), which is what `<use>`
 * and `fill="url(#…)"` need. Anything else — a remote URL, a `data:` document, a scripting
 * scheme — is a way to pull in content this policy never got to inspect.
 */
export const REFERENCE_ATTRIBUTES = new Set(["href", "xlink:href"]);

export function isAllowedReference(value: string): boolean {
  return /^#[A-Za-z_][-\w.:]*$/.test(value.trim());
}

/**
 * `fill`/`stroke` accept `url(#id)`. The same reasoning applies: a fragment is fine, an
 * absolute URL is a request to a third party from inside a child's page.
 */
export function isAllowedPaintValue(value: string): boolean {
  const match = value.trim().match(/^url\(\s*(['"]?)([^'")]*)\1\s*\)$/i);
  return match ? isAllowedReference(match[2]) : true;
}

export function isAllowedAttribute(name: string, value: string): boolean {
  const lower = name.toLowerCase();
  if (REFERENCE_ATTRIBUTES.has(lower)) return isAllowedReference(value);
  if (!ALLOWED_ATTRIBUTES.has(lower)) return false;
  return isAllowedPaintValue(value);
}

export function isAllowedElement(tagName: string): boolean {
  return ALLOWED_ELEMENTS.has(tagName.toLowerCase());
}


/**
 * CSS inside `<style>`, which is admitted only because real artwork depends on it.
 *
 * Two things are refused: `@import`, which fetches a stylesheet from anywhere, and any `url()`
 * that is not a same-document fragment. Both would let an asset reach outside the page it is
 * drawn in — the same rule the reference attributes follow, applied to CSS text.
 *
 * Note this does *not* scope the rules. Inline SVG shares the page's CSS scope, so a selector
 * like `.title` can restyle unrelated parts of the app. That is a defacement risk, not an
 * execution one, and the durable fix is to render library artwork in an `<img>` (its own
 * document) rather than inline.
 */
export function isAllowedStyleSheet(css: string): boolean {
  if (/@import\b/i.test(css)) return false;
  if (/\bexpression\s*\(|\bbehavior\s*:/i.test(css)) return false;
  const references = css.match(/url\(([^)]*)\)/gi) || [];
  return references.every(isAllowedPaintValue);
}
