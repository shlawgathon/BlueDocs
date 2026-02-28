import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { requireSession } from "./lib/auth";

const shapeType = v.union(
  v.literal("circle"),
  v.literal("square"),
  v.literal("hexagon"),
  v.literal("drawn")
);

const projectConfig = v.object({
  projectType: v.string(),
  radiusKm: v.number(),
  name: v.string(),
  shapeType,
});

const pointValidator = v.array(v.number());

const projectRecord = v.object({
  id: v.string(),
  lat: v.number(),
  lng: v.number(),
  config: projectConfig,
  analysisResult: v.union(v.any(), v.null()),
  customPolygon: v.optional(v.array(pointValidator)),
});

function sanitizePolygon(
  polygon: number[][] | undefined
): [number, number][] | undefined {
  if (!polygon || polygon.length === 0) return undefined;
  const cleaned = polygon
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map((point) => [Number(point[0]), Number(point[1])] as [number, number])
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  return cleaned.length > 0 ? cleaned : undefined;
}

export const list = queryGeneric({
  args: { token: v.string() },
  returns: v.array(projectRecord),
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    return projects
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((project) => ({
        id: project.projectId,
        lat: project.lat,
        lng: project.lng,
        config: project.config,
        analysisResult: project.analysisResult ?? null,
        customPolygon: sanitizePolygon(project.customPolygon),
      }));
  },
});

export const replaceAll = mutationGeneric({
  args: {
    token: v.string(),
    projects: v.array(projectRecord),
  },
  returns: v.object({ count: v.number() }),
  handler: async (ctx, args) => {
    const { user } = await requireSession(ctx, args.token);

    const existing = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    await Promise.all(existing.map((project) => ctx.db.delete(project._id)));

    const now = Date.now();
    for (const project of args.projects) {
      await ctx.db.insert("projects", {
        userId: user._id,
        projectId: project.id,
        lat: project.lat,
        lng: project.lng,
        config: project.config,
        analysisResult: project.analysisResult ?? undefined,
        customPolygon: sanitizePolygon(project.customPolygon),
        createdAt: now,
        updatedAt: now,
      });
    }

    return { count: args.projects.length };
  },
});
