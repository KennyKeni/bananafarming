import { render, screen } from "@testing-library/react";
import { test, expect, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: (name: unknown) => {
    if (name === "upgrades.list") {
      return {
        cursor: { owned: 0, cost: 10 },
        click: { owned: 0, cost: 5 },
        grandma: { owned: 0, cost: 100 },
        farm: { owned: 0, cost: 1000 },
        mine: { owned: 0, cost: 10000 },
      };
    }
    return { _id: "x", _creationTime: 0, count: 7 };
  },
  useMutation: () => vi.fn(),
}));

vi.mock("../convex/_generated/api", () => ({
  api: {
    counter: {
      get: "counter.get",
      increment: "counter.increment",
    },
    upgrades: {
      list: "upgrades.list",
      buy: "upgrades.buy",
    },
  },
}));

import App from "./App";

test("App renders the Cookie clicker with current count", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: /banana/i })).toBeInTheDocument();
  expect(screen.getByTestId("count")).toHaveTextContent("7");
});

test("App renders the UpgradesPanel shop rows", () => {
  render(<App />);
  expect(screen.getByTestId("upgrade-row-cursor")).toBeInTheDocument();
  expect(screen.getByTestId("upgrade-row-grandma")).toBeInTheDocument();
  expect(screen.getByTestId("upgrade-row-farm")).toBeInTheDocument();
  expect(screen.getByTestId("upgrade-row-mine")).toBeInTheDocument();
});
