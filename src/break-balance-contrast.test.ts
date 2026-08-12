// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

function rgb(color: string): [number, number, number] {
  const channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${color}`);
  return channels as [number, number, number];
}

function luminance(color: string) {
  const channels = rgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Break Balance contrast", () => {
  it("keeps value labels and the caption legible when a bar has zero height", () => {
    document.head.innerHTML = `<style>${stylesheet}</style>`;
    document.body.innerHTML = `
      <section class="panel balance-panel">
        <div class="balance-chart">
          <div class="balance-column">
            <div class="balance-bar" style="height: 0"></div>
            <b>W</b>
            <small>$0.00</small>
          </div>
        </div>
        <p class="balance-caption">Dashed line: equal share $0.63</p>
      </section>
    `;

    const label = document.querySelector<HTMLElement>(".balance-column > small")!;
    const caption = document.querySelector<HTMLElement>(".balance-caption")!;
    const labelStyle = getComputedStyle(label);
    const captionStyle = getComputedStyle(caption);

    expect(contrast(labelStyle.color, labelStyle.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(captionStyle.color, "rgb(18, 21, 29)")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps dynamic informational-pill text visible", () => {
    document.head.innerHTML = `<style>${stylesheet}</style>`;
    document.body.innerHTML = `
      <span class="tip tip-indicator status verified">
        <span>verified</span>
      </span>
    `;

    const label = document.querySelector<HTMLElement>(".tip-indicator > span")!;
    expect(getComputedStyle(label).display).not.toBe("none");
  });
});
