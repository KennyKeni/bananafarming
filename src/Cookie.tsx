import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import {
  totalClickPower,
  totalCps,
  type UpgradeKey,
} from "../convex/upgrades/config";
import { usePlayerId } from "./usePlayerId";
import farmImg from "./assets/banana-farm.webp";

type Popup = {
  id: number;
  x: number;
  y: number;
  label: string;
  color?: string;
};

const POPUP_LIFETIME_MS = 1000;
const PULSE_DURATION_MS = 180;

function randomRemoteColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 85%, 68%)`;
}

export function Cookie() {
  const playerId = usePlayerId();
  const counter = useQuery(api.counter.get);
  const upgrades = useQuery(api.upgrades.list);
  const increment = useMutation(api.counter.increment);
  const ensurePlayer = useMutation(api.players.ensure);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [pulsing, setPulsing] = useState(false);
  const nextIdRef = useRef(0);
  const prevCountRef = useRef<number | null>(null);
  const pendingOwnClicksRef = useRef(0);

  const count = counter?.count ?? 0;
  const ready = counter !== undefined;

  const ownedByKey: Partial<Record<UpgradeKey, number>> = {};
  if (upgrades) {
    for (const [key, row] of Object.entries(upgrades) as [
      UpgradeKey,
      { owned: number },
    ][]) {
      ownedByKey[key] = row.owned;
    }
  }
  const cps = totalCps(ownedByKey);
  const clickPower = totalClickPower(ownedByKey);

  useEffect(() => {
    if (!ready) return;
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (prev === null) return;
    const delta = count - prev;
    if (delta <= 0) return;
    if (cps > 0 && delta === cps) {
      spawnPopup(`+${cps}`, 0, -40);
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), PULSE_DURATION_MS);
      return () => clearTimeout(t);
    }
    if (clickPower > 0 && delta === clickPower) {
      if (pendingOwnClicksRef.current > 0) {
        pendingOwnClicksRef.current -= 1;
        return;
      }
      const angle = Math.random() * Math.PI * 2;
      const radius = 30 + Math.random() * 60;
      spawnPopup(
        `+${clickPower}`,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        randomRemoteColor(),
      );
    }
  }, [count, cps, clickPower, ready]);

  const spawnPopup = (label: string, x: number, y: number, color?: string) => {
    const id = nextIdRef.current++;
    setPopups((prev) => [...prev, { id, x, y, label, color }]);
    setTimeout(() => {
      setPopups((prev) => prev.filter((p) => p.id !== id));
    }, POPUP_LIFETIME_MS);
  };

  useEffect(() => {
    void ensurePlayer({ playerId });
  }, [ensurePlayer, playerId]);

  const handleClick = () => {
    pendingOwnClicksRef.current += 1;
    void increment({ playerId });
    const angle = Math.random() * Math.PI * 2;
    const radius = 30 + Math.random() * 60;
    spawnPopup(
      `+${clickPower}`,
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.repeat && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
    }
  };

  if (!ready) {
    return <div className="cookie-app">Loading...</div>;
  }

  return (
    <div className="cookie-app">
      <p className="count" data-testid="count">
        {count}
      </p>
      <p className="count-sub">grown by everyone</p>
      <div className="cookie-stage">
        <button
          type="button"
          className={`cookie${pulsing ? " cookie--pulse" : ""}`}
          aria-label="banana farm"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
        >
          <img src={farmImg} alt="" draggable={false} />
        </button>
        {popups.map((p) => (
          <span
            key={p.id}
            className="popup"
            style={
              {
                "--popup-x": `${p.x}px`,
                "--popup-y": `${p.y}px`,
                ...(p.color ? { color: p.color } : {}),
              } as React.CSSProperties
            }
            aria-hidden="true"
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}
