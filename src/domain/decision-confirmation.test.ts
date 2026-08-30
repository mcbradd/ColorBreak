import { createElement } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDecisionConfirmation } from "./decision-confirmation";

function ConfirmationProbe({ fingerprint = "one" }: { fingerprint?: string }) {
  const { confirmation, reconfirm } = useDecisionConfirmation(fingerprint);
  return createElement("div", undefined,
    createElement("button", { onClick: reconfirm }, "Reconfirm"),
    createElement("output", undefined, confirmation ? "confirmed" : "needs reconfirmation"),
  );
}

describe("useDecisionConfirmation", () => {
  afterEach(() => vi.useRealTimers());

  it("expires without another user interaction", () => {
    vi.useFakeTimers();
    render(createElement(ConfirmationProbe));
    fireEvent.click(screen.getByRole("button", { name: "Reconfirm" }));
    expect(screen.getByText("confirmed")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("needs reconfirmation")).toBeInTheDocument();
  });
});
