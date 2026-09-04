import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { modeFromHash } from "./route-mode";

// BuyerWorkspace/SellerWorkspace pull in the full domain/data layer (price
// snapshots, simulation, persistence). Stub them down to just their `exit`
// callback so this test stays focused on App's routing, not on rendering a
// full workspace.
vi.mock("./features/buyer/BuyerWorkspace", () => ({
  BuyerWorkspace: ({ exit }: { exit: () => void }) =>
    createElement("button", { type: "button", onClick: exit }, "Exit buyer workspace"),
}));
vi.mock("./features/seller/SellerWorkspace", () => ({
  SellerWorkspace: ({ exit }: { exit: () => void }) =>
    createElement("button", { type: "button", onClick: exit }, "Exit seller workspace"),
}));

import { App } from "./App";

describe("App route persistence (methodology-page back-navigation regression)", () => {
  afterEach(() => {
    cleanup();
    history.replaceState(null, "", "/");
  });

  it("lands on the job chooser by default, so the seller job is discoverable", () => {
    render(createElement(App));
    expect(screen.getByRole("button", { name: /Buyer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seller/ })).toBeInTheDocument();
  });

  it("leaving the buyer workspace for the front page sets a real, round-trippable hash", async () => {
    history.replaceState(null, "", "/#buyer");
    render(createElement(App));
    fireEvent.click(screen.getByText("Exit buyer workspace"));

    // This is the exact bug: exiting to the front page must not just clear
    // the hash, because a hash-less URL is indistinguishable from a fresh
    // visit. A real navigation away and
    // back - methodology.html's link, browser back/forward, a full reload -
    // re-derives the mode from nothing but this URL.
    expect(location.hash).not.toBe("");
    expect(modeFromHash(location.hash)).toBe("home");

    // The front page itself must actually be showing, not just the URL.
    // (AnimatePresence's exit-before-enter transition mounts it a beat
    // later, hence the async find.)
    expect(await screen.findByText("App settings")).toBeInTheDocument();
  });

  it("leaving the seller workspace for the front page also sets the home hash", async () => {
    history.replaceState(null, "", "/#seller");
    render(createElement(App));
    fireEvent.click(screen.getByText("Exit seller workspace"));
    await screen.findByText("App settings");
    expect(modeFromHash(location.hash)).toBe("home");
  });

  it("a real navigation back to the home hash (simulated reload) restores the front page", () => {
    // Simulates what methodology.html's back link, or a browser back/forward
    // through a full page load, actually does: a fresh App mount reading
    // whatever hash is already in the URL.
    history.replaceState(null, "", "/#home");
    render(createElement(App));
    expect(screen.getByText("App settings")).toBeInTheDocument();
  });
});
