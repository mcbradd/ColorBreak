import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";

beforeEach(() => {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("data/products.json")) return Response.json({ sets: {
      EOE: { name: "Edge of Eternities", released: "2025-08-01", products: [{ key: "collector-pack", label: "Collector Booster Pack", packs: 1, unit: "pack", id: 1 }] },
      FIN: { name: "Final Fantasy", released: "2025-06-13", products: [{ key: "play-pack", label: "Play Booster Pack", packs: 1, unit: "pack", id: 2 }] },
    } });
    if (url.endsWith("data/sealed/index.json")) return Response.json({ documents: [] });
    return new Response(null, { status: 404 });
  });
});

it.each(["buyer", "seller"])("lets a %s add consecutive products with one selection each on the working screen", async (job) => {
  history.replaceState(null, "", `/#${job}`);
  render(createElement(App));
  const search = await screen.findByRole("combobox", { name: "Find a set or product" });
  fireEvent.input(search, { target: { value: "eoe collector" } });
  fireEvent.click(await screen.findByRole("option", { name: "Add Edge of Eternities (EOE) Collector Booster Pack" }));
  expect(search).toHaveValue("");
  expect(search).toHaveFocus();
  expect(screen.getByRole("textbox", { name: "EOE Collector Booster Pack quantity" })).toHaveValue("1");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("region", { name: job === "buyer" ? "Bid decision" : "Break value at a glance" })).toBeInTheDocument();
  fireEvent.input(search, { target: { value: "fin play" } });
  fireEvent.click(await screen.findByRole("option", { name: "Add Final Fantasy (FIN) Play Booster Pack" }));
  expect(screen.getByRole("textbox", { name: "FIN Play Booster Pack quantity" })).toHaveValue("1");
  expect(screen.getByRole("textbox", { name: "EOE Collector Booster Pack quantity" })).toHaveValue("1");
  await waitFor(() => expect(new URL(location.href).searchParams.get("b")).toContain("FIN"));
  expect(screen.queryByRole("button", { name: "Done", exact: true })).not.toBeInTheDocument();
  fireEvent.input(search, { target: { value: "collector" } });
  fireEvent.click(screen.getByRole("button", { name: job === "buyer" ? "Decision panel" : "Values panel" }));
  expect(screen.getByRole("button", { name: job === "buyer" ? "Decision panel" : "Values panel" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Break panel" }));
  expect(search).toHaveValue("collector");
  expect(screen.getByRole("textbox", { name: "EOE Collector Booster Pack quantity" })).toHaveValue("1");
  expect(screen.getByRole("complementary", { name: "Live decision" })).toBeInTheDocument();
});
