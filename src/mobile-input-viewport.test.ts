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
    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "auto",
      left: 12,
      top: 480,
    });
  });
});
