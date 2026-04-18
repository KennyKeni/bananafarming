import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

// Bun's runtime exposes a non-functional `localStorage` stub (Node 25 experimental
// feature) that masks the one jsdom would otherwise provide. Install an in-memory
// shim so tests get a working Storage API.
class MemoryStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
}

Object.defineProperty(window, "localStorage", {
  value: new MemoryStorage(),
  writable: true,
  configurable: true,
});

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});
