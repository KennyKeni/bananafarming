import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { UPGRADES } from "../convex/upgrades/config";

const PANEL_ID = "upgrades-panel";

export function UpgradesPanel() {
  const counter = useQuery(api.counter.get);
  const list = useQuery(api.upgrades.list);
  const buy = useMutation(api.upgrades.buy);
  const [open, setOpen] = useState(false);

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
      <button
        type="button"
        className="upgrades-toggle"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((v) => !v)}
      >
        Shop
      </button>
      <aside
        id={PANEL_ID}
        role="region"
        aria-label="Shop"
        className={`upgrades-panel ${open ? "open" : ""}`}
      >
        <h2 className="upgrades-title">Shop</h2>
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
                  <span className="upgrade-owned">owned: {entry.owned}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
