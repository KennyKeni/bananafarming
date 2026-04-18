import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { UPGRADES, costAt, getUpgrade } from "./upgrades/config";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("upgrades").collect();
    const ownedByKey: Record<string, number> = {};
    for (const row of rows) {
      ownedByKey[row.key] = row.owned;
    }
    const result: Record<string, { owned: number; cost: number }> = {};
    for (const u of UPGRADES) {
      const owned = ownedByKey[u.key] ?? 0;
      result[u.key] = {
        owned,
        cost: costAt(u.baseCost, owned, u.costMultiplier),
      };
    }
    return result;
  },
});

export const buy = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const config = getUpgrade(key);
    if (!config) {
      throw new ConvexError({ code: "unknown_upgrade", key });
    }
    const counter = await ctx.db.query("counter").first();
    const currentCount = counter?.count ?? 0;
    const row = await ctx.db
      .query("upgrades")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    const owned = row?.owned ?? 0;
    const cost = costAt(config.baseCost, owned, config.costMultiplier);
    if (currentCount < cost) {
      throw new ConvexError({
        code: "insufficient_funds",
        key,
        cost,
        have: currentCount,
      });
    }
    await ctx.db.patch(counter!._id, { count: currentCount - cost });
    if (row) {
      await ctx.db.patch(row._id, { owned: owned + 1 });
    } else {
      await ctx.db.insert("upgrades", { key, owned: 1 });
    }
  },
});
