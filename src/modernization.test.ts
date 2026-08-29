import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("modern interface system", () => {
  it("loads the electric instrument system last and keeps primary rollouts out of panels", () => {
    const entry = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");
    const app = readFileSync(join(process.cwd(), "src", "App.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "src", "modern.css"), "utf8");
    const future = readFileSync(join(process.cwd(), "src", "future.css"), "utf8");

    expect(entry.indexOf('import "./modern.css"')).toBeGreaterThan(entry.indexOf('import "./supplemental.css"'));
    expect(entry.indexOf('import "./future.css"')).toBeGreaterThan(entry.indexOf('import "./card-preview.css"'));
    expect(app).not.toContain('<details className="panel evidence-lens">');
    expect(app).not.toContain('<details className="panel supporting-view">');
    expect(app.match(/<p className="section-label"/g)).toBeNull();
    expect(app).toContain("function InformationLabel(");
    expect(css).toMatch(/\.panel,[\s\S]*?border-radius:\s*2px/);
    expect(css).toMatch(/\.rollout\s*\{[\s\S]*?border:\s*0/);
    expect(future).toMatch(/--accent:\s*#d7ff00/);
    expect(future).toMatch(/\.page,[\s\S]*?width:\s*100%/);
    expect(future).toMatch(/border-radius:\s*0\s*!important/);
    expect(future).not.toMatch(/#[0-9a-f]{2}(?:1[0-9a-f]|2[0-9a-f])[0-9a-f]{2}\s*;\s*\/\*\s*earth/i);
  });
});
