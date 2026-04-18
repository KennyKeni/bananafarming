import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { totalCps, type UpgradeKey } from "../convex/upgrades/config";
import yellowImg from "./assets/bananas-yellow.webp";
import greenImg from "./assets/bananas-green.webp";

type Banana = {
  id: number;
  left: number;
  duration: number;
  img: string;
  spin: number;
  drift: number;
};

const MAX_BANANAS = 25;
const MIN_PERIOD_MS = 200;
const MAX_PERIOD_MS = 2000;
const IMAGES = [yellowImg, greenImg];

function spawnPeriod(cps: number): number {
  const raw = 2000 / Math.sqrt(cps);
  return Math.min(MAX_PERIOD_MS, Math.max(MIN_PERIOD_MS, raw));
}

export function FallingBananas() {
  const upgrades = useQuery(api.upgrades.list);
  const [bananas, setBananas] = useState<Banana[]>([]);
  const nextIdRef = useRef(0);

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

  useEffect(() => {
    if (cps <= 0) return;
    const period = spawnPeriod(cps);
    const interval = setInterval(() => {
      setBananas((prev) => {
        if (prev.length >= MAX_BANANAS) return prev;
        const id = nextIdRef.current++;
        const duration = 4000 + Math.random() * 3000;
        const banana: Banana = {
          id,
          left: Math.random() * 100,
          duration,
          img: IMAGES[Math.floor(Math.random() * IMAGES.length)],
          spin: Math.floor(Math.random() * 360),
          drift: (Math.random() - 0.5) * 80,
        };
        return [...prev, banana];
      });
    }, period);
    return () => clearInterval(interval);
  }, [cps]);

  const removeBanana = (id: number) => {
    setBananas((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="falling-bananas" aria-hidden="true">
      {bananas.map((b) => (
        <img
          key={b.id}
          data-testid="falling-banana"
          className="falling-banana"
          src={b.img}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onAnimationEnd={() => removeBanana(b.id)}
          style={
            {
              left: `${b.left}vw`,
              animationDuration: `${b.duration}ms`,
              "--spin-start": `${b.spin}deg`,
              "--drift": `${b.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
