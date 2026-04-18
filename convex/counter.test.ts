import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

test("get returns null when no counter exists", async () => {
  const t = convexTest(schema);
  const result = await t.query(api.counter.get);
  expect(result).toBeNull();
});

test("get returns the counter document when one exists", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 42 });
  });
  const result = await t.query(api.counter.get);
  expect(result?.count).toBe(42);
});

test("increment creates counter with count 1 when none exists", async () => {
  const t = convexTest(schema);
  await t.mutation(api.counter.increment, {});
  const result = await t.query(api.counter.get);
  expect(result?.count).toBe(1);
});

test("increment increases existing counter by base click (1) with no click upgrades", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 10 });
  });
  await t.mutation(api.counter.increment, {});
  const result = await t.query(api.counter.get);
  expect(result?.count).toBe(11);
});

test("increment called three times produces count 3", async () => {
  const t = convexTest(schema);
  await t.mutation(api.counter.increment, {});
  await t.mutation(api.counter.increment, {});
  await t.mutation(api.counter.increment, {});
  const result = await t.query(api.counter.get);
  expect(result?.count).toBe(3);
});

test("increment adds click power when click upgrades are owned", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 0 });
    await ctx.db.insert("upgrades", { key: "click", owned: 3 });
  });
  await t.mutation(api.counter.increment, {});
  const result = await t.query(api.counter.get);
  // base 1 + 3 click upgrades = 4 per click
  expect(result?.count).toBe(4);
});

test("increment ignores passive upgrades for click power", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 0 });
    await ctx.db.insert("upgrades", { key: "grandma", owned: 5 });
  });
  await t.mutation(api.counter.increment, {});
  const result = await t.query(api.counter.get);
  expect(result?.count).toBe(1);
});

test("reset sets an existing counter to 0 and wipes upgrades", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 9999 });
    await ctx.db.insert("upgrades", { key: "cursor", owned: 5 });
    await ctx.db.insert("upgrades", { key: "grandma", owned: 3 });
  });
  await t.mutation(api.counter.reset, {});
  const result = await t.query(api.counter.get);
  expect(result?.count).toBe(0);
  const rows = await t.run(async (ctx) =>
    ctx.db.query("upgrades").collect(),
  );
  expect(rows).toHaveLength(0);
});

test("reset is a no-op when counter does not exist", async () => {
  const t = convexTest(schema);
  await t.mutation(api.counter.reset, {});
  const result = await t.query(api.counter.get);
  expect(result).toBeNull();
});
