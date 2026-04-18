import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const mockClaim = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockUseMutation = vi.fn<(name: unknown) => unknown>((name) => {
  if (name === "players.claim") return mockClaim;
  return () => undefined;
});

vi.mock("convex/react", () => ({
  useMutation: (name: unknown) => mockUseMutation(name),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    players: { claim: "players.claim" },
  },
}));

import { SlotMachine } from "./SlotMachine";

describe("SlotMachine", () => {
  beforeEach(() => {
    mockClaim.mockReset();
    mockClaim.mockResolvedValue({ name: "FestiveOtter22" });
    window.localStorage.setItem("banana-farm:playerId", "test-player");
  });

  test("renders three reels + spin + confirm buttons", () => {
    render(<SlotMachine playerId="test-player" onDone={() => {}} />);
    expect(screen.getByTestId("reel-adj")).toBeInTheDocument();
    expect(screen.getByTestId("reel-ani")).toBeInTheDocument();
    expect(screen.getByTestId("reel-num")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /spin/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /lock|confirm/i })).toBeInTheDocument();
  });

  test("spin changes the displayed name", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SlotMachine playerId="test-player" onDone={() => {}} />);
    const before = screen.getByTestId("slot-name").textContent;
    await user.click(screen.getByRole("button", { name: /spin/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1700);
    });
    let after = screen.getByTestId("slot-name").textContent;
    for (let i = 0; i < 5 && after === before; i++) {
      await user.click(screen.getByRole("button", { name: /spin/i }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1700);
      });
      after = screen.getByTestId("slot-name").textContent;
    }
    expect(after).not.toBe(before);
    vi.useRealTimers();
  });

  test("lock-in calls claim with the displayed name + playerId", async () => {
    const user = userEvent.setup();
    render(<SlotMachine playerId="test-player" onDone={() => {}} />);
    const shown = screen.getByTestId("slot-name").textContent;
    await user.click(screen.getByRole("button", { name: /lock|confirm/i }));
    expect(mockClaim).toHaveBeenCalledTimes(1);
    expect(mockClaim).toHaveBeenCalledWith({
      playerId: "test-player",
      name: shown,
    });
  });

  test("calls onDone after successful claim", async () => {
    const onDone = vi.fn();
    const user = userEvent.setup();
    render(<SlotMachine playerId="test-player" onDone={onDone} />);
    await user.click(screen.getByRole("button", { name: /lock|confirm/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  test("spin button is disabled while spinning", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SlotMachine playerId="test-player" onDone={() => {}} />);
    const spinBtn = screen.getByRole("button", { name: /spin/i });
    await user.click(spinBtn);
    expect(spinBtn).toBeDisabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1700);
    });
    expect(spinBtn).not.toBeDisabled();
    vi.useRealTimers();
  });
});
