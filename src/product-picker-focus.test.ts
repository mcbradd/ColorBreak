import { createElement, useState } from "react";
import type { MouseEvent } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Builder } from "./features/shared/ProductBuilder";

function Harness({ label }: { label: string }) {
  const [open, setOpen] = useState(false);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  return createElement("div", null,
    createElement("button", { onClick: (event: MouseEvent<HTMLButtonElement>) => { setOpener(event.currentTarget); setOpen(true); } }, label),
    createElement("main", { "data-focus-fallback": true, tabIndex: -1 }, "workspace"),
    createElement(Builder, { open, invokingElement: opener, onClose: () => setOpen(false), lines: [], onApply: vi.fn() }),
  );
}

describe("shared product picker focus ownership", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ sets: {}, documents: [] }) })));
  });
  it.each(["Buyer Add products", "Seller Add products"])("returns Escape focus to %s", async (label) => {
    render(createElement(Harness, { label }));
    const opener = screen.getByRole("button", { name: label });
    fireEvent.click(opener);
    const search = await screen.findByLabelText("Search sets by name or code");
    search.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

