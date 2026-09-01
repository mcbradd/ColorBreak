import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("methodology.html navigation wiring", () => {
  const html = readFileSync(join(process.cwd(), "public", "methodology.html"), "utf8");

  it("its only navigation link falls back to the front page, not the buyer workspace", () => {
    // Regression guard for the reported bug: this href used to be "./",
    // which - combined with the SPA's own hash-less-URL default - silently
    // sent visitors into the buyer workspace instead of back to wherever
    // they left from.
    expect(html).toContain('href="./#home"');
    expect(html).not.toMatch(/id="back-link"[^>]*href="\.\/"/);
  });

  it("wires the progressive-enhancement back-navigation script", () => {
    expect(html).toContain('id="back-link"');
    expect(html).toContain('<script type="module" src="./methodology-nav.js">');
  });

  it("keeps the link keyboard-focusable with a visible focus style", () => {
    // A real <a href> is natively keyboard-operable; this just guards the
    // added focus-visible style so the control isn't invisible on :focus.
    expect(html).toMatch(/a:focus-visible\s*\{[^}]*outline/);
  });

  it("does not weaken the page's script-src to allow inline scripts", () => {
    const cspMatch = html.match(/Content-Security-Policy" content="([^"]+)"/);
    expect(cspMatch, "methodology.html should declare a CSP meta tag").not.toBeNull();
    const scriptSrcMatch = cspMatch![1].match(/script-src ([^;]+)/);
    expect(scriptSrcMatch, "CSP should declare script-src").not.toBeNull();
    expect(scriptSrcMatch![1].trim()).toBe("'self'");
  });
});
