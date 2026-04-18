import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { usePlayerId, PLAYER_ID_STORAGE_KEY } from "./usePlayerId";

describe("usePlayerId", () => {
  test("returns the stored playerId when one exists", () => {
    window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, "saved-id");
    const { result } = renderHook(() => usePlayerId());
    expect(result.current).toBe("saved-id");
  });

  test("generates and persists a new UUID when none exists", () => {
    const { result } = renderHook(() => usePlayerId());
    expect(result.current).toMatch(
      /^[0-9a-f-]{10,}$/,
    );
    expect(window.localStorage.getItem(PLAYER_ID_STORAGE_KEY)).toBe(
      result.current,
    );
  });

  test("returns the same id on rerender", () => {
    window.localStorage.setItem(PLAYER_ID_STORAGE_KEY, "saved-id");
    const { result, rerender } = renderHook(() => usePlayerId());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  test("falls back to an in-memory id when localStorage throws", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("SecurityError");
      });
    const { result } = renderHook(() => usePlayerId());
    expect(typeof result.current).toBe("string");
    expect(result.current.length).toBeGreaterThan(0);
    setItemSpy.mockRestore();
    getItemSpy.mockRestore();
  });
});
