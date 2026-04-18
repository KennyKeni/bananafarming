import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { usePlayerId } from "../hooks/usePlayerId";

const PANEL_ID = "leaderboard-panel";

type Props = {
  desktopExpanded?: boolean;
  onDesktopToggle?: () => void;
  mobileOpen?: boolean;
  mobileAnyOpen?: boolean;
  onMobileToggle?: () => void;
};

export function Leaderboard({
  desktopExpanded = true,
  onDesktopToggle,
  mobileOpen: mobileOpenProp,
  mobileAnyOpen,
  onMobileToggle,
}: Props = {}) {
  const playerId = usePlayerId();
  const data = useQuery(api.players.topLeaderboard, { playerId });
  const activeCount = useQuery(api.players.activeCount);
  const [internalOpen, setInternalOpen] = useState(false);
  const mobileOpen = mobileOpenProp ?? internalOpen;
  const toggleMobile = onMobileToggle ?? (() => setInternalOpen((v) => !v));
  const pillHidden = !!mobileAnyOpen;

  if (data === undefined) {
    return (
      <div
        className="leaderboard-panel"
        id={PANEL_ID}
        role="region"
        aria-label="Leaderboard"
      >
        Loading...
      </div>
    );
  }

  const { top, you } = data;
  const youInTop = you !== null && top.some((p) => p.playerId === playerId);

  return (
    <>
      {!pillHidden && (
        <button
          type="button"
          className="leaderboard-toggle"
          aria-expanded={mobileOpen}
          aria-controls={PANEL_ID}
          onClick={toggleMobile}
        >
          Ranks
        </button>
      )}
      <aside
        id={PANEL_ID}
        role="region"
        aria-label="Leaderboard"
        className={`leaderboard-panel ${mobileOpen ? "open" : ""} ${desktopExpanded ? "" : "panel--collapsed"}`}
      >
        <div className="panel-header">
          <h2 className="leaderboard-title">
            Top Bananas
            {activeCount !== undefined && (
              <span className="leaderboard-online">
                {" "}· {activeCount} online
              </span>
            )}
          </h2>
          <span className="panel-chevron" aria-hidden="true">
            ▾
          </span>
          <button
            type="button"
            className="panel-header-btn"
            aria-label={desktopExpanded ? "Hide leaderboard" : "Show leaderboard"}
            onClick={onDesktopToggle}
          />
          {mobileOpen && (
            <button
              type="button"
              className="panel-close"
              aria-label="Close leaderboard"
              onClick={toggleMobile}
            >
              ✕
            </button>
          )}
        </div>
        <div className="panel-body-wrap">
          <div className="panel-body">
            {you && (
              <p className="leaderboard-you-header">
                You are <strong>{you.name}</strong>
                {you.rank === null && (
                  <span className="leaderboard-unranked"> — not ranked</span>
                )}
              </p>
            )}
            <ol className="leaderboard-list">
              {top.map((row, i) => {
                const isYou = row.playerId === playerId;
                return (
                  <li
                    key={row.playerId}
                    data-testid={`leaderboard-row-${row.playerId}`}
                    className={`leaderboard-row${isYou ? " leaderboard-row--you" : ""}`}
                  >
                    <span className="leaderboard-rank">#{i + 1}</span>
                    <span className="leaderboard-name">{row.name}</span>
                    <span className="leaderboard-score">{row.clickBananas}</span>
                  </li>
                );
              })}
            </ol>
            {you && !youInTop && top.length > 0 && (
              <div className="leaderboard-you-row" data-testid="leaderboard-you">
                <span className="leaderboard-separator">…</span>
                <span className="leaderboard-rank">
                  {you.rank === null ? "—" : `#${you.rank}`}
                </span>
                <span className="leaderboard-name">{you.name}</span>
                <span className="leaderboard-score">{you.clickBananas}</span>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
