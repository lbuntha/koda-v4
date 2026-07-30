/**
 * The policy, tested without a browser.
 *
 * These assert the *shape* of the rule — unknown things are denied — rather than a list of
 * specific attacks, because "we blocked the payloads we thought of" is exactly the property
 * the old blocklist had.
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  isAllowedAttribute,
  isAllowedElement,
  isAllowedPaintValue,
  isAllowedReference,
  isAllowedStyleSheet,
} from "./svgPolicy";

describe("elements", () => {
  test("drawing elements are kept", () => {
    for (const tag of ["svg", "path", "circle", "g", "linearGradient", "text"]) {
      assert.equal(isAllowedElement(tag), true, tag);
    }
  });

  test("tag matching is case-insensitive, since markup casing is not meaningful", () => {
    assert.equal(isAllowedElement("PATH"), true);
    assert.equal(isAllowedElement("ScRiPt"), false);
  });

  test("anything not named in the policy is dropped, known threat or not", () => {
    for (const tag of ["script", "foreignObject", "iframe", "a", "animate", "set", "handler"]) {
      assert.equal(isAllowedElement(tag), false, tag);
    }
  });

  test("<style> is admitted, because real library artwork depends on it", () => {
    assert.equal(isAllowedElement("style"), true);
  });
});

describe("attributes", () => {
  test("presentation and geometry are kept", () => {
    assert.equal(isAllowedAttribute("d", "M0 0L10 10"), true);
    assert.equal(isAllowedAttribute("stroke-width", "4"), true);
    assert.equal(isAllowedAttribute("viewBox", "0 0 24 24"), true);
  });

  test("event handlers are absent from the allowlist rather than pattern-matched", () => {
    for (const name of ["onload", "onclick", "onbegin", "onmouseover", "ONLOAD"]) {
      assert.equal(isAllowedAttribute(name, "anything"), false, name);
    }
  });

  test("style is dropped — it can reach outside the document", () => {
    assert.equal(isAllowedAttribute("style", "fill:red"), false);
  });

  test("an attribute nobody has heard of is dropped", () => {
    assert.equal(isAllowedAttribute("data-whatever", "1"), false);
    assert.equal(isAllowedAttribute("xlink:actuate", "onLoad"), false);
  });
});

describe("references stay inside the document", () => {
  test("a same-document fragment is what gradients and <use> need", () => {
    assert.equal(isAllowedReference("#gradient-1"), true);
    assert.equal(isAllowedAttribute("href", "#shape"), true);
  });

  test("anything that leaves the document is refused", () => {
    for (const value of [
      "https://example.com/x.svg#a",
      "//example.com/x.svg",
      "/local/x.svg#a",
      "data:image/svg+xml;base64,AAAA",
      "  #ok evil",
    ]) {
      assert.equal(isAllowedReference(value), false, value);
    }
  });

  test("a scheme is refused however it is spelled — the rule never inspects schemes", () => {
    // The allowlist does not try to recognise dangerous schemes; it only recognises
    // fragments. That is why encoding tricks have nothing to bite on.
    for (const value of ["javascript:alert(1)", "javascript&#58;alert(1)", "JaVaScRiPt:x"]) {
      assert.equal(isAllowedReference(value), false, value);
    }
  });

  test("paint may reference a local gradient but not a remote one", () => {
    assert.equal(isAllowedPaintValue("url(#g1)"), true);
    assert.equal(isAllowedPaintValue("url('#g1')"), true);
    assert.equal(isAllowedPaintValue("#ff0000"), true);
    assert.equal(isAllowedPaintValue("url(https://evil.example/x#g)"), false);
    assert.equal(isAllowedAttribute("fill", "url(https://evil.example/x#g)"), false);
  });
});


describe("stylesheet contents", () => {
  test("the styling real artwork actually uses is kept", () => {
    assert.equal(
      isAllowedStyleSheet(".bg { fill: #f8fafc; } .title { font-weight: 800; }"),
      true,
    );
    assert.equal(isAllowedStyleSheet(".a { fill: url(#grad); }"), true);
  });

  test("a stylesheet may not fetch from anywhere else", () => {
    assert.equal(isAllowedStyleSheet('@import url("https://evil.example/x.css");'), false);
    assert.equal(isAllowedStyleSheet(".a { background: url(https://evil.example/pixel.png); }"), false);
    assert.equal(isAllowedStyleSheet(".a { width: expression(alert(1)); }"), false);
  });
});
