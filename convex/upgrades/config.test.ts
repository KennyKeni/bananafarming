import { expect, test } from "vitest";
import {
  DEFAULT_COST_MULTIPLIER,
  UPGRADES,
  costAt,
  totalClickPower,
  totalCps,
} from "./config";

test("UPGRADES has 6 entries with expected keys in order", () => {
  expect(UPGRADES.map((u) => u.key)).toEqual([
    "click",
    "cursor",
    "grandma",
    "farm",
    "mine",
    "gstack",
  ]);
});

test("DEFAULT_COST_MULTIPLIER is 1.5", () => {
  expect(DEFAULT_COST_MULTIPLIER).toBe(1.5);
});

test("click upgrade has 1.5x cost multiplier and low base cost", () => {
  const click = UPGRADES.find((u) => u.key === "click")!;
  expect(click.baseCost).toBe(5);
  expect(click.costMultiplier).toBe(1.5);
  expect(click.clickPower).toBe(1);
  expect(click.cps).toBe(0);
});

test("costAt returns base when owned is 0", () => {
  expect(costAt(10, 0)).toBe(10);
  expect(costAt(100, 0)).toBe(100);
});

test("costAt scales by 1.5x per owned with default multiplier", () => {
  expect(costAt(10, 1)).toBe(15);
  expect(costAt(10, 2)).toBe(22);
  expect(costAt(10, 3)).toBe(33);
  expect(costAt(10, 5)).toBe(75);
  expect(costAt(10, 10)).toBe(576);
});

test("costAt with 5x multiplier scales quintuply per owned", () => {
  expect(costAt(5, 0, 5)).toBe(5);
  expect(costAt(5, 1, 5)).toBe(25);
  expect(costAt(5, 2, 5)).toBe(125);
  expect(costAt(5, 3, 5)).toBe(625);
});

test("totalCps returns 0 when nothing owned", () => {
  expect(totalCps({})).toBe(0);
});

test("totalCps sums per-tier cps by owned count", () => {
  expect(totalCps({ cursor: 3 })).toBe(3);
  expect(totalCps({ cursor: 2, grandma: 1 })).toBe(2 + 12);
  // gstack has cps 0 (vanity/joke tier)
  expect(
    totalCps({ cursor: 1, click: 10, grandma: 1, farm: 1, mine: 1, gstack: 1 }),
  ).toBe(1 + 12 + 140 + 1600 + 0);
});

test("totalCps ignores unknown keys", () => {
  expect(totalCps({ cursor: 1, zzz: 999 } as never)).toBe(1);
});

test("totalClickPower is 1 when nothing owned (base click)", () => {
  expect(totalClickPower({})).toBe(1);
});

test("totalClickPower adds 1 per owned click upgrade", () => {
  expect(totalClickPower({ click: 1 })).toBe(2);
  expect(totalClickPower({ click: 5 })).toBe(6);
});

test("totalClickPower ignores passive upgrades and unknown keys", () => {
  expect(
    totalClickPower({ cursor: 10, grandma: 5, zzz: 99 } as never),
  ).toBe(1);
});
