import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { totalClickPower, type UpgradeKey } from "./upgrades/config";
import { attributeClick } from "./players";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("counter").first();
  },
});

const MIN_CLICK_INTERVAL_MS = 40;

export const increment = mutation({
  args: { playerId: v.string() },
  handler: async (ctx, { playerId }) => {
    const now = Date.now();
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .first();
    if (
      existingPlayer?.lastClickAt != null &&
      now - existingPlayer.lastClickAt < MIN_CLICK_INTERVAL_MS
    ) {
      return;
    }

    const rows = await ctx.db.query("upgrades").collect();
    const ownedByKey: Partial<Record<UpgradeKey, number>> = {};
    for (const row of rows) {
      ownedByKey[row.key as UpgradeKey] = row.owned;
    }
    const gain = totalClickPower(ownedByKey);
    const existing = await ctx.db.query("counter").first();
    if (existing) {
      await ctx.db.patch(existing._id, { count: existing.count + gain });
    } else {
      await ctx.db.insert("counter", { count: gain });
    }
    await attributeClick(ctx, playerId, gain, now);
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("counter").first();
    if (existing) {
      await ctx.db.patch(existing._id, { count: 0 });
    }
    const upgrades = await ctx.db.query("upgrades").collect();
    for (const row of upgrades) {
      await ctx.db.delete(row._id);
    }
  },
});
