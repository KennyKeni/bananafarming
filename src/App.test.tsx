import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test, expect, vi, beforeEach } from "vitest";

const queryResults = new Map<unknown, unknown>();
const mockUseQuery = vi.fn<(name: unknown) => unknown>((name) =>
  queryResults.get(name),
);

vi.mock("convex/react", () => ({
  useQuery: (name: unknown) => mockUseQuery(name),
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
    players: {
      ensure: "players.ensure",
      claim: "players.claim",
      topLeaderboard: "players.topLeaderboard",
      me: "players.me",
      heartbeat: "players.heartbeat",
      activeCount: "players.activeCount",
    },
  },
}));

import App from "./App";

beforeEach(() => {
  queryResults.clear();
  queryResults.set("counter.get", { _id: "x", _creationTime: 0, count: 7 });
  queryResults.set("upgrades.list", {
    cursor: { owned: 0, cost: 10 },
    click: { owned: 0, cost: 5 },
    grandma: { owned: 0, cost: 100 },
    farm: { owned: 0, cost: 1000 },
    mine: { owned: 0, cost: 10000 },
  });
  queryResults.set("players.topLeaderboard", { top: [], you: null });
  queryResults.set("players.activeCount", 0);
  // Claimed player — slot machine hidden
  queryResults.set("players.me", {
    _id: "p1",
    _creationTime: 0,
    playerId: "test-player",
    name: "FestiveOtter22",
    clickBananas: 0,
    clickCount: 0,
    nameClaimedAt: 1,
  });
  window.localStorage.setItem("banana-farm:playerId", "test-player");
});

test("App renders the Cookie clicker with current count", () => {
  render(<App />);
  expect(screen.getByRole("button", { name: /banana/i })).toBeInTheDocument();
  expect(screen.getByTestId("count")).toHaveTextContent("7");
});

test("App subtitle advertises the shared farm and active player count", () => {
  queryResults.set("players.activeCount", 4);
  render(<App />);
  const subtitle = document.querySelector(".subtitle");
  expect(subtitle?.textContent).toMatch(/shared/i);
  expect(subtitle?.textContent).toMatch(/4/);
});

test("App subtitle omits the count while activeCount is loading", () => {
  queryResults.set("players.activeCount", undefined);
  render(<App />);
  const subtitle = document.querySelector(".subtitle");
  expect(subtitle?.textContent).toMatch(/shared/i);
  expect(subtitle?.textContent ?? "").not.toMatch(/\bNaN\b|undefined/i);
});

test("App renders the UpgradesPanel shop rows", () => {
  render(<App />);
  expect(screen.getByTestId("upgrade-row-cursor")).toBeInTheDocument();
  expect(screen.getByTestId("upgrade-row-grandma")).toBeInTheDocument();
  expect(screen.getByTestId("upgrade-row-farm")).toBeInTheDocument();
  expect(screen.getByTestId("upgrade-row-mine")).toBeInTheDocument();
});

test("App hides SlotMachine when nameClaimedAt is set", () => {
  render(<App />);
  expect(
    screen.queryByRole("dialog", { name: /pick your farmer name/i }),
  ).not.toBeInTheDocument();
});

test("App shows SlotMachine when me exists without nameClaimedAt", () => {
  queryResults.set("players.me", {
    _id: "p1",
    _creationTime: 0,
    playerId: "test-player",
    name: "FestiveOtter22",
    clickBananas: 0,
    clickCount: 0,
  });
  render(<App />);
  expect(
    screen.getByRole("dialog", { name: /pick your farmer name/i }),
  ).toBeInTheDocument();
});

test("App shows SlotMachine when me query returns null", () => {
  queryResults.set("players.me", null);
  render(<App />);
  expect(
    screen.getByRole("dialog", { name: /pick your farmer name/i }),
  ).toBeInTheDocument();
});

test("leaderboard is expanded and shop is collapsed by default", () => {
  render(<App />);
  const shop = document.getElementById("upgrades-panel");
  const ranks = document.getElementById("leaderboard-panel");
  expect(ranks?.className).not.toMatch(/\bpanel--collapsed\b/);
  expect(shop?.className).toMatch(/\bpanel--collapsed\b/);
});

test("clicking show-upgrades flips which panel is collapsed", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /show upgrades/i }));
  const shop = document.getElementById("upgrades-panel");
  const ranks = document.getElementById("leaderboard-panel");
  expect(shop?.className).not.toMatch(/\bpanel--collapsed\b/);
  expect(ranks?.className).toMatch(/\bpanel--collapsed\b/);
});

test("clicking the expanded panel collapses it and expands the other", async () => {
  const user = userEvent.setup();
  render(<App />);
  // default: ranks expanded; clicking its header should collapse it and expand shop
  await user.click(screen.getByRole("button", { name: /hide leaderboard/i }));
  const shop = document.getElementById("upgrades-panel");
  const ranks = document.getElementById("leaderboard-panel");
  expect(shop?.className).not.toMatch(/\bpanel--collapsed\b/);
  expect(ranks?.className).toMatch(/\bpanel--collapsed\b/);
});

function getPill(label: RegExp, toggleClass: string): HTMLElement | undefined {
  return screen
    .queryAllByRole("button", { name: label })
    .find((el) => el.classList.contains(toggleClass));
}

test("both mobile pills render by default", () => {
  render(<App />);
  expect(getPill(/^ranks$/i, "leaderboard-toggle")).toBeDefined();
  expect(getPill(/^shop$/i, "upgrades-toggle")).toBeDefined();
});

test("clicking ranks pill opens the leaderboard drawer", async () => {
  const user = userEvent.setup();
  render(<App />);
  const ranksPill = getPill(/^ranks$/i, "leaderboard-toggle")!;
  await user.click(ranksPill);
  const panel = document.getElementById("leaderboard-panel");
  expect(panel?.className).toMatch(/\bopen\b/);
});

test("opening ranks drawer hides both mobile pills", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(getPill(/^ranks$/i, "leaderboard-toggle")!);
  expect(getPill(/^ranks$/i, "leaderboard-toggle")).toBeUndefined();
  expect(getPill(/^shop$/i, "upgrades-toggle")).toBeUndefined();
});

test("opening shop drawer hides both mobile pills", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(getPill(/^shop$/i, "upgrades-toggle")!);
  expect(getPill(/^ranks$/i, "leaderboard-toggle")).toBeUndefined();
  expect(getPill(/^shop$/i, "upgrades-toggle")).toBeUndefined();
});

test("closing the drawer via X restores the pills", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(getPill(/^ranks$/i, "leaderboard-toggle")!);
  await user.click(screen.getByRole("button", { name: /close leaderboard/i }));
  expect(getPill(/^ranks$/i, "leaderboard-toggle")).toBeDefined();
  expect(getPill(/^shop$/i, "upgrades-toggle")).toBeDefined();
  const panel = document.getElementById("leaderboard-panel");
  expect(panel?.className).not.toMatch(/\bopen\b/);
});
