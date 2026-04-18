import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const queryResults = new Map<unknown, unknown>();
const mockUseQuery = vi.fn<(name: unknown) => unknown>((name) =>
  queryResults.get(name),
);

vi.mock("convex/react", () => ({
  useQuery: (name: unknown) => mockUseQuery(name),
}));

vi.mock("../convex/_generated/api", () => ({
  api: {
    upgrades: { list: "upgrades.list" },
  },
}));

import { FallingBananas } from "./FallingBananas";

function setUpgrades(owned: Partial<Record<string, number>>) {
  const list: Record<string, { owned: number; cost: number }> = {};
  for (const [key, count] of Object.entries(owned)) {
    list[key] = { owned: count ?? 0, cost: 0 };
  }
  queryResults.set("upgrades.list", list);
}

describe("FallingBananas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    queryResults.clear();
    mockUseQuery.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("does not spawn bananas when cps is zero", () => {
    setUpgrades({});
    render(<FallingBananas />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryAllByTestId("falling-banana").length).toBe(0);
  });

  test("spawns at least one banana when cps is positive", () => {
    setUpgrades({ cursor: 4 });
    render(<FallingBananas />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryAllByTestId("falling-banana").length).toBeGreaterThan(0);
  });

  test("caps concurrent bananas at MAX_BANANAS", () => {
    setUpgrades({ mine: 1000 });
    render(<FallingBananas />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.queryAllByTestId("falling-banana").length).toBeLessThanOrEqual(25);
  });

  test("renders inside a fixed background layer", () => {
    setUpgrades({ cursor: 1 });
    const { container } = render(<FallingBananas />);
    const layer = container.querySelector(".falling-bananas");
    expect(layer).not.toBeNull();
    expect(layer).toHaveAttribute("aria-hidden", "true");
  });
});
