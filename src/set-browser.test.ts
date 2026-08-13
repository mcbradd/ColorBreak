import { createElement } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "./App";

const sets = Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
  const number = index + 1;
  const code = `S${String(number).padStart(2, "0")}`;
  return [code, {
    name: number === 1 ? "Oldest Alpha" : `Set ${number}`,
    released: `2025-${String(number).padStart(2, "0")}-01`,
    groupId: number,
    products: [],
  }];
}));

describe("Add Product set browser", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("products.json")) {
        return new Response(JSON.stringify({ sets }), { status: 200 });
      }
      if (url.includes("sealed/index.json")) {
        return new Response(JSON.stringify({ documents: [] }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the full set catalog instead of only the latest eight sets", async () => {
    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: /Add a product/i }));

    expect(await screen.findByRole("button", { name: /Oldest Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Set 12/ })).toBeInTheDocument();
  });

  it("sorts the catalog by release date or alphabetically from quick tabs", async () => {
    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: /Add a product/i }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    const setButtons = () => within(dialog).getAllByRole("button", { name: /Oldest Alpha|Set \d+/ });

    expect(setButtons()[0]).toHaveAccessibleName(/Set 12/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Alphabetical" }));
    expect(setButtons()[0]).toHaveAccessibleName(/Oldest Alpha/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Release date" }));
    expect(setButtons()[0]).toHaveAccessibleName(/Set 12/);
  });

  it("filters immediately by either set code or set name", async () => {
    render(createElement(Workspace, { mode: "buyer", exit: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: /Add a product/i }));
    const dialog = await screen.findByRole("dialog", { name: "Add product" });
    const search = within(dialog).getByRole("textbox", { name: "Search sets by name or code" });

    fireEvent.change(search, { target: { value: " s01 " } });
    expect(within(dialog).getByRole("button", { name: /Oldest Alpha/ })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Set 12/ })).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "oldest alpha" } });
    expect(within(dialog).getByRole("button", { name: /Oldest Alpha/ })).toBeInTheDocument();
  });
});
