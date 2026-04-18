import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const queryResults = new Map<unknown, unknown>();
const mockUseQuery = vi.fn<(name: unknown) => unknown>((name) =>
  queryResults.get(name),
);
const mockIncrement = vi.fn();
const mockUseMutation = vi.fn<(name: unknown) => typeof mockIncrement>(
  () => mockIncrement,
);

vi.mock("convex/react", () => ({
  useQuery: (name: unknown) => mockUseQuery(name),
  useMutation: (name: unknown) => mockUseMutation(name),
}));

vi.mock("../convex/_generated/api", () => ({
  api: {
    counter: {
      get: "counter.get",
      increment: "counter.increment",
    },
    upgrades: {
      list: "upgrades.list",
    },
  },
}));

import { Cookie } from "./Cookie";

function setCounter(count: number | null) {
  queryResults.set(
    "counter.get",
    count === null ? null : { _id: "x", _creationTime: 0, count },
  );
}

function setUpgrades(owned: Partial<Record<string, number>>) {
  const list: Record<string, { owned: number; cost: number }> = {};
  for (const [key, count] of Object.entries(owned)) {
    list[key] = { owned: count ?? 0, cost: 0 };
  }
  queryResults.set("upgrades.list", list);
}

describe("Cookie", () => {
  beforeEach(() => {
    queryResults.clear();
    queryResults.set("upgrades.list", {});
    mockUseQuery.mockClear();
    mockIncrement.mockReset();
    mockUseMutation.mockClear();
    mockUseMutation.mockReturnValue(mockIncrement);
  });

  test("shows loading state while query is pending", () => {
    queryResults.set("counter.get", undefined);
    render(<Cookie />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test("displays 0 when no counter exists yet", () => {
    setCounter(null);
    render(<Cookie />);
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  test("displays the current count", () => {
    setCounter(123);
    render(<Cookie />);
    expect(screen.getByTestId("count")).toHaveTextContent("123");
  });

  test("calls increment mutation when cookie clicked", async () => {
    setCounter(5);
    const user = userEvent.setup();
    render(<Cookie />);
    await user.click(screen.getByRole("button", { name: /banana/i }));
    expect(mockIncrement).toHaveBeenCalledTimes(1);
  });

  test("does not show +1 popup on initial render", () => {
    setCounter(5);
    render(<Cookie />);
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });

  test("does not show +1 popup when count jumps by a non-cps amount", () => {
    setCounter(5);
    const { rerender } = render(<Cookie />);
    setCounter(55);
    rerender(<Cookie />);
    expect(screen.queryByText("+1")).not.toBeInTheDocument();
  });

  test("does not show popup when count decreases from a purchase", () => {
    setCounter(50);
    const { rerender } = render(<Cookie />);
    setCounter(40);
    rerender(<Cookie />);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  test("spawns a +1 popup when the user clicks the cookie", async () => {
    setCounter(5);
    const user = userEvent.setup();
    render(<Cookie />);
    await user.click(screen.getByRole("button", { name: /banana/i }));
    expect(screen.getAllByText("+1").length).toBe(1);
  });

  test("spawns a popup per click when the user clicks multiple times", async () => {
    setCounter(5);
    const user = userEvent.setup();
    render(<Cookie />);
    const btn = screen.getByRole("button", { name: /banana/i });
    await user.click(btn);
    await user.click(btn);
    await user.click(btn);
    expect(screen.getAllByText("+1").length).toBe(3);
  });

  test("shows +cps popup when count jumps by the owned cps amount", () => {
    setCounter(10);
    setUpgrades({ cursor: 2 });
    const { rerender } = render(<Cookie />);
    setCounter(12);
    rerender(<Cookie />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  test("shows +cps popup reflecting multi-generator total", () => {
    setCounter(100);
    setUpgrades({ cursor: 3, grandma: 1 });
    const { rerender } = render(<Cookie />);
    // cps = 3*1 + 1*5 = 8
    setCounter(108);
    rerender(<Cookie />);
    expect(screen.getByText("+8")).toBeInTheDocument();
  });

  test("click popup shows click power from owned click upgrades", async () => {
    setCounter(50);
    setUpgrades({ click: 2 });
    const user = userEvent.setup();
    render(<Cookie />);
    await user.click(screen.getByRole("button", { name: /banana/i }));
    // click power = 1 + 2 = 3
    expect(screen.getAllByText("+3").length).toBe(1);
  });

  test("does not show popup for unattributed jumps (batched catch-up)", () => {
    setCounter(10);
    setUpgrades({ cursor: 2 });
    // cps = 2, clickPower = 1. A jump of 15 matches neither.
    const { rerender } = render(<Cookie />);
    setCounter(25);
    rerender(<Cookie />);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  test("farm button gets pulse class when tick adds cps", () => {
    setCounter(10);
    setUpgrades({ cursor: 2 });
    const { rerender } = render(<Cookie />);
    setCounter(12);
    rerender(<Cookie />);
    const btn = screen.getByRole("button", { name: /banana/i });
    expect(btn.className).toMatch(/cookie--pulse/);
  });

  test("farm button does not get pulse class on initial render", () => {
    setCounter(10);
    setUpgrades({ cursor: 2 });
    render(<Cookie />);
    const btn = screen.getByRole("button", { name: /banana/i });
    expect(btn.className).not.toMatch(/cookie--pulse/);
  });

  test("shows popup when another user's click increases count by clickPower", () => {
    setCounter(5);
    setUpgrades({});
    const { rerender } = render(<Cookie />);
    setCounter(6);
    rerender(<Cookie />);
    expect(screen.getAllByText("+1").length).toBe(1);
  });

  test("remote click popup reflects shared click power from upgrades", () => {
    setCounter(10);
    setUpgrades({ click: 2 });
    const { rerender } = render(<Cookie />);
    // clickPower = 1 + 2 = 3
    setCounter(13);
    rerender(<Cookie />);
    expect(screen.getAllByText("+3").length).toBe(1);
  });

  test("own click does not double-pop when server confirms delta", async () => {
    setCounter(5);
    setUpgrades({});
    const user = userEvent.setup();
    const { rerender } = render(<Cookie />);
    await user.click(screen.getByRole("button", { name: /banana/i }));
    // server confirms our click: count bumps by clickPower (=1)
    setCounter(6);
    rerender(<Cookie />);
    expect(screen.getAllByText("+1").length).toBe(1);
  });
});
