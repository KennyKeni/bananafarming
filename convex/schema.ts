import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  counter: defineTable({
    count: v.number(),
  }),
  upgrades: defineTable({
    key: v.string(),
    owned: v.number(),
  }).index("by_key", ["key"]),
  players: defineTable({
    playerId: v.string(),
    name: v.string(),
    clickBananas: v.number(),
    clickCount: v.number(),
    nameClaimedAt: v.optional(v.number()),
    lastSeenAt: v.optional(v.number()),
    lastClickAt: v.optional(v.number()),
  })
    .index("by_playerId", ["playerId"])
    .index("by_name", ["name"])
    .index("by_clickBananas", ["clickBananas"])
    .index("by_lastSeenAt", ["lastSeenAt"]),
});
