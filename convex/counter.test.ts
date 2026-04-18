import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
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
  await t.mutation(api.counter.increment, { playerId: "test-player" });
  const result = await t.query(api.counter.get);
  expect(result?.count).toBe(1);
});

test("increment increases existing counter by base click (1) with no click upgrades", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 10 });
  });
  await t.mutation(api.counter.increment, { playerId: "test-player" });
  const result = await t.query(api.counter.get);
  expect(result?.count).toBe(11);
});

test("increment called three times produces count 3", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  try {
    const t = convexTest(schema);
    await t.mutation(api.counter.increment, { playerId: "test-player" });
    vi.advanceTimersByTime(100);
    await t.mutation(api.counter.increment, { playerId: "test-player" });
    vi.advanceTimersByTime(100);
    await t.mutation(api.counter.increment, { playerId: "test-player" });
    const result = await t.query(api.counter.get);
    expect(result?.count).toBe(3);
  } finally {
    vi.useRealTimers();
  }
});

test("increment adds click power when click upgrades are owned", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 0 });
    await ctx.db.insert("upgrades", { key: "click", owned: 3 });
  });
  await t.mutation(api.counter.increment, { playerId: "test-player" });
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
  await t.mutation(api.counter.increment, { playerId: "test-player" });
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

test("increment attributes clickBananas and clickCount to the player", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 0 });
    await ctx.db.insert("upgrades", { key: "click", owned: 2 });
  });
  await t.mutation(api.counter.increment, { playerId: "p-1" });
  const players = await t.run(async (ctx) =>
    ctx.db.query("players").collect(),
  );
  expect(players.length).toBe(1);
  // base 1 + 2 click upgrades = 3 per click
  expect(players[0].playerId).toBe("p-1");
  expect(players[0].clickBananas).toBe(3);
  expect(players[0].clickCount).toBe(1);
});

test("increment self-heals by creating player row if missing", async () => {
  const t = convexTest(schema);
  await t.mutation(api.counter.increment, { playerId: "brand-new" });
  const players = await t.run(async (ctx) =>
    ctx.db.query("players").collect(),
  );
  expect(players.length).toBe(1);
  expect(players[0].playerId).toBe("brand-new");
  expect(players[0].clickBananas).toBe(1);
  expect(players[0].clickCount).toBe(1);
});

test("two increments for the same player accumulate correctly", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  try {
    const t = convexTest(schema);
    await t.mutation(api.counter.increment, { playerId: "p-1" });
    vi.advanceTimersByTime(100);
    await t.mutation(api.counter.increment, { playerId: "p-1" });
    const players = await t.run(async (ctx) =>
      ctx.db.query("players").collect(),
    );
    expect(players.length).toBe(1);
    expect(players[0].clickBananas).toBe(2);
    expect(players[0].clickCount).toBe(2);
  } finally {
    vi.useRealTimers();
  }
});

test("increment silently drops a second click within 40ms from same player", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  try {
    const t = convexTest(schema);
    await t.mutation(api.counter.increment, { playerId: "rapid" });
    vi.advanceTimersByTime(10);
    await t.mutation(api.counter.increment, { playerId: "rapid" });
    const result = await t.query(api.counter.get);
    expect(result?.count).toBe(1);
    const players = await t.run(async (ctx) =>
      ctx.db.query("players").collect(),
    );
    expect(players[0].clickCount).toBe(1);
    expect(players[0].clickBananas).toBe(1);
  } finally {
    vi.useRealTimers();
  }
});

test("increment accepts a second click after the throttle window elapses", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  try {
    const t = convexTest(schema);
    await t.mutation(api.counter.increment, { playerId: "patient" });
    vi.advanceTimersByTime(100);
    await t.mutation(api.counter.increment, { playerId: "patient" });
    const result = await t.query(api.counter.get);
    expect(result?.count).toBe(2);
  } finally {
    vi.useRealTimers();
  }
});

test("rate limit is per-player: other players are not affected", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  try {
    const t = convexTest(schema);
    await t.mutation(api.counter.increment, { playerId: "alice" });
    vi.advanceTimersByTime(5);
    await t.mutation(api.counter.increment, { playerId: "bob" });
    const result = await t.query(api.counter.get);
    expect(result?.count).toBe(2);
  } finally {
    vi.useRealTimers();
  }
});

test("reset does NOT touch the players table", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("counter", { count: 500 });
    await ctx.db.insert("players", {
      playerId: "p-1",
      name: "TestPlayer01",
      clickBananas: 42,
      clickCount: 7,
    });
  });
  await t.mutation(api.counter.reset, {});
  const players = await t.run(async (ctx) =>
    ctx.db.query("players").collect(),
  );
  expect(players.length).toBe(1);
  expect(players[0].clickBananas).toBe(42);
  expect(players[0].clickCount).toBe(7);
});
