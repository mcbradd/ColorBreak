import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const catalogSets = vi.hoisted(() => vi.fn().mockResolvedValue([
  { code: "FDN", name: "Foundations", released: "2024-11-15", type: "expansion" },
]));
const productsForSet = vi.hoisted(() => vi.fn().mockResolvedValue([
  { key: "fdn-play-box", label: "Play Booster Box", set: "FDN", setName: "Foundations", category: "box", packCount: 36, status: "verified" },
]));
vi.mock("./data/catalog", () => ({ catalogSets, productsForSet, readinessForProduct: vi.fn() }));

const prepareProductSelection = vi.hoisted(() => vi.fn(async (lines: unknown[]) => ({
  lines, assessment: { presentation: "eligible" }, compositionFingerprint: "fp", evidenceFingerprint: "ef",
})));
vi.mock("./domain/decision-evidence", () => ({ prepareProductSelection }));

// The engine itself is replaced; what is under test is that its output lands in
// the existing composer for review, and nowhere else.
const transcribeScreenshot = vi.hoisted(() => vi.fn());
vi.mock("./features/shared/screenshot-ocr", async (importOriginal) => ({
  ...await importOriginal<typeof import("./features/shared/screenshot-ocr")>(),
  transcribeScreenshot,
}));

import { Builder } from "./features/shared/ProductBuilder";

const screenshot = () => new File(["fake"], "notes.png", { type: "image/png" });

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe("screenshot break import", () => {
  it("offers the screenshot path beside the paste path, taking any image the phone can supply", async () => {
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));

    expect(await screen.findByRole("button", { name: /Paste a break listing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Read a screenshot/i })).toBeInTheDocument();
    // "image/*" is what makes iOS offer Photo Library and Take Photo.
    expect(fileInput().accept).toBe("image/*");
  });

  it("puts the transcript in the composer for correction and adds nothing to the break on its own", async () => {
    transcribeScreenshot.mockResolvedValue({
      text: "FDN | Play Booster Box | 2\nD5K | Collectcr Booster Pack | 6",
      uncertain: [{ number: 2, text: "D5K | Collectcr Booster Pack | 6", confidence: 44 }],
      lineCount: 2,
    });
    const onApply = vi.fn();
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply }));
    fireEvent.click(await screen.findByRole("button", { name: /Read a screenshot/i }));
    fireEvent.change(fileInput(), { target: { files: [screenshot()] } });

    const box = await screen.findByRole("textbox", { name: /Break link or product list/i }) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toContain("FDN | Play Booster Box | 2"));

    // Reading a screenshot is an input step, not a commitment. Nothing reaches
    // the break until the buyer has reviewed the text and the matches.
    expect(onApply).not.toHaveBeenCalled();
    expect(box.value).toContain("D5K | Collectcr Booster Pack | 6");
  });

  it("names every line the engine was unsure of instead of quietly trusting it", async () => {
    transcribeScreenshot.mockResolvedValue({
      text: "FDN | Play Booster Box | 2\nD5K | Collectcr Booster Pack | 6",
      uncertain: [{ number: 2, text: "D5K | Collectcr Booster Pack | 6", confidence: 44 }],
      lineCount: 2,
    });
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: /Read a screenshot/i }));
    fireEvent.change(fileInput(), { target: { files: [screenshot()] } });

    const warning = await screen.findByText(/Not confidently read: 1 line/i);
    // Named in plain language, quoting the exact text and its line number, so
    // the warning points at the field that needs the correction.
    expect(warning.closest(".scan-note")!.textContent).toContain("Line 2, read as “D5K | Collectcr Booster Pack | 6”");
    expect(warning.closest(".scan-note")!.textContent).toMatch(/44% confident/);
  });

  it("lets a corrected transcript flow through the existing parser and review step", async () => {
    transcribeScreenshot.mockResolvedValue({
      text: "FDN | Play B00ster Box | 2",
      uncertain: [{ number: 1, text: "FDN | Play B00ster Box | 2", confidence: 52 }],
      lineCount: 1,
    });
    const onApply = vi.fn();
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply }));
    fireEvent.click(await screen.findByRole("button", { name: /Read a screenshot/i }));
    fireEvent.change(fileInput(), { target: { files: [screenshot()] } });

    const box = await screen.findByRole("textbox", { name: /Break link or product list/i }) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).toContain("B00ster"));

    // The buyer repairs the misread, then continues into the one review screen.
    fireEvent.change(box, { target: { value: "FDN | Play Booster Box | 2" } });
    fireEvent.click(screen.getByRole("button", { name: /Review products/i }));

    expect(await screen.findByRole("heading", { name: /Review matches/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/1 matched/)).toBeInTheDocument());
    expect(screen.getByText(/Canonical product/i)).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: /Add 1 lines/i }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(onApply.mock.calls[0][0]).toMatchObject([{ set: "FDN", productLabel: "Play Booster Box", quantity: 2 }]);
  });

  it("names a failed read instead of leaving a silent hang", async () => {
    transcribeScreenshot.mockRejectedValue(new Error("No text was found in that image."));
    render(createElement(Builder, { open: true, onClose: vi.fn(), lines: [], onApply: vi.fn() }));
    fireEvent.click(await screen.findByRole("button", { name: /Read a screenshot/i }));
    fireEvent.change(fileInput(), { target: { files: [screenshot()] } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/No text was found/);
  });
});
