import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("modern interface system", () => {
  it("loads the flat-system overrides last and keeps primary rollouts out of panels", () => {
    const entry = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
    const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src", "modern.css"), "utf8");

    expect(entry.indexOf('import "./modern.css"')).toBeGreaterThan(entry.indexOf('import "./supplemental.css"'));
    expect(app).not.toContain('<details className="panel evidence-lens">');
    expect(app).not.toContain('<details className="panel supporting-view">');
    expect(css).toMatch(/\.panel,[\s\S]*?border-radius:\s*2px/);
    expect(css).toMatch(/\.rollout\s*\{[\s\S]*?border:\s*0/);
  });
});
