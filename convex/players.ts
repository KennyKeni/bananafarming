import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { generateName, hashPlayerId, validateName } from "./players/names";

const MAX_NAME_ATTEMPTS = 8;
const RANK_SCAN_LIMIT = 5000;
const ACTIVE_WINDOW_MS = 30_000;

export async function findOrCreatePlayer(
  ctx: MutationCtx,
  playerId: string,
): Promise<Doc<"players">> {
  const existing = await ctx.db
    .query("players")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .first();
  if (existing) return existing;

  for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt++) {
    const name = generateName(playerId, attempt);
    const collision = await ctx.db
      .query("players")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (!collision) {
      const _id = await ctx.db.insert("players", {
        playerId,
        name,
        clickBananas: 0,
        clickCount: 0,
      });
      const row = await ctx.db.get(_id);
      if (!row) throw new Error("player insert vanished");
      return row;
    }
  }
  throw new Error("could not generate a unique name");
}

export async function attributeClick(
  ctx: MutationCtx,
  playerId: string,
  gain: number,
  now: number = Date.now(),
): Promise<void> {
  const player = await findOrCreatePlayer(ctx, playerId);
  await ctx.db.patch(player._id, {
    clickBananas: player.clickBananas + gain,
    clickCount: player.clickCount + 1,
    lastClickAt: now,
  });
}

export const ensure = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    return await findOrCreatePlayer(ctx, playerId);
  },
});

async function resolveUniqueName(
  ctx: MutationCtx,
  playerId: string,
  desired: string,
): Promise<string> {
  const baseCollision = await ctx.db
    .query("players")
    .withIndex("by_name", (q) => q.eq("name", desired))
    .first();
  if (!baseCollision || baseCollision.playerId === playerId) return desired;

  const hash = hashPlayerId(`${playerId}:${desired}`);
  for (let attempt = 1; attempt < MAX_NAME_ATTEMPTS; attempt++) {
    const extra = (hash + attempt) & 0xff;
    const candidate = `${desired}${extra.toString(16).padStart(2, "0")}`;
    const collision = await ctx.db
      .query("players")
      .withIndex("by_name", (q) => q.eq("name", candidate))
      .first();
    if (!collision) return candidate;
  }
  throw new ConvexError({ code: "name_collision" });
}

export const claim = mutation({
  args: { playerId: v.string(), name: v.string() },
  handler: async (ctx, { playerId, name }) => {
    if (!validateName(name)) {
      throw new ConvexError({ code: "invalid_name" });
    }
    const existing = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .first();
    if (existing?.nameClaimedAt != null) {
      throw new ConvexError({ code: "already_claimed" });
    }

    const finalName = await resolveUniqueName(ctx, playerId, name);
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: finalName,
        nameClaimedAt: now,
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) throw new Error("player vanished");
      return updated;
    }

    const _id = await ctx.db.insert("players", {
      playerId,
      name: finalName,
      clickBananas: 0,
      clickCount: 0,
      nameClaimedAt: now,
    });
    const row = await ctx.db.get(_id);
    if (!row) throw new Error("player vanished");
    return row;
  },
});

export const me = query({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const row = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .first();
    return row ?? null;
  },
});

export const heartbeat = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const player = await findOrCreatePlayer(ctx, playerId);
    await ctx.db.patch(player._id, { lastSeenAt: Date.now() });
  },
});

export const activeCount = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    const recent = await ctx.db
      .query("players")
      .withIndex("by_lastSeenAt", (q) => q.gte("lastSeenAt", cutoff))
      .collect();
    return recent.length;
  },
});

export const topLeaderboard = query({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const top = await ctx.db
      .query("players")
      .withIndex("by_clickBananas")
      .order("desc")
      .take(10);

    const me = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .first();

    if (!me) {
      return { top, you: null };
    }

    const topIndex = top.findIndex((p) => p.playerId === playerId);
    if (topIndex !== -1) {
      return {
        top,
        you: {
          rank: topIndex + 1,
          name: me.name,
          clickBananas: me.clickBananas,
          clickCount: me.clickCount,
        },
      };
    }

    // Outside top 10: count how many players have strictly more bananas.
    // Scale guard: if the scan would exceed RANK_SCAN_LIMIT, return null rank.
    const higher = await ctx.db
      .query("players")
      .withIndex("by_clickBananas", (q) => q.gt("clickBananas", me.clickBananas))
      .take(RANK_SCAN_LIMIT + 1);
    const rank =
      higher.length > RANK_SCAN_LIMIT ? null : higher.length + 1;
    return {
      top,
      you: {
        rank,
        name: me.name,
        clickBananas: me.clickBananas,
        clickCount: me.clickCount,
      },
    };
  },
});
