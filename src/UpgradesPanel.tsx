import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { UPGRADES } from "../convex/upgrades/config";

const PANEL_ID = "upgrades-panel";

type Props = {
  desktopExpanded?: boolean;
  onDesktopToggle?: () => void;
  mobileOpen?: boolean;
  mobileAnyOpen?: boolean;
  onMobileToggle?: () => void;
};

export function UpgradesPanel({
  desktopExpanded = true,
  onDesktopToggle,
  mobileOpen: mobileOpenProp,
  mobileAnyOpen,
  onMobileToggle,
}: Props = {}) {
  const counter = useQuery(api.counter.get);
  const list = useQuery(api.upgrades.list);
  const buy = useMutation(api.upgrades.buy);
  const [internalOpen, setInternalOpen] = useState(false);
  const mobileOpen = mobileOpenProp ?? internalOpen;
  const toggleMobile = onMobileToggle ?? (() => setInternalOpen((v) => !v));
  const pillHidden = !!mobileAnyOpen;

  if (counter === undefined || list === undefined) {
    return (
      <div className="upgrades-panel" id={PANEL_ID} role="region" aria-label="Shop">
        Loading...
      </div>
    );
  }
  const count = counter?.count ?? 0;

  return (
    <>
      {!pillHidden && (
        <button
          type="button"
          className="upgrades-toggle"
          aria-expanded={mobileOpen}
          aria-controls={PANEL_ID}
          onClick={toggleMobile}
        >
          Shop
        </button>
      )}
      <aside
        id={PANEL_ID}
        role="region"
        aria-label="Shop"
        className={`upgrades-panel ${mobileOpen ? "open" : ""} ${desktopExpanded ? "" : "panel--collapsed"}`}
      >
        <div className="panel-header">
          <h2 className="upgrades-title">Shop</h2>
          <span className="panel-chevron" aria-hidden="true">
            ▾
          </span>
          <button
            type="button"
            className="panel-header-btn"
            aria-label={desktopExpanded ? "Hide upgrades" : "Show upgrades"}
            onClick={onDesktopToggle}
          />
          {mobileOpen && (
            <button
              type="button"
              className="panel-close"
              aria-label="Close shop"
              onClick={toggleMobile}
            >
              ✕
            </button>
          )}
        </div>
        <div className="panel-body-wrap">
          <div className="panel-body">
            <ul className="upgrade-list">
              {UPGRADES.map((u) => {
                const entry = list[u.key] ?? { owned: 0, cost: u.baseCost };
                const disabled = count < entry.cost;
                return (
                  <li key={u.key}>
                    <button
                      type="button"
                      className="upgrade-row"
                      data-testid={`upgrade-row-${u.key}`}
                      disabled={disabled}
                      onClick={() => {
                        void buy({ key: u.key });
                      }}
                    >
                      <span className="upgrade-emoji" aria-hidden="true">
                        {u.emoji}
                      </span>
                      <span className="upgrade-info">
                        <span className="upgrade-name">{u.name}</span>
                        <span className="upgrade-meta">
                          <span className="upgrade-cost">{entry.cost}</span>
                          <span className="upgrade-cps">
                            {u.clickPower > 0
                              ? `+${u.clickPower}/click`
                              : `${u.cps}/s`}
                          </span>
                        </span>
                      </span>
                      <span className="upgrade-owned">
                        owned: {entry.owned}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </aside>
    </>
  );
}
