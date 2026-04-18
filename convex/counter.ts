import { mutation, query } from "./_generated/server";
import { totalClickPower, type UpgradeKey } from "./upgrades/config";

export const get = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("counter").first();
  },
});

export const increment = mutation({
  args: {},
  handler: async (ctx) => {
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
