import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMobileInputViewport } from "./mobile-input-viewport";

class TestVisualViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
}

describe("mobile input viewport", () => {
  let viewport: TestVisualViewport;
  let cleanup: () => void;
  let scrollTo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    viewport = new TestVisualViewport();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    Object.defineProperty(window, "scrollX", { configurable: true, value: 12 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 480 });
    scrollTo = vi.fn();
    Object.defineProperty(window, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    cleanup = installMobileInputViewport();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("keeps the focused field inside the keyboard-safe visual viewport", () => {
    const input = document.createElement("input");
    const reveal = vi.fn();
    input.scrollIntoView = reveal;
    input.getBoundingClientRect = () => ({
      top: 700,
      bottom: 740,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: 700,
      toJSON: () => ({}),
    });
    document.body.append(input);

    input.focus();
    viewport.height = 360;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(reveal).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
    expect(document.documentElement.style.getPropertyValue("--visual-viewport-height"))
      .toBe("360px");
    expect(document.documentElement).toHaveClass("keyboard-open");
  });

  it("restores the exact pre-keyboard view after the keyboard closes", () => {
    const input = document.createElement("input");
    input.scrollIntoView = vi.fn();
    document.body.append(input);

    input.focus();
    viewport.height = 360;
    viewport.dispatchEvent(new Event("resize"));
    input.blur();
    vi.runOnlyPendingTimers();
    expect(scrollTo).not.toHaveBeenCalled();

    viewport.height = 844;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(document.documentElement).not.toHaveClass("keyboard-open");
    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "auto",
      left: 12,
      top: 480,
    });
  });

  it("does not snap back to a still-focused field during ordinary page scrolling", () => {
    const input = document.createElement("input");
    const reveal = vi.fn();
    let top = 120;
    input.scrollIntoView = reveal;
    input.getBoundingClientRect = () => ({
      top,
      bottom: top + 40,
      left: 0,
      right: 200,
      width: 200,
      height: 40,
      x: 0,
      y: top,
      toJSON: () => ({}),
    });
    document.body.append(input);

    input.focus();
    vi.runAllTimers();
    reveal.mockClear();

    top = -300;
    viewport.offsetTop = 56;
    viewport.dispatchEvent(new Event("scroll"));
    vi.runAllTimers();

    expect(reveal).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--visual-viewport-top"))
      .toBe("56px");
  });

  it("treats a sticky composer action rail as keyboard occlusion", () => {
    const sheet = document.createElement("section");
    sheet.className = "sheet";
    const input = document.createElement("input");
    const reveal = vi.fn();
    input.scrollIntoView = reveal;
    input.getBoundingClientRect = () => ({
      top: 270, bottom: 320, left: 0, right: 200, width: 200, height: 50,
      x: 0, y: 270, toJSON: () => ({}),
    });
    const footer = document.createElement("footer");
    footer.className = "composer-actions";
    footer.getBoundingClientRect = () => ({
      top: 300, bottom: 360, left: 0, right: 390, width: 390, height: 60,
      x: 0, y: 300, toJSON: () => ({}),
    });
    sheet.append(input, footer);
    document.body.append(sheet);

    input.focus();
    viewport.height = 360;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();

    expect(reveal).toHaveBeenCalled();
  });
});
