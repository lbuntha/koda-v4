import assert from "node:assert/strict";
import test from "node:test";
import { preprocessSvgMarkup } from "../assets/svgPreprocess";
import { isSafeSvgMarkup } from "../assets/svgSafety";

/**
 * Every asset saved through the SVG maker passes through here, and the result is served to a
 * learner's `<img>` as a standalone SVG *document*. A document that is not well-formed XML
 * does not render at all, so "still parses" is the property that matters most.
 */
const parses = (markup: string): boolean => {
  // The browser parses image/svg+xml strictly. DOMParser is unavailable under node:test, so
  // assert the structural property that broke: no stray text between the tag's attributes.
  const openingTag = markup.slice(0, markup.indexOf(">") + 1);
  const withoutAttributes = openingTag
    .replace(/^<svg/i, "")
    .replace(/\b[\w:-]+\s*=\s*("[^"]*"|'[^']*')/g, "")
    .replace(/\/?>$/, "")
    .trim();
  return withoutAttributes === "";
};

test("a multi-value viewBox is replaced whole, not sliced at the first space", () => {
  const output = preprocessSvgMarkup(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle r="4"/></svg>',
  );
  // The regression: ` 0 100 100"` was left stranded inside the opening tag.
  assert.ok(parses(output), `stray tokens in opening tag: ${output.slice(0, 120)}`);
  assert.match(output, /viewBox="0 0 100 100"/);
  assert.equal(output.match(/viewBox=/g)?.length, 1);
});

test("existing width and height are replaced rather than duplicated", () => {
  const output = preprocessSvgMarkup(
    '<svg viewBox="0 0 24 24" width="48" height="48"><rect width="4" height="4"/></svg>',
  );
  assert.ok(parses(output));
  assert.equal(output.match(/\swidth="100%"/g)?.length, 1);
  assert.equal(output.match(/\sheight="100%"/g)?.length, 1);
});

test("single-quoted and unquoted attribute values are handled too", () => {
  for (const source of [
    "<svg viewBox='0 0 32 32'><circle r='4'/></svg>",
    "<svg viewBox=0 width=10><circle r='4'/></svg>",
  ]) {
    assert.ok(parses(preprocessSvgMarkup(source)), source);
  }
});

test("a viewBox is derived from width and height when absent", () => {
  const output = preprocessSvgMarkup('<svg width="64" height="32"><circle r="4"/></svg>');
  assert.ok(parses(output));
  assert.match(output, /viewBox="0 0 64 32"/);
});

test("markup that is not an svg is returned untouched", () => {
  assert.equal(preprocessSvgMarkup("<div>nope</div>"), "<div>nope</div>");
  assert.equal(preprocessSvgMarkup(""), "");
});

/**
 * The curriculum studio accepts SVG markup pasted straight into a skill's thumbnail field
 * and saves it to the shared library. That paste is untrusted text on its way to every
 * learner's page, so the exact pair the handler runs — normalize, then check — is pinned
 * here: normalizing must not launder something executable into looking safe.
 */
test("pasted markup is still rejected after normalizing when it can execute", () => {
  const hostile = [
    '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>',
    '<svg viewBox="0 0 10 10"><circle r="4" onload="alert(1)"/></svg>',
    '<svg viewBox="0 0 10 10"><a href="javascript:alert(1)"><circle r="4"/></a></svg>',
    '<svg viewBox="0 0 10 10"><foreignObject><body/></foreignObject></svg>',
  ];
  for (const markup of hostile) {
    assert.equal(isSafeSvgMarkup(preprocessSvgMarkup(markup)), false, markup);
  }
});

test("ordinary pasted artwork survives normalizing and passes the safety check", () => {
  const markup = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#7A5CF0"/></svg>';
  const normalized = preprocessSvgMarkup(markup);
  assert.ok(isSafeSvgMarkup(normalized));
  assert.ok(parses(normalized));
});
