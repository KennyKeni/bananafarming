import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { UPGRADES, costAt } from "./upgrades/config";

test("list returns defaults for all configured upgrades when DB empty", async () => {
  const t = convexTest(schema);
  const result = await t.query(api.upgrades.list);
  expect(Object.keys(result).sort()).toEqual(
    UPGRADES.map((u) => u.key).sort(),
  );
  for (const u of UPGRADES) {
    expect(result[u.key]).toEqual({ owned: 0, cost: u.baseCost });
  }
});

test("list reflects owned counts from DB and computes cost", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("upgrades", { key: "cursor", owned: 3 });
    await ctx.db.insert("upgrades", { key: "grandma", owned: 1 });
  });
  const result = await t.query(api.upgrades.list);
  expect(result.cursor).toEqual({ owned: 3, cost: costAt(10, 3) });
  expect(result.grandma).toEqual({ owned: 1, cost: costAt(100, 1) });
  expect(result.farm).toEqual({ owned: 0, cost: 1000 });
  expect(result.mine).toEqual({ owned: 0, cost: 10000 });
  expect(result.gstack).toEqual({ owned: 0, cost: 1000000000 });
});

test("list ignores DB rows whose key is not in config", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("upgrades", { key: "zzz", owned: 99 });
  });
  const result = await t.query(api.upgrades.list);
  expect(result).not.toHaveProperty("zzz");
  expect(Object.keys(result).sort()).toEqual(
    UPGRADES.map((u) => u.key).sort(),
  );
});

test("buy deducts cost from counter and creates upgrade row (first buy)", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 50 });
  });
  await t.mutation(api.upgrades.buy, { key: "cursor" });
  const counter = await t.query(api.counter.get);
  expect(counter?.count).toBe(40);
  const list = await t.query(api.upgrades.list);
  expect(list.cursor.owned).toBe(1);
  expect(list.cursor.cost).toBe(costAt(10, 1));
});

test("buy increments existing owned and uses scaled cost", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 50 });
    await ctx.db.insert("upgrades", { key: "cursor", owned: 1 });
  });
  await t.mutation(api.upgrades.buy, { key: "cursor" });
  const counter = await t.query(api.counter.get);
  // cost at owned=1 with 1.5x multiplier = floor(10 * 1.5) = 15
  expect(counter?.count).toBe(50 - 15);
  const list = await t.query(api.upgrades.list);
  expect(list.cursor.owned).toBe(2);
});

test("buy rejects with insufficient_funds when count below cost", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 5 });
  });
  await expect(
    t.mutation(api.upgrades.buy, { key: "cursor" }),
  ).rejects.toThrow();
  const counter = await t.query(api.counter.get);
  expect(counter?.count).toBe(5);
  const list = await t.query(api.upgrades.list);
  expect(list.cursor.owned).toBe(0);
});

test("buy rejects with insufficient_funds when no counter doc exists", async () => {
  const t = convexTest(schema);
  await expect(
    t.mutation(api.upgrades.buy, { key: "cursor" }),
  ).rejects.toThrow();
  const counter = await t.query(api.counter.get);
  expect(counter).toBeNull();
});

test("buy on click upgrade uses 1.5x per-upgrade cost multiplier", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 100 });
  });
  await t.mutation(api.upgrades.buy, { key: "click" });
  let counter = await t.query(api.counter.get);
  // first click upgrade costs 5 (baseCost)
  expect(counter?.count).toBe(95);
  await t.mutation(api.upgrades.buy, { key: "click" });
  counter = await t.query(api.counter.get);
  // second click upgrade costs floor(5 * 1.5) = 7
  expect(counter?.count).toBe(95 - 7);
  const list = await t.query(api.upgrades.list);
  expect(list.click.owned).toBe(2);
  // next cost displayed = floor(5 * 1.5^2) = floor(11.25) = 11
  expect(list.click.cost).toBe(11);
});

test("buy rejects with unknown_upgrade when key not in config", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 1_000_000 });
  });
  await expect(
    t.mutation(api.upgrades.buy, { key: "zzz" }),
  ).rejects.toThrow();
  const counter = await t.query(api.counter.get);
  expect(counter?.count).toBe(1_000_000);
});
