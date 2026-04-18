import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const mockUseQuery = vi.fn<(name: unknown) => unknown>();
const mockBuy = vi.fn();
const mockUseMutation = vi.fn<(name: unknown) => typeof mockBuy>(() => mockBuy);

vi.mock("convex/react", () => ({
  useQuery: (name: unknown) => mockUseQuery(name),
  useMutation: (name: unknown) => mockUseMutation(name),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    counter: { get: "counter.get", increment: "counter.increment" },
    upgrades: { list: "upgrades.list", buy: "upgrades.buy" },
  },
}));

import { UpgradesPanel } from "./UpgradesPanel";

function mockQueries(opts: {
  count?: number;
  list?: Record<string, { owned: number; cost: number }>;
}) {
  mockUseQuery.mockImplementation((name) => {
    if (name === "counter.get") {
      return { _id: "x", _creationTime: 0, count: opts.count ?? 0 };
    }
    if (name === "upgrades.list") {
      return (
        opts.list ?? {
          cursor: { owned: 0, cost: 10 },
          click: { owned: 0, cost: 5 },
          grandma: { owned: 0, cost: 100 },
          farm: { owned: 0, cost: 1000 },
          mine: { owned: 0, cost: 10000 },
        }
      );
    }
    return undefined;
  });
}

describe("UpgradesPanel", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockBuy.mockReset();
    mockUseMutation.mockClear();
    mockUseMutation.mockReturnValue(mockBuy);
  });

  test("renders a row for each configured upgrade", () => {
    mockQueries({ count: 0 });
    render(<UpgradesPanel />);
    expect(screen.getByText(/cursor/i)).toBeInTheDocument();
    expect(screen.getByTestId("upgrade-row-click")).toBeInTheDocument();
    expect(screen.getByText(/grandma/i)).toBeInTheDocument();
    expect(screen.getByText(/farm/i)).toBeInTheDocument();
    expect(screen.getByText(/mine/i)).toBeInTheDocument();
  });

  test("click upgrade row shows click power not cps", () => {
    mockQueries({ count: 0 });
    render(<UpgradesPanel />);
    const clickRow = screen.getByTestId("upgrade-row-click");
    expect(within(clickRow).getByText(/\+1\/click/)).toBeInTheDocument();
  });

  test("each row shows cost and cps", () => {
    mockQueries({ count: 0 });
    render(<UpgradesPanel />);
    const cursorRow = screen.getByTestId("upgrade-row-cursor");
    expect(within(cursorRow).getByText(/10/)).toBeInTheDocument();
    expect(within(cursorRow).getByText(/1\/s/)).toBeInTheDocument();
  });

  test("each row shows owned count", () => {
    mockQueries({
      count: 1000,
      list: {
        cursor: { owned: 3, cost: 15 },
        grandma: { owned: 0, cost: 100 },
        farm: { owned: 0, cost: 1000 },
        mine: { owned: 0, cost: 10000 },
      },
    });
    render(<UpgradesPanel />);
    const cursorRow = screen.getByTestId("upgrade-row-cursor");
    expect(within(cursorRow).getByText(/owned:\s*3/i)).toBeInTheDocument();
  });

  test("clicking an affordable row calls buy with its key", async () => {
    mockQueries({ count: 1000 });
    const user = userEvent.setup();
    render(<UpgradesPanel />);
    await user.click(screen.getByTestId("upgrade-row-cursor"));
    expect(mockBuy).toHaveBeenCalledTimes(1);
    expect(mockBuy).toHaveBeenCalledWith({ key: "cursor" });
  });

  test("rows whose cost exceeds current count are disabled", () => {
    mockQueries({ count: 50 });
    render(<UpgradesPanel />);
    expect(screen.getByTestId("upgrade-row-cursor")).toBeEnabled();
    expect(screen.getByTestId("upgrade-row-grandma")).toBeDisabled();
    expect(screen.getByTestId("upgrade-row-farm")).toBeDisabled();
    expect(screen.getByTestId("upgrade-row-mine")).toBeDisabled();
  });

  test("clicking a disabled row does not call buy", async () => {
    mockQueries({ count: 50 });
    const user = userEvent.setup();
    render(<UpgradesPanel />);
    await user.click(screen.getByTestId("upgrade-row-grandma"));
    expect(mockBuy).not.toHaveBeenCalled();
  });

  test("shows loading state while queries are pending", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<UpgradesPanel />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test("toggle button is present with aria-expanded=false by default", () => {
    mockQueries({ count: 0 });
    render(<UpgradesPanel />);
    const toggle = screen.getByRole("button", { name: /shop/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "upgrades-panel");
  });

  test("clicking toggle flips aria-expanded and adds open class to panel", async () => {
    mockQueries({ count: 0 });
    const user = userEvent.setup();
    render(<UpgradesPanel />);
    const toggle = screen.getByRole("button", { name: /shop/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById("upgrades-panel");
    expect(panel?.className).toMatch(/\bopen\b/);
  });

  test("panel has role=region and matching id for aria-controls", () => {
    mockQueries({ count: 0 });
    render(<UpgradesPanel />);
    const panel = document.getElementById("upgrades-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("role", "region");
  });

  test("mobileOpen prop drives the open class on the panel", () => {
    mockQueries({ count: 0 });
    render(<UpgradesPanel mobileOpen={true} />);
    const panel = document.getElementById("upgrades-panel");
    expect(panel?.className).toMatch(/\bopen\b/);
  });

  test("renders an X close button when mobileOpen is true", () => {
    mockQueries({ count: 0 });
    render(<UpgradesPanel mobileOpen={true} />);
    expect(
      screen.getByRole("button", { name: /close shop/i }),
    ).toBeInTheDocument();
  });

  test("does not render X close button when mobileOpen is false", () => {
    mockQueries({ count: 0 });
    render(<UpgradesPanel mobileOpen={false} />);
    expect(
      screen.queryByRole("button", { name: /close shop/i }),
    ).not.toBeInTheDocument();
  });

  test("clicking the X close button calls onMobileToggle", async () => {
    mockQueries({ count: 0 });
    const onMobileToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <UpgradesPanel mobileOpen={true} onMobileToggle={onMobileToggle} />,
    );
    await user.click(screen.getByRole("button", { name: /close shop/i }));
    expect(onMobileToggle).toHaveBeenCalledTimes(1);
  });

  test("does not render the Shop pill when mobileAnyOpen is true", () => {
    mockQueries({ count: 0 });
    render(<UpgradesPanel mobileAnyOpen={true} />);
    const pill = screen
      .queryAllByRole("button", { name: /^shop$/i })
      .find((el) => el.classList.contains("upgrades-toggle"));
    expect(pill).toBeUndefined();
  });

  test("clicking the Shop pill calls onMobileToggle when controlled", async () => {
    mockQueries({ count: 0 });
    const onMobileToggle = vi.fn();
    const user = userEvent.setup();
    render(<UpgradesPanel onMobileToggle={onMobileToggle} />);
    await user.click(screen.getByRole("button", { name: /^shop$/i }));
    expect(onMobileToggle).toHaveBeenCalledTimes(1);
  });
});
