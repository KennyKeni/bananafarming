import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";
import { ADJECTIVES, ANIMALS, generateName } from "./players/names";

test("ensure creates a player with the deterministic name", async () => {
  const t = convexTest(schema);
  const result = await t.mutation(api.players.ensure, { playerId: "p-1" });
  expect(result.playerId).toBe("p-1");
  expect(result.name).toBe(generateName("p-1"));
  expect(result.clickBananas).toBe(0);
  expect(result.clickCount).toBe(0);
});

test("ensure is idempotent", async () => {
  const t = convexTest(schema);
  const a = await t.mutation(api.players.ensure, { playerId: "p-1" });
  const b = await t.mutation(api.players.ensure, { playerId: "p-1" });
  expect(a._id).toBe(b._id);
  expect(b.name).toBe(generateName("p-1"));
});

test("ensure appends a hex suffix when the deterministic name is taken", async () => {
  const t = convexTest(schema);
  // Pre-insert a player whose name will collide with what "p-2" would generate.
  const collidingName = generateName("p-2");
  await t.run(async (ctx) => {
    await ctx.db.insert("players", {
      playerId: "other",
      name: collidingName,
      clickBananas: 0,
      clickCount: 0,
    });
  });
  const result = await t.mutation(api.players.ensure, { playerId: "p-2" });
  expect(result.name).not.toBe(collidingName);
  expect(result.name).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}[0-9a-f]{2}$/);
});

test("topLeaderboard returns top 10 sorted by clickBananas desc", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    for (let i = 0; i < 12; i++) {
      await ctx.db.insert("players", {
        playerId: `p-${i}`,
        name: `Player${i.toString().padStart(2, "0")}`,
        clickBananas: i * 10,
        clickCount: i,
      });
    }
  });
  const result = await t.query(api.players.topLeaderboard, {
    playerId: "p-0",
  });
  expect(result.top.length).toBe(10);
  // Sorted descending: p-11 (110) is #1, p-2 (20) is #10
  expect(result.top[0].clickBananas).toBe(110);
  expect(result.top[9].clickBananas).toBe(20);
  expect(result.top[0].name).toBe("Player11");
});

test("topLeaderboard returns you with rank when in top 10", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    for (let i = 0; i < 5; i++) {
      await ctx.db.insert("players", {
        playerId: `p-${i}`,
        name: `Player${i}`,
        clickBananas: i * 10,
        clickCount: i,
      });
    }
  });
  const result = await t.query(api.players.topLeaderboard, {
    playerId: "p-3",
  });
  expect(result.you).not.toBeNull();
  expect(result.you?.rank).toBe(2); // p-4=40 is rank 1, p-3=30 is rank 2
  expect(result.you?.name).toBe("Player3");
  expect(result.you?.clickBananas).toBe(30);
});

test("topLeaderboard returns you with rank when outside top 10", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    for (let i = 0; i < 15; i++) {
      await ctx.db.insert("players", {
        playerId: `p-${i}`,
        name: `Player${i.toString().padStart(2, "0")}`,
        clickBananas: i * 10,
        clickCount: i,
      });
    }
  });
  // p-2 has clickBananas=20, which puts it at rank 13 out of 15
  const result = await t.query(api.players.topLeaderboard, {
    playerId: "p-2",
  });
  expect(result.top.length).toBe(10);
  expect(result.you).not.toBeNull();
  expect(result.you?.rank).toBe(13);
  expect(result.you?.clickBananas).toBe(20);
});

test("claim sets name + nameClaimedAt on a newly-ensured player", async () => {
  const t = convexTest(schema);
  const chosen = `${ADJECTIVES[1]}${ANIMALS[1]}42`;
  const result = await t.mutation(api.players.claim, {
    playerId: "p-claim",
    name: chosen,
  });
  expect(result.name).toBe(chosen);
  expect(result.nameClaimedAt).toBeTypeOf("number");
});

test("claim creates the row if it does not exist yet", async () => {
  const t = convexTest(schema);
  const chosen = `${ADJECTIVES[2]}${ANIMALS[2]}33`;
  const result = await t.mutation(api.players.claim, {
    playerId: "p-new",
    name: chosen,
  });
  expect(result.playerId).toBe("p-new");
  expect(result.name).toBe(chosen);
});

test("claim rejects names with invalid format", async () => {
  const t = convexTest(schema);
  await expect(
    t.mutation(api.players.claim, { playerId: "p-1", name: "not-valid" }),
  ).rejects.toThrow();
});

test("claim rejects names using out-of-pool words", async () => {
  const t = convexTest(schema);
  await expect(
    t.mutation(api.players.claim, { playerId: "p-1", name: "BogusOtter22" }),
  ).rejects.toThrow();
});

test("claim rejects a second claim for the same player", async () => {
  const t = convexTest(schema);
  const name1 = `${ADJECTIVES[3]}${ANIMALS[3]}44`;
  const name2 = `${ADJECTIVES[4]}${ANIMALS[4]}55`;
  await t.mutation(api.players.claim, { playerId: "p-1", name: name1 });
  await expect(
    t.mutation(api.players.claim, { playerId: "p-1", name: name2 }),
  ).rejects.toThrow();
});

test("claim appends hex suffix when chosen name is already taken by another player", async () => {
  const t = convexTest(schema);
  const chosen = `${ADJECTIVES[5]}${ANIMALS[5]}66`;
  await t.run(async (ctx) => {
    await ctx.db.insert("players", {
      playerId: "someone-else",
      name: chosen,
      clickBananas: 0,
      clickCount: 0,
    });
  });
  const result = await t.mutation(api.players.claim, {
    playerId: "p-collide",
    name: chosen,
  });
  expect(result.name).not.toBe(chosen);
  expect(result.name.startsWith(chosen)).toBe(true);
  expect(result.name).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+\d{2}[0-9a-f]{2}$/);
});

test("me returns the player row when it exists", async () => {
  const t = convexTest(schema);
  await t.mutation(api.players.ensure, { playerId: "p-1" });
  const me = await t.query(api.players.me, { playerId: "p-1" });
  expect(me).not.toBeNull();
  expect(me?.playerId).toBe("p-1");
  expect(me?.nameClaimedAt).toBeUndefined();
});

test("me returns null when no row exists", async () => {
  const t = convexTest(schema);
  const me = await t.query(api.players.me, { playerId: "never-seen" });
  expect(me).toBeNull();
});

test("me reflects nameClaimedAt after claim", async () => {
  const t = convexTest(schema);
  const chosen = `${ADJECTIVES[6]}${ANIMALS[6]}77`;
  await t.mutation(api.players.claim, { playerId: "p-me", name: chosen });
  const me = await t.query(api.players.me, { playerId: "p-me" });
  expect(me?.nameClaimedAt).toBeTypeOf("number");
  expect(me?.name).toBe(chosen);
});

test("heartbeat updates lastSeenAt on the player row", async () => {
  const t = convexTest(schema);
  await t.mutation(api.players.ensure, { playerId: "p-hb" });
  const before = await t.query(api.players.me, { playerId: "p-hb" });
  expect(before?.lastSeenAt).toBeUndefined();
  await t.mutation(api.players.heartbeat, { playerId: "p-hb" });
  const after = await t.query(api.players.me, { playerId: "p-hb" });
  expect(after?.lastSeenAt).toBeTypeOf("number");
});

test("heartbeat self-heals when player row is missing", async () => {
  const t = convexTest(schema);
  await t.mutation(api.players.heartbeat, { playerId: "brand-new" });
  const me = await t.query(api.players.me, { playerId: "brand-new" });
  expect(me).not.toBeNull();
  expect(me?.lastSeenAt).toBeTypeOf("number");
});

test("activeCount counts only players with recent lastSeenAt", async () => {
  const t = convexTest(schema);
  const now = Date.now();
  vi.setSystemTime(now);
  await t.run(async (ctx) => {
    await ctx.db.insert("players", {
      playerId: "active-1",
      name: "Active1",
      clickBananas: 0,
      clickCount: 0,
      lastSeenAt: now - 5_000,
    });
    await ctx.db.insert("players", {
      playerId: "active-2",
      name: "Active2",
      clickBananas: 0,
      clickCount: 0,
      lastSeenAt: now - 20_000,
    });
    await ctx.db.insert("players", {
      playerId: "stale",
      name: "Stale",
      clickBananas: 0,
      clickCount: 0,
      lastSeenAt: now - 120_000,
    });
    await ctx.db.insert("players", {
      playerId: "never",
      name: "Never",
      clickBananas: 0,
      clickCount: 0,
    });
  });
  const count = await t.query(api.players.activeCount);
  expect(count).toBe(2);
  vi.useRealTimers();
});

test("topLeaderboard returns you=null for unknown playerId", async () => {
  const t = convexTest(schema);
  await t.run(async (ctx) => {
    await ctx.db.insert("players", {
      playerId: "other",
      name: "Someone",
      clickBananas: 5,
      clickCount: 1,
    });
  });
  const result = await t.query(api.players.topLeaderboard, {
    playerId: "nobody",
  });
  expect(result.you).toBeNull();
  expect(result.top.length).toBe(1);
});
