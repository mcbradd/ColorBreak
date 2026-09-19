import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BuyerWorkspace } from "./features/buyer/BuyerWorkspace";
import { decodeBuyerShare } from "./domain/share-url";
import { decodeLegacySearch } from "./domain/legacy";

const SHARED = "/ColorBreak/?b=MH2.collector-pack.1~EOE.play-pack.2&m=random&s=&r=WUBRGMCL&f=1&t=2#buyer";

// The workspace's data layer is not under test here; a link must carry the
// break whether or not the price snapshot answers.
beforeEach(() => { vi.stubGlobal("fetch", () => Promise.reject(new Error("offline"))); });

function mount() {
  return render(createElement(BuyerWorkspace, { exit: () => {}, startFresh: false, startReady: false }));
}

describe("a break travels in its own link", () => {
  it("keeps the break in the address bar so the visible URL is the shareable one", async () => {
    history.replaceState(null, "", SHARED);
    mount();

    // Historically the query was stripped on arrival, so the address bar a
    // recipient forwarded carried no break at all.
    await waitFor(() => expect(decodeLegacySearch(location.search)).toHaveLength(2));
    expect(decodeBuyerShare(location.search).assignmentMode).toBe("random");
    expect(location.hash).toBe("#buyer");
  });

  it("marks its own URL so a reload is not announced as someone else's break", async () => {
    history.replaceState(null, "", SHARED);
    mount();
    await waitFor(() => expect(history.state).toMatchObject({ colorbreakOwn: true }));

    expect(screen.getByLabelText("Shared calculation details")).toBeInTheDocument();

    // Reload: same URL, but this browser wrote it, so it is this buyer's own
    // working break rather than an incoming shared calculation.
    cleanup();
    mount();
    await waitFor(() => expect(screen.queryByLabelText("Shared calculation details")).not.toBeInTheDocument());
  });

  it("copies the public break link and shows the shared clipboard toast", async () => {
    history.replaceState(null, "", SHARED);
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    mount();

    await act(async () => { fireEvent.click(screen.getByLabelText("Copy break link")); });

    expect(share).not.toHaveBeenCalled();
    expect(decodeLegacySearch(new URL(writeText.mock.calls[0][0]).search)).toHaveLength(2);
    expect(screen.getByText("Break link copied to clipboard")).toHaveAttribute("role", "status");
    expect(screen.queryByLabelText("Break link")).not.toBeInTheDocument();
    Reflect.deleteProperty(navigator, "share");
  });

  it("keeps the address-bar link usable when clipboard access is refused", async () => {
    history.replaceState(null, "", SHARED);
    Reflect.deleteProperty(navigator, "share");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard refused")) },
    });
    mount();

    await act(async () => { fireEvent.click(screen.getByLabelText("Copy break link")); });

    expect(decodeLegacySearch(location.search)).toHaveLength(2);
    expect(screen.getByText("Couldn’t copy. Copy the link from your address bar.")).toHaveAttribute("role", "status");
    expect(screen.queryByLabelText("Break link")).not.toBeInTheDocument();
  });
});
