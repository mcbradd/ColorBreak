import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBreakImport } from "../../domain/break-import";
import {
  progressLabel,
  recognizedLines,
  summarizeTranscript,
  TRANSCRIPT_CONFIDENCE_FLOOR,
} from "./screenshot-ocr";

const SOURCE = join(process.cwd(), "src", "features", "shared", "screenshot-ocr.ts");
const confident = (text: string) => ({ text, confidence: 96 });

describe("screenshot transcript", () => {
  it("keeps every recognized line, including the ones the engine doubted", () => {
    const transcript = summarizeTranscript([
      confident("FDN | Play Booster Box | 2"),
      { text: "D5K | Collectcr Booster Pack | 6", confidence: 41 },
      confident("BLB | Play Booster Box | 1"),
    ]);

    // A quietly dropped line is an invisible hole in a break, and an invisible
    // hole produces a confidently wrong bid. Everything read stays readable.
    expect(transcript.text.split("\n")).toEqual([
      "FDN | Play Booster Box | 2",
      "D5K | Collectcr Booster Pack | 6",
      "BLB | Play Booster Box | 1",
    ]);
    expect(transcript.lineCount).toBe(3);
  });

  it("names each low-confidence line by number and quotes it verbatim", () => {
    const transcript = summarizeTranscript([
      confident("FDN | Play Booster Box | 2"),
      { text: "D5K | Collectcr Booster Pack | 6", confidence: 41 },
    ]);

    expect(transcript.uncertain).toEqual([
      { number: 2, text: "D5K | Collectcr Booster Pack | 6", confidence: 41 },
    ]);
    // The number must address the same line the buyer sees in the text box,
    // otherwise the warning points at the wrong text to correct.
    expect(transcript.text.split("\n")[transcript.uncertain[0].number - 1])
      .toBe(transcript.uncertain[0].text);
  });

  it("never reports a line as confidently read when it sits under the floor", () => {
    const below = summarizeTranscript([{ text: "OTJ Play Booster Pack x12", confidence: TRANSCRIPT_CONFIDENCE_FLOOR - 1 }]);
    const at = summarizeTranscript([{ text: "OTJ Play Booster Pack x12", confidence: TRANSCRIPT_CONFIDENCE_FLOOR }]);

    expect(below.uncertain).toHaveLength(1);
    expect(at.uncertain).toHaveLength(0);
  });

  it("drops only blank lines, so a transcript has no empty rows to parse", () => {
    const transcript = summarizeTranscript([confident("FDN | Play Booster Box | 2"), confident("   "), confident("")]);

    expect(transcript.lineCount).toBe(1);
  });

  it("feeds the one existing break-import parser rather than a second one", () => {
    const transcript = summarizeTranscript([
      confident("FDN | Play Booster Box | 2"),
      confident("OTJ Play Booster Pack x12"),
    ]);

    // The screenshot path produces text and nothing else. Validation, canonical
    // matching and error reporting all stay with parseBreakImport.
    expect(parseBreakImport(transcript.text)).toMatchObject({
      kind: "list",
      errors: [],
      lines: [
        { set: "FDN", product: "Play Booster Box", quantity: 2 },
        { set: "OTJ", product: "Play Booster Pack", quantity: 12 },
      ],
    });
  });

  it("hands unparseable transcript lines to the existing parser to name", () => {
    const transcript = summarizeTranscript([
      confident("BREAK CONTENTS"),
      confident("FDN | Play Booster Box | 2"),
    ]);
    const parsed = parseBreakImport(transcript.text);

    // Show notes carry prose. It is surfaced as a named parser error, never
    // silently skipped and never guessed into a product.
    expect(parsed.kind).toBe("list");
    if (parsed.kind === "list") expect(parsed.errors).toEqual(["Line 1: use SET | PRODUCT | QUANTITY."]);
  });

  it("reads the engine's nested block tree", () => {
    expect(recognizedLines({
      blocks: [{ paragraphs: [{ lines: [{ text: "FDN | Play Booster Box | 2", confidence: 93 }] }] }],
    })).toEqual([{ text: "FDN | Play Booster Box | 2", confidence: 93 }]);
  });

  it("treats flat text with no structured lines as unverified rather than confident", () => {
    const lines = recognizedLines({ blocks: null, text: "FDN | Play Booster Box | 2" });

    expect(summarizeTranscript(lines).uncertain).toHaveLength(1);
  });

  it("describes each engine stage in language a buyer can act on", () => {
    expect(progressLabel("loading tesseract core")).toMatch(/engine/i);
    expect(progressLabel("loading language traineddata")).toMatch(/language data/i);
    expect(progressLabel("recognizing text")).toMatch(/reading the screenshot/i);
    // An unrecognized future status still names a stage instead of going blank.
    expect(progressLabel("some new status")).toBeTruthy();
  });

  it("reaches tesseract.js only through a dynamic import", () => {
    const source = readFileSync(SOURCE, "utf8");

    // A static import would pull the OCR engine into the initial bundle and
    // spend the mobile first-paint budget on a feature most sessions skip.
    expect(source).toMatch(/await import\("tesseract\.js"\)/);
    expect(source).not.toMatch(/^import[^\n]*"tesseract\.js"/m);
  });

  it("points the engine at same-origin assets, never a third-party CDN", () => {
    const source = readFileSync(SOURCE, "utf8");
    const paths = source.match(/const ENGINE_PATHS = \{[^}]*\}/s)?.[0] ?? "";

    expect(paths).toContain('workerPath: "ocr/worker.min.js"');
    expect(paths).toContain('corePath: "ocr/core"');
    expect(paths).toContain('langPath: "ocr/lang"');
    expect(source).not.toMatch(/https?:\/\//);
  });
});
