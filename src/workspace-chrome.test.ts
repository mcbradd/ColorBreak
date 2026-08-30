import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("workspace chrome", () => {
  it("does not put the removed add-product action back in the upper-right nav", () => {
    const app = readFileSync(join(process.cwd(), "src", "features", "workflow", "WorkflowImplementation.tsx"), "utf8");
    const workspaceNav = app.slice(app.indexOf("<nav>"), app.indexOf("</nav>", app.indexOf("<nav>")));

    expect(workspaceNav).not.toContain('title="Add product"');
  });
});
