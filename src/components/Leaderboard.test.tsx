import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi, beforeEach } from "vitest";

const mockUseQuery = vi.fn<(name: unknown) => unknown>();

vi.mock("convex/react", () => ({
  useQuery: (name: unknown) => mockUseQuery(name),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    players: {
      topLeaderboard: "players.topLeaderboard",
      activeCount: "players.activeCount",
    },
  },
}));

import { Leaderboard } from "./Leaderboard";

type Row = { playerId: string; name: string; clickBananas: number; clickCount: number };
function setLeaderboard(
  top: Row[],
  you: { rank: number | null; name: string; clickBananas: number; clickCount: number } | null,
  activeCount?: number,
) {
  mockUseQuery.mockImplementation((name) => {
    if (name === "players.topLeaderboard") return { top, you };
    if (name === "players.activeCount") return activeCount ?? 0;
    return undefined;
  });
}

describe("Leaderboard", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    window.localStorage.setItem("banana-farm:playerId", "me");
  });

  test("shows loading while query is pending", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(<Leaderboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test("renders the top rows with rank, name, and bananas", () => {
    setLeaderboard(
      [
        { playerId: "a", name: "FestiveFlamingo11", clickBananas: 500, clickCount: 50 },
        { playerId: "b", name: "SleepyOtter22", clickBananas: 300, clickCount: 30 },
      ],
      null,
    );
    render(<Leaderboard />);
    expect(screen.getByText("FestiveFlamingo11")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByText("SleepyOtter22")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
  });

  test("highlights your row when in top 10", () => {
    setLeaderboard(
      [
        { playerId: "me", name: "MyName01", clickBananas: 100, clickCount: 10 },
        { playerId: "b", name: "SleepyOtter22", clickBananas: 50, clickCount: 5 },
      ],
      { rank: 1, name: "MyName01", clickBananas: 100, clickCount: 10 },
    );
    render(<Leaderboard />);
    const myRow = screen.getByTestId("leaderboard-row-me");
    expect(myRow.className).toMatch(/\bleaderboard-row--you\b/);
  });

  test("shows 'You are <name>' header", () => {
    setLeaderboard(
      [],
      { rank: null, name: "FestiveFlamingo11", clickBananas: 0, clickCount: 0 },
    );
    render(<Leaderboard />);
    expect(screen.getByText(/you are/i)).toBeInTheDocument();
    expect(screen.getByText("FestiveFlamingo11")).toBeInTheDocument();
  });

  test("shows your row below the top when outside top 10", () => {
    const top: Row[] = Array.from({ length: 10 }, (_, i) => ({
      playerId: `top-${i}`,
      name: `Top${i}`,
      clickBananas: 1000 - i,
      clickCount: 100,
    }));
    setLeaderboard(top, {
      rank: 42,
      name: "FestiveFlamingo11",
      clickBananas: 50,
      clickCount: 5,
    });
    render(<Leaderboard />);
    const youRow = screen.getByTestId("leaderboard-you");
    expect(youRow).toBeInTheDocument();
    expect(youRow.textContent).toContain("42");
    expect(youRow.textContent).toContain("FestiveFlamingo11");
  });

  test("shows 'not ranked' when rank is null", () => {
    setLeaderboard(
      [],
      { rank: null, name: "FestiveFlamingo11", clickBananas: 0, clickCount: 0 },
    );
    render(<Leaderboard />);
    expect(screen.getByText(/not ranked/i)).toBeInTheDocument();
  });

  test("toggle button is present with aria-expanded=false by default", () => {
    setLeaderboard([], null);
    render(<Leaderboard />);
    const toggle = screen.getByRole("button", { name: /ranks/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "leaderboard-panel");
  });

  test("clicking toggle flips aria-expanded and adds open class", async () => {
    setLeaderboard([], null);
    const user = userEvent.setup();
    render(<Leaderboard />);
    const toggle = screen.getByRole("button", { name: /ranks/i });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById("leaderboard-panel");
    expect(panel?.className).toMatch(/\bopen\b/);
  });

  test("panel has role=region and matching id for aria-controls", () => {
    setLeaderboard([], null);
    render(<Leaderboard />);
    const panel = document.getElementById("leaderboard-panel");
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveAttribute("role", "region");
  });

  test("renders online count inline with the title", () => {
    setLeaderboard([], null, 3);
    render(<Leaderboard />);
    const title = screen.getByRole("heading", { name: /top bananas/i });
    expect(title.textContent).toMatch(/3\s*online/i);
  });

  test("online count shows zero cleanly", () => {
    setLeaderboard([], null, 0);
    render(<Leaderboard />);
    const title = screen.getByRole("heading", { name: /top bananas/i });
    expect(title.textContent).toMatch(/0\s*online/i);
  });

  test("online count is omitted while activeCount is loading", () => {
    mockUseQuery.mockImplementation((name) => {
      if (name === "players.topLeaderboard") return { top: [], you: null };
      if (name === "players.activeCount") return undefined;
      return undefined;
    });
    render(<Leaderboard />);
    const title = screen.getByRole("heading", { name: /top bananas/i });
    expect(title.textContent ?? "").not.toMatch(/online/i);
  });

  test("mobileOpen prop drives the open class on the panel", () => {
    setLeaderboard([], null);
    render(<Leaderboard mobileOpen={true} />);
    const panel = document.getElementById("leaderboard-panel");
    expect(panel?.className).toMatch(/\bopen\b/);
  });

  test("renders an X close button when mobileOpen is true", () => {
    setLeaderboard([], null);
    render(<Leaderboard mobileOpen={true} />);
    expect(
      screen.getByRole("button", { name: /close leaderboard/i }),
    ).toBeInTheDocument();
  });

  test("does not render X close button when mobileOpen is false", () => {
    setLeaderboard([], null);
    render(<Leaderboard mobileOpen={false} />);
    expect(
      screen.queryByRole("button", { name: /close leaderboard/i }),
    ).not.toBeInTheDocument();
  });

  test("clicking the X close button calls onMobileToggle", async () => {
    setLeaderboard([], null);
    const onMobileToggle = vi.fn();
    const user = userEvent.setup();
    render(
      <Leaderboard mobileOpen={true} onMobileToggle={onMobileToggle} />,
    );
    await user.click(screen.getByRole("button", { name: /close leaderboard/i }));
    expect(onMobileToggle).toHaveBeenCalledTimes(1);
  });

  test("does not render the Ranks pill when mobileAnyOpen is true", () => {
    setLeaderboard([], null);
    render(<Leaderboard mobileAnyOpen={true} />);
    const pill = screen
      .queryAllByRole("button", { name: /^ranks$/i })
      .find((el) => el.classList.contains("leaderboard-toggle"));
    expect(pill).toBeUndefined();
  });

  test("clicking the Ranks pill calls onMobileToggle when controlled", async () => {
    setLeaderboard([], null);
    const onMobileToggle = vi.fn();
    const user = userEvent.setup();
    render(<Leaderboard onMobileToggle={onMobileToggle} />);
    await user.click(screen.getByRole("button", { name: /^ranks$/i }));
    expect(onMobileToggle).toHaveBeenCalledTimes(1);
  });
});
