/**
 * SVG markup handling, ported from koda-v4's asset library.
 *
 * Only the functions came across — no asset store, no editor UI, no backend.
 * They are pure string/DOM helpers, so whatever holds the markup here (skill
 * data, a fetch, a paste box) can use them.
 *
 * Two moments, in this order:
 *
 *   accepting markup   isSafeSvgMarkup(input)        // cheap reject while typing
 *                      preprocessSvgMarkup(input)    // normalise size + viewBox, store this
 *
 *   rendering markup   scopeSvgIds(sanitizeSvgMarkup(stored), useId())
 *                      // ^ the sanitize step is the security boundary; it must
 *                      //   run immediately before any dangerouslySetInnerHTML.
 *
 * `scopeSvgIds` matters as soon as the same artwork is drawn twice on a page:
 * without it, the second copy's gradients and clip paths resolve against the
 * first copy's ids.
 */
export { isSafeSvgMarkup, sanitizeSvgMarkup, normalizeSvgDocumentMarkup } from "./svgSafety";
export { preprocessSvgMarkup } from "./svgPreprocess";
export { createSvgAssetId, normalizeSvgAssetIds, scopeSvgIds } from "./svgIds";
export {
  ALLOWED_ELEMENTS,
  ALLOWED_ATTRIBUTES,
  REFERENCE_ATTRIBUTES,
  isAllowedAttribute,
  isAllowedElement,
  isAllowedPaintValue,
  isAllowedReference,
  isAllowedStyleSheet,
} from "./svgPolicy";
