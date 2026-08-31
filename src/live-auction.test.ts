import { createElement, Fragment, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BuyerView } from "./features/buyer/BuyerDetails";
import { SlotRail } from "./features/buyer/BuyerVisuals";
import { createAuction } from "./domain/auction";
import { calculateBreak } from "./domain/valuation";
import type { AuctionState } from "./domain/auction";
import type { BreakAnalysis } from "./data/evaluate";
import type { SlotId } from "./domain/types";

const valuation = calculateBreak({
  prices: [
    { id: "w", set: "TST", collectorNumber: "1", name: "White", slot: "W", nonfoil: 10, foil: null },
    { id: "u", set: "TST", collectorNumber: "2", name: "Blue", slot: "U", nonfoil: 20, foil: null },
  ],
  draws: [
    { set: "TST", collectorNumber: "1", copies: 1, foil: false, source: "fixed" },
    { set: "TST", collectorNumber: "2", copies: 1, foil: false, source: "fixed" },
  ],
  threshold: 2,
});

const analysis: BreakAnalysis = {
  valuation,
  outcomeModel: {
    complete: true,
    packs: [],
    fixed: [
      { id: "w", slot: "W", value: 10 },
      { id: "u", slot: "U", value: 20 },
    ],
  },
  outcomeOmissions: [],
};

function Harness() {
  const [auction, setAuction] = useState<AuctionState>(() => createAuction());
  const [selected, setSelected] = useState<SlotId>("W");
  const [assignmentMode, setAssignmentMode] = useState<"pick" | "random">("pick");
  const [bid, setBid] = useState<number>();
  const [shipping, setShipping] = useState<number>();
  return createElement(Fragment, null,
    createElement(SlotRail, { result: valuation, auction, setAuction, assignmentMode, setAssignmentMode, selected, setSelected, largeSpots: 120, setLargeSpots: () => undefined }),
    createElement(BuyerView, { analysis, auction, assignmentMode, selected, bid, setBid, shipping, setShipping }),
  );
}

describe("live random-slot buyer workflow", () => {
  it("changes availability through its dedicated editing control", async () => {
    render(createElement(Harness));
    fireEvent.click(screen.getByRole("button", { name: "Random remaining" }));
    expect(screen.getByText("8 colors remain in the random pool")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Live bid decision" })).toHaveTextContent("8 random colors");
    expect(screen.getByText("BID UP TO")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconfirm current bid" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Possible opening values")).toBeInTheDocument());
    expect(screen.queryByLabelText("Twenty equal-probability modeled outcome bands")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Current bid"), { target: { value: "12.50" } });
    fireEvent.blur(screen.getByLabelText("Current bid"));
    await waitFor(() => expect(screen.getByText(/Chance card value covers your \$12\.50 cost/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Edit availability" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark Blue taken" }));
    expect(screen.getByText("7 colors remain in the random pool")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Live bid decision" })).toHaveTextContent("7 random colors");
    expect(screen.getByRole("button", { name: "Blue slot" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Restore Blue slot" }));
    expect(screen.getByText("8 colors remain in the random pool")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("Possible opening values")).toBeInTheDocument());
  });

  it("switches every buyer view to the chosen color", async () => {
    render(createElement(Harness));
    await waitFor(() => expect(document.querySelectorAll(".balance-column")).toHaveLength(8));
    expect(screen.getByLabelText("Explain the Break Balance percentage")).toHaveTextContent("0%");
    fireEvent.click(screen.getByRole("button", { name: "Green slot" }));
    expect(screen.getByRole("button", { name: "Pick a color" })).toHaveClass("active");
    expect(screen.getByRole("region", { name: "Live bid decision" })).toHaveTextContent("Green slot");
    expect(screen.getByText("GREEN VALUE DETAILS")).toBeInTheDocument();
    expect(document.querySelectorAll(".balance-column")).toHaveLength(8);
  });

  it("updates the typical card value from the selected color distribution", async () => {
    render(createElement(Harness));
    await waitFor(() => expect(screen.getByLabelText("Typical card value")).toHaveTextContent("$10.00"));
    fireEvent.click(screen.getByRole("button", { name: "Blue slot" }));
    await waitFor(() => expect(screen.getByLabelText("Typical card value")).toHaveTextContent("$20.00"));
    const outcomeRange = within(screen.getByLabelText("Possible opening values"));
    expect(outcomeRange.getByText("Typical").parentElement).toHaveTextContent("$20.00");
    expect(screen.getByRole("region", { name: "Live bid decision" })).toHaveTextContent("Blue slot");
  });

  it("shows the bid verdict before the supporting break-value summary", () => {
    const { container } = render(createElement(Harness));
    const verdict = container.querySelector('[aria-label="Live bid decision"]')!;
    const supporting = container.querySelector(".bid-explorer")!;

    expect(verdict.compareDocumentPosition(supporting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // "Break evidence" is a real <details> disclosure now, not a bare section.
    expect(supporting.tagName).toBe("DETAILS");
  });
});


