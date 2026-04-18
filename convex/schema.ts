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
});
