import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { ADJECTIVES, ANIMALS } from "../convex/players/names";

const SUFFIXES = Array.from({ length: 90 }, (_, i) =>
  (i + 10).toString().padStart(2, "0"),
);

const REEL_LENGTH = 28;
const REEL_DURATIONS_MS = [1000, 1250, 1500];
const LONGEST_SPIN_MS = Math.max(...REEL_DURATIONS_MS);

function pick<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildStrip<T>(pool: readonly T[], final: T): T[] {
  const strip: T[] = [];
  for (let i = 0; i < REEL_LENGTH - 1; i++) {
    strip.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  strip.push(final);
  return strip;
}

type Props = {
  playerId: string;
  onDone: () => void;
};

export function SlotMachine({ playerId, onDone }: Props) {
  const claim = useMutation(api.players.claim);
  const [adjFinal, setAdjFinal] = useState<string>(() => pick(ADJECTIVES));
  const [aniFinal, setAniFinal] = useState<string>(() => pick(ANIMALS));
  const [numFinal, setNumFinal] = useState<string>(() => pick(SUFFIXES));
  const [adjStrip, setAdjStrip] = useState<string[]>(() => [adjFinal]);
  const [aniStrip, setAniStrip] = useState<string[]>(() => [aniFinal]);
  const [numStrip, setNumStrip] = useState<string[]>(() => [numFinal]);
  const [spinId, setSpinId] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (stopRef.current) clearTimeout(stopRef.current);
    },
    [],
  );

  const spin = () => {
    if (spinning || submitting) return;
    setError(null);
    const newAdj = pick(ADJECTIVES);
    const newAni = pick(ANIMALS);
    const newNum = pick(SUFFIXES);
    setAdjFinal(newAdj);
    setAniFinal(newAni);
    setNumFinal(newNum);
    setAdjStrip(buildStrip(ADJECTIVES, newAdj));
    setAniStrip(buildStrip(ANIMALS, newAni));
    setNumStrip(buildStrip(SUFFIXES, newNum));
    setSpinId((i) => i + 1);
    setSpinning(true);
    stopRef.current = setTimeout(() => {
      setSpinning(false);
      setAdjStrip([newAdj]);
      setAniStrip([newAni]);
      setNumStrip([newNum]);
    }, LONGEST_SPIN_MS + 50);
  };

  const name = `${adjFinal}${aniFinal}${numFinal}`;

  const lockIn = async () => {
    if (spinning || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await claim({ playerId, name });
      onDone();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not claim name";
      setError(message);
      setSubmitting(false);
    }
  };

  const renderReel = (
    items: string[],
    testId: string,
    durationMs: number,
    extraClass = "",
  ) => {
    const finalIndex = items.length - 1;
    const style = spinning
      ? ({
          "--spin-end": `calc(${-finalIndex} * var(--reel-height))`,
          "--spin-duration": `${durationMs}ms`,
        } as React.CSSProperties)
      : undefined;
    return (
      <div className={`slot-reel ${extraClass}`} data-testid={testId}>
        <div
          key={`${spinId}-${testId}`}
          className={`slot-strip${spinning ? " slot-strip--spinning" : ""}`}
          style={style}
        >
          {items.map((item, i) => (
            <div className="slot-strip-item" key={i}>
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      className="slot-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Pick your farmer name"
    >
      <div className="slot-card">
        <h2 className="slot-title">Spin for your farmer name</h2>
        <p className="slot-subtitle">
          Roll the reels. Lock in when you find a name you like.
        </p>
        <div className="slot-reels" aria-live="polite">
          {renderReel(adjStrip, "reel-adj", REEL_DURATIONS_MS[0])}
          {renderReel(aniStrip, "reel-ani", REEL_DURATIONS_MS[1])}
          {renderReel(
            numStrip,
            "reel-num",
            REEL_DURATIONS_MS[2],
            "slot-reel--num",
          )}
        </div>
        <p className="slot-name" data-testid="slot-name">
          {name}
        </p>
        {error && <p className="slot-error">{error}</p>}
        <div className="slot-actions">
          <button
            type="button"
            className="slot-btn slot-btn--ghost"
            onClick={spin}
            disabled={spinning || submitting}
          >
            {spinning ? "Spinning…" : "Spin"}
          </button>
          <button
            type="button"
            className="slot-btn slot-btn--primary"
            onClick={lockIn}
            disabled={spinning || submitting}
          >
            {submitting ? "Locking in…" : "Lock in"}
          </button>
        </div>
      </div>
    </div>
  );
}
