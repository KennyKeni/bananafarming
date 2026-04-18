import { useRef, useState } from "react";

export const PLAYER_ID_STORAGE_KEY = "banana-farm:playerId";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(PLAYER_ID_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string): void {
  try {
    window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, id);
  } catch {
    // Private browsing or quota — keep the in-memory id only.
  }
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function usePlayerId(): string {
  const [id] = useState<string>(() => {
    const stored = readStored();
    if (stored) return stored;
    const fresh = makeId();
    writeStored(fresh);
    return fresh;
  });
  const ref = useRef(id);
  return ref.current;
}
