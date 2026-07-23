const UNSAFE_SVG = /<\s*(script|foreignobject|iframe|object|embed)\b|\bon[a-z]+\s*=|javascript\s*:|data\s*:\s*text\/html/i;

export function isSafeSvgMarkup(markup: string): boolean {
  const cleaned = markup.trim();
  return cleaned.toLowerCase().startsWith("<svg") && !UNSAFE_SVG.test(cleaned);
}

export function sanitizeSvgMarkup(markup: string): string {
  return isSafeSvgMarkup(markup) ? markup.trim() : "";
}
