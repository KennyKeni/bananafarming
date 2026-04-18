import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

test("tickOnce is a no-op when no counter doc exists", async () => {
  const t = convexTest(schema);
  await t.mutation(internal.tick.tickOnce, {});
  const counter = await t.query(api.counter.get);
  expect(counter).toBeNull();
});

test("tickOnce does not change count when totalCps is 0", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 42 });
  });
  await t.mutation(internal.tick.tickOnce, {});
  const counter = await t.query(api.counter.get);
  expect(counter?.count).toBe(42);
});

test("tickOnce adds totalCps from owned upgrades", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 100 });
    await ctx.db.insert("upgrades", { key: "cursor", owned: 2 });
    await ctx.db.insert("upgrades", { key: "grandma", owned: 1 });
  });
  await t.mutation(internal.tick.tickOnce, {});
  const counter = await t.query(api.counter.get);
  // cps = 2*1 + 1*5 = 7 (grandma nerfed to 5)
  expect(counter?.count).toBe(107);
});

test("three sequential ticks accumulate correctly", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 100 });
    await ctx.db.insert("upgrades", { key: "cursor", owned: 2 });
    await ctx.db.insert("upgrades", { key: "grandma", owned: 1 });
  });
  await t.mutation(internal.tick.tickOnce, {});
  await t.mutation(internal.tick.tickOnce, {});
  await t.mutation(internal.tick.tickOnce, {});
  const counter = await t.query(api.counter.get);
  // 3 ticks * 7 cps = 21
  expect(counter?.count).toBe(121);
});

test("tickOnce ignores unknown upgrade keys in DB", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 0 });
    await ctx.db.insert("upgrades", { key: "cursor", owned: 5 });
    await ctx.db.insert("upgrades", { key: "zzz", owned: 999 });
  });
  await t.mutation(internal.tick.tickOnce, {});
  const counter = await t.query(api.counter.get);
  // Only cursor (cps 1) counts; zzz ignored
  expect(counter?.count).toBe(5);
});
