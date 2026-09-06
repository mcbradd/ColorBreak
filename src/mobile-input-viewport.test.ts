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
  let scrollBy: ReturnType<typeof vi.fn>;

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
    scrollBy = vi.fn();
    Object.defineProperty(window, "scrollBy", { configurable: true, value: scrollBy });
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

    expect(scrollBy).toHaveBeenCalledWith({
      behavior: "instant",
      top: 392,
      left: 0,
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
    scrollBy.mockClear();

    top = -300;
    viewport.offsetTop = 56;
    viewport.dispatchEvent(new Event("scroll"));
    vi.runAllTimers();

    expect(reveal).not.toHaveBeenCalled();
    expect(scrollBy).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue("--visual-viewport-top"))
      .toBe("56px");
  });

  it("treats a sticky composer action rail as keyboard occlusion", () => {
    const sheet = document.createElement("section");
    sheet.className = "sheet";
    sheet.style.overflowY = "auto";
    Object.defineProperty(sheet, "clientHeight", { value: 360 });
    Object.defineProperty(sheet, "scrollHeight", { value: 1000 });
    sheet.getBoundingClientRect = () => new DOMRect(0, 0, 390, 360);
    let inputTop = 270;
    sheet.scrollTo = vi.fn((options: ScrollToOptions) => { inputTop -= options.top ?? 0; });
    const input = document.createElement("input");
    const reveal = vi.fn();
    input.scrollIntoView = reveal;
    input.getBoundingClientRect = () => new DOMRect(0, inputTop, 200, 50);
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

    expect(input.getBoundingClientRect().bottom).toBeLessThanOrEqual(288);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("keeps seller inputs above the value dock and respects an explicit jump to results", () => {
    const input = document.createElement("input");
    input.scrollIntoView = vi.fn();
    input.getBoundingClientRect = () => new DOMRect(0, 280, 200, 40);
    const dock = document.createElement("aside");
    dock.className = "seller-value-dock";
    dock.getBoundingClientRect = () => new DOMRect(0, 270, 390, 90);
    const destination = document.createElement("section");
    destination.tabIndex = -1;
    destination.setAttribute("data-viewport-navigation", "");
    document.body.append(input, dock, destination);
    input.focus();
    viewport.height = 360;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(scrollBy).toHaveBeenCalledWith({ behavior: "instant", top: 62, left: 0 });
    destination.focus();
    viewport.height = 844;
    viewport.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(document.documentElement).not.toHaveClass("keyboard-open");
  });
});
