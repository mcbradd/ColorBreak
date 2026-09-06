import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMobileInputViewport } from "./mobile-input-viewport";

class PhoneViewport extends EventTarget {
  height = 844;
  offsetTop = 0;
  scale = 1;
  resize(height: number) { this.height = height; this.dispatchEvent(new Event("resize")); }
  pan(top: number) { this.offsetTop = top; this.dispatchEvent(new Event("scroll")); }
}

describe("phone keyboard and browser bar regressions", () => {
  let viewport: PhoneViewport;
  let cleanup: () => void;
  let fieldTop: number;
  let pageTop: number;
  let input: HTMLInputElement;

  beforeEach(() => {
    vi.useFakeTimers();
    viewport = new PhoneViewport();
    fieldTop = 700;
    pageTop = 480;
    vi.stubGlobal("visualViewport", viewport);
    vi.stubGlobal("innerHeight", 844);
    vi.stubGlobal("scrollY", pageTop);
    vi.stubGlobal("scrollX", 0);
    vi.stubGlobal("scrollBy", vi.fn((options: ScrollToOptions) => {
      fieldTop -= options.top ?? 0;
      pageTop += options.top ?? 0;
      vi.stubGlobal("scrollY", pageTop);
    }));
    vi.stubGlobal("scrollTo", vi.fn((options: ScrollToOptions) => {
      fieldTop -= (options.top ?? pageTop) - pageTop;
      pageTop = options.top ?? pageTop;
      vi.stubGlobal("scrollY", pageTop);
    }));
    input = document.createElement("input");
    input.getBoundingClientRect = () => new DOMRect(0, fieldTop, 200, 48);
    // iOS can retain a tall layout viewport while the keyboard reduces only
    // the visual viewport. Layout-centered scrolling is therefore obscured.
    input.scrollIntoView = vi.fn(() => { fieldTop = (window.innerHeight - 48) / 2; });
    document.body.append(input);
    cleanup = installMobileInputViewport();
  });

  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function expectFieldVisible() {
    const rect = input.getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(viewport.offsetTop + 12);
    expect(rect.bottom).toBeLessThanOrEqual(viewport.offsetTop + viewport.height - 12);
  }

  it("reveals the field when the keyboard animates in small resize steps", () => {
    input.focus();
    vi.runAllTimers();
    for (let height = 820; height >= 340; height -= 24) viewport.resize(height);
    vi.runAllTimers();
    expectFieldVisible();
    expect(document.documentElement).toHaveClass("keyboard-open");
  });

  it("does not lose the field reveal when iOS pans during keyboard opening", () => {
    input.focus();
    viewport.resize(360);
    viewport.pan(44);
    vi.runAllTimers();
    expectFieldVisible();
  });

  it("keeps the compact keyboard layout when browser bars recover 60px", () => {
    input.focus();
    viewport.resize(360);
    vi.runAllTimers();
    viewport.resize(420);
    vi.runAllTimers();
    expect(document.documentElement).toHaveClass("keyboard-open");
    expectFieldVisible();
  });

  it("keeps both the quantity and its Done action above the value strip", () => {
    const group = document.createElement("div");
    group.className = "numeric-input";
    group.getBoundingClientRect = () => new DOMRect(0, fieldTop, 200, 100);
    input.replaceWith(group);
    const done = document.createElement("button");
    done.className = "numeric-done";
    done.textContent = "Done";
    done.getBoundingClientRect = () => new DOMRect(0, fieldTop + 52, 200, 48);
    group.append(input, done);
    const dock = document.createElement("aside");
    dock.className = "seller-value-dock";
    dock.getBoundingClientRect = () => new DOMRect(0, viewport.offsetTop + viewport.height - 88, 390, 88);
    document.body.append(dock);
    input.focus();
    viewport.resize(360);
    vi.runAllTimers();
    expectFieldVisible();
    expect(done.getBoundingClientRect().bottom).toBeLessThanOrEqual(dock.getBoundingClientRect().top - 12);
  });

  it("does not snap back after a deliberate scroll also moves the browser bars", () => {
    input.focus();
    viewport.resize(360);
    vi.runAllTimers();
    document.dispatchEvent(new Event("touchmove"));
    fieldTop = -300;
    viewport.resize(420);
    vi.runAllTimers();
    expect(fieldTop).toBe(-300);
    input.blur();
    viewport.resize(844);
    vi.runAllTimers();
    expect(fieldTop).toBe(-300);
  });

  it("does not mistake browser bars or pinch zoom for a keyboard", () => {
    fieldTop = 120;
    input.focus();
    viewport.resize(784);
    vi.runAllTimers();
    expect(document.documentElement).not.toHaveClass("keyboard-open");
    viewport.scale = 2;
    viewport.resize(392);
    vi.runAllTimers();
    expect(document.documentElement).not.toHaveClass("keyboard-open");
  });

  it("rebases rotation when orientationchange arrives before the new dimensions", () => {
    fieldTop = 120;
    input.focus();
    window.dispatchEvent(new Event("orientationchange"));
    vi.stubGlobal("innerHeight", 390);
    viewport.resize(390);
    vi.runAllTimers();
    expect(document.documentElement).not.toHaveClass("keyboard-open");
    expectFieldVisible();
  });

  it("reveals the last quantity and Done inside the bounded contents scrollport", () => {
    fieldTop = 280;
    const list = document.createElement("ul");
    list.style.overflowY = "auto";
    list.getBoundingClientRect = () => new DOMRect(0, 40, 390, 300);
    Object.defineProperty(list, "clientHeight", { value: 300 });
    Object.defineProperty(list, "scrollHeight", { value: 600 });
    list.scrollTo = vi.fn((options: ScrollToOptions) => {
      fieldTop -= (options.top ?? 0) - list.scrollTop;
      list.scrollTop = options.top ?? 0;
    });
    const group = document.createElement("span");
    group.className = "numeric-input";
    group.getBoundingClientRect = () => new DOMRect(0, fieldTop, 156, 100);
    input.replaceWith(list);
    list.append(group);
    group.append(input);
    input.focus();
    viewport.resize(360);
    vi.runAllTimers();
    expect(group.getBoundingClientRect().bottom).toBeLessThanOrEqual(336);
    expect(window.scrollBy).not.toHaveBeenCalled();
  });

  it("leaves room to tap a match after focused search results arrive", () => {
    const search = document.createElement("div");
    search.className = "quick-search-field";
    input.replaceWith(search);
    search.append(input);
    const dock = document.createElement("aside");
    dock.className = "seller-value-dock";
    dock.getBoundingClientRect = () => new DOMRect(0, viewport.height - 124, 390, 124);
    document.body.append(dock);
    input.focus();
    viewport.resize(360);
    vi.runAllTimers();
    const match = document.createElement("button");
    match.textContent = "Play Booster Pack";
    match.getBoundingClientRect = () => new DOMRect(0, fieldTop + 49, 300, 80);
    search.after(match);
    expectFieldVisible();
    expect(match.getBoundingClientRect().bottom).toBeLessThanOrEqual(dock.getBoundingClientRect().top - 12);
  });

  it("follows renewed typing after the user scrolls away", () => {
    input.focus();
    viewport.resize(360);
    vi.runAllTimers();
    document.dispatchEvent(new Event("touchmove"));
    fieldTop = -300;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    vi.runAllTimers();
    expectFieldVisible();
  });

  it("uses window resizing when VisualViewport is unavailable", () => {
    cleanup();
    vi.stubGlobal("visualViewport", undefined);
    cleanup = installMobileInputViewport();
    input.focus();
    vi.stubGlobal("innerHeight", 360);
    viewport.height = 360;
    window.dispatchEvent(new Event("resize"));
    vi.runAllTimers();
    expectFieldVisible();
    expect(document.documentElement.style.getPropertyValue("--visual-viewport-height")).toBe("360px");
  });
});
