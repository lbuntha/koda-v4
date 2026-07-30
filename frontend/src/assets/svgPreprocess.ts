import { normalizeSvgDocumentMarkup } from "./svgSafety";

/**
 * Remove one attribute — name, `=`, and its whole quoted value — from an opening tag.
 *
 * The value alternatives must come before the unquoted one, and quoted values must be
 * allowed to contain spaces. A pattern like `["']?[^"'>\s]*["']?` stops at the first space,
 * so `viewBox="0 0 100 100"` lost only `viewBox="0` and stranded ` 0 100 100"` in the tag.
 * That output is not well-formed XML, so the browser refuses to render it as an SVG
 * document — which is exactly how a saved thumbnail turns into a broken image.
 */
function stripAttribute(tag: string, name: string): string {
  return tag.replace(
    new RegExp(`\\b${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "gi"),
    " ",
  );
}

// Robust helper to sanitize, clean up, and scale user-pasted SVG strings
export function preprocessSvgMarkup(svgMarkup: string): string {
  if (!svgMarkup) return "";
  let cleaned = svgMarkup.trim();
  
  if (!cleaned.toLowerCase().startsWith("<svg")) {
    return cleaned;
  }
  
  const viewBoxMatch = cleaned.match(/viewBox=["']([^"']+)["']/i);
  const widthMatch = cleaned.match(/width=["']([^"']+)["']/i);
  const heightMatch = cleaned.match(/height=["']([^"']+)["']/i);
  
  let viewBox = viewBoxMatch ? viewBoxMatch[1] : null;
  let width = widthMatch ? widthMatch[1] : null;
  let height = heightMatch ? heightMatch[1] : null;
  
  if (!viewBox && width && height) {
    const wNum = parseFloat(width);
    const hNum = parseFloat(height);
    if (!isNaN(wNum) && !isNaN(hNum)) {
      viewBox = `0 0 ${wNum} ${hNum}`;
    }
  }
  
  let openingTagEnd = cleaned.indexOf(">");
  if (openingTagEnd === -1) return cleaned;
  
  let openingTag = cleaned.substring(0, openingTagEnd);
  openingTag = ["width", "height", "viewBox"].reduce(stripAttribute, openingTag);


  openingTag = openingTag.replace(/\s+/g, " ").trim();
  const newAttributes = ` width="100%" height="100%"` + (viewBox ? ` viewBox="${viewBox}"` : "");

  // Library artwork is also served as its own SVG document to the student hero's <img>,
  // so it needs the namespace and hyphenated presentation attributes to render there.
  return normalizeSvgDocumentMarkup(openingTag + newAttributes + cleaned.substring(openingTagEnd));
}
