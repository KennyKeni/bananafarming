import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Cookie } from "./components/Cookie";
import { UpgradesPanel } from "./components/UpgradesPanel";
import { Leaderboard } from "./components/Leaderboard";
import { FallingBananas } from "./components/FallingBananas";
import { SlotMachine } from "./components/SlotMachine";
import { usePlayerId } from "./hooks/usePlayerId";
import "./App.css";

const HEARTBEAT_INTERVAL_MS = 15_000;

type SidePanel = "ranks" | "shop";

function App() {
  const playerId = usePlayerId();
  const me = useQuery(api.players.me, { playerId });
  const activeCount = useQuery(api.players.activeCount);
  const heartbeat = useMutation(api.players.heartbeat);
  const [expandedSide, setExpandedSide] = useState<SidePanel>("ranks");
  const [mobileOpen, setMobileOpen] = useState<SidePanel | null>(null);

  const needsName = me === null || (me && me.nameClaimedAt == null);
  const anyMobileOpen = mobileOpen !== null;

  useEffect(() => {
    void heartbeat({ playerId });
    const id = setInterval(() => {
      void heartbeat({ playerId });
    }, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [heartbeat, playerId]);

  return (
    <main className={`app${anyMobileOpen ? " app--drawer-open" : ""}`}>
      <FallingBananas />
      <div className="game-layout">
        <div className="main-column">
          <header className="app-header">
            <h1>Banana Farm</h1>
            <p className="subtitle">
              🍌 Shared farm
              {activeCount !== undefined && (
                <> · {activeCount} clicking now</>
              )}{" "}
              🍌
            </p>
          </header>
          <Cookie />
        </div>
        <div className="side-panels">
          <Leaderboard
            desktopExpanded={expandedSide === "ranks"}
            onDesktopToggle={() =>
              setExpandedSide((s) => (s === "shop" ? "ranks" : "shop"))
            }
            mobileOpen={mobileOpen === "ranks"}
            mobileAnyOpen={anyMobileOpen}
            onMobileToggle={() =>
              setMobileOpen((s) => (s === "ranks" ? null : "ranks"))
            }
          />
          <UpgradesPanel
            desktopExpanded={expandedSide === "shop"}
            onDesktopToggle={() =>
              setExpandedSide((s) => (s === "shop" ? "ranks" : "shop"))
            }
            mobileOpen={mobileOpen === "shop"}
            mobileAnyOpen={anyMobileOpen}
            onMobileToggle={() =>
              setMobileOpen((s) => (s === "shop" ? null : "shop"))
            }
          />
        </div>
      </div>
      {needsName && <SlotMachine playerId={playerId} onDone={() => {}} />}
    </main>
  );
}

export default App;
