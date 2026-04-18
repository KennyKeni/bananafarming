import { internalMutation } from "./_generated/server";
import { totalCps, type UpgradeKey } from "./upgrades/config";

export const tickOnce = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counter = await ctx.db.query("counter").first();
    if (!counter) return;
    const rows = await ctx.db.query("upgrades").collect();
    const ownedByKey: Partial<Record<UpgradeKey, number>> = {};
    for (const row of rows) {
      ownedByKey[row.key as UpgradeKey] = row.owned;
    }
    const cps = totalCps(ownedByKey);
    if (cps <= 0) return;
    await ctx.db.patch(counter._id, { count: counter.count + cps });
  },
});
