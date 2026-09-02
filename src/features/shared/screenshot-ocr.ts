/**
 * Screenshot input adapter for the break-contents composer.
 *
 * Sellers publish a break's contents in their show notes, which on a phone can
 * only be captured as a screenshot. This module turns that screenshot back into
 * text. It is an *input adapter* and nothing more: it owns no marketplace or
 * valuation rule, and it never decides what a break contains. The text it
 * produces is handed to the buyer to correct, and then to the one existing
 * `parseBreakImport` path, so screenshot input and typed input are validated by
 * exactly the same code.
 *
 * The tesseract.js engine is reached through a dynamic `import()` so that none
 * of it — nor its multi-megabyte WebAssembly core — is present in the initial
 * application bundle. ColorBreak opens on a phone in well under a second and
 * that budget is not spent on a feature most sessions never touch.
 */

/**
 * Below this mean per-line confidence the engine is telling us it guessed.
 * Such a line is still shown in full, never dropped or silently repaired, but
 * it is named so the buyer knows precisely where to look before bidding.
 */
export const TRANSCRIPT_CONFIDENCE_FLOOR = 80;

export interface RecognizedLine {
  text: string;
  confidence: number;
}

export interface UncertainLine {
  /** 1-based line number within the transcript, matching the textarea. */
  number: number;
  text: string;
  confidence: number;
}

export interface ScreenshotTranscript {
  /** Every recognized line, in order. Nothing is filtered out. */
  text: string;
  uncertain: UncertainLine[];
  lineCount: number;
}

export interface TranscriptionProgress {
  /** Plain-language description of the current stage. */
  label: string;
  /** 0–1 within the current stage, or undefined when the stage is untimed. */
  ratio?: number;
}

/** Maps tesseract's internal status strings to language a buyer can act on. */
export function progressLabel(status: string): string {
  const stage = status.toLowerCase();
  if (stage.includes("core")) return "Downloading the text-recognition engine";
  if (stage.includes("traineddata") || stage.includes("language")) return "Downloading the English language data";
  if (stage.includes("initializ") || stage.includes("loading")) return "Starting the text recognition";
  if (stage.includes("recognizing")) return "Reading the screenshot";
  return "Working on the screenshot";
}

/**
 * Assembles the engine's per-line output into a reviewable transcript.
 *
 * Every recognized line is kept, including the ones the engine was unsure of:
 * a quietly discarded line is an invisible hole in a break, and a break with an
 * invisible hole produces a confidently wrong bid. Low-confidence lines are
 * reported by number so the warning can point at the exact text to check.
 */
export function summarizeTranscript(lines: readonly RecognizedLine[]): ScreenshotTranscript {
  const kept: RecognizedLine[] = [];
  for (const line of lines) {
    const text = line.text.replace(/\s+$/, "");
    if (!text.trim()) continue;
    kept.push({ text, confidence: line.confidence });
  }
  const uncertain = kept.flatMap((line, index) =>
    line.confidence < TRANSCRIPT_CONFIDENCE_FLOOR
      ? [{ number: index + 1, text: line.text.trim(), confidence: Math.round(line.confidence) }]
      : []);
  return { text: kept.map((line) => line.text).join("\n"), uncertain, lineCount: kept.length };
}

interface TesseractBlockTree {
  blocks?: Array<{ paragraphs?: Array<{ lines?: Array<{ text: string; confidence: number }> }> } | null> | null;
  text?: string;
  confidence?: number;
}

/**
 * Reads the engine's nested block/paragraph/line tree. When a build returns no
 * structured lines at all, the flat text is used and every line is treated as
 * unverified rather than being presented as confidently read.
 */
export function recognizedLines(data: TesseractBlockTree): RecognizedLine[] {
  const structured = (data.blocks ?? []).flatMap((block) =>
    (block?.paragraphs ?? []).flatMap((paragraph) => paragraph?.lines ?? []));
  if (structured.length) return structured.map((line) => ({ text: line.text, confidence: line.confidence }));
  return (data.text ?? "").split(/\r?\n/).map((text) => ({ text, confidence: data.confidence ?? 0 }));
}

/** Same-origin locations staged by `tools/stage-ocr-assets.mjs`. */
const ENGINE_PATHS = {
  workerPath: "ocr/worker.min.js",
  corePath: "ocr/core",
  langPath: "ocr/lang",
};

export class ScreenshotOcrError extends Error {}

/**
 * Recognizes text in a screenshot. Resolves with the full transcript and the
 * named list of lines the engine was unsure about; rejects with a message that
 * says what the buyer can do next.
 */
export async function transcribeScreenshot(
  image: Blob,
  onProgress?: (progress: TranscriptionProgress) => void,
): Promise<ScreenshotTranscript> {
  onProgress?.({ label: "Loading the text-recognition engine" });
  let createWorker;
  try {
    ({ createWorker } = await import("tesseract.js"));
  } catch {
    throw new ScreenshotOcrError("The text-recognition engine could not be downloaded. Check your connection and try again, or paste the show notes as text.");
  }
  const worker = await createWorker("eng", 1, {
    ...ENGINE_PATHS,
    // A blob: worker would inherit the page's Content-Security-Policy and force
    // that policy to allow blob: workers. A same-origin worker script needs no
    // such relaxation.
    workerBlobURL: false,
    logger: (message: { status: string; progress: number }) =>
      onProgress?.({ label: progressLabel(message.status), ratio: message.progress }),
  });
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true, text: true });
    const transcript = summarizeTranscript(recognizedLines(data as TesseractBlockTree));
    if (!transcript.lineCount) {
      throw new ScreenshotOcrError("No text was found in that image. Screenshot the show notes themselves — a photo of a screen, or an image with no text, cannot be read.");
    }
    return transcript;
  } finally {
    await worker.terminate();
  }
}
