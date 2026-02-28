import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const projectShapeType = v.union(
  v.literal("circle"),
  v.literal("square"),
  v.literal("hexagon"),
  v.literal("drawn")
);

export default defineSchema({
  users: defineTable({
    email: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_user", ["userId"])
    .index("by_expires_at", ["expiresAt"]),

  projects: defineTable({
    userId: v.id("users"),
    projectId: v.string(),
    lat: v.number(),
    lng: v.number(),
    config: v.object({
      projectType: v.string(),
      radiusKm: v.number(),
      name: v.string(),
      shapeType: projectShapeType,
    }),
    analysisResult: v.optional(v.any()),
    customPolygon: v.optional(v.array(v.array(v.number()))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_project", ["userId", "projectId"]),
});
