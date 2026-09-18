import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireProjectAccess } from "./security";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProjectAccess(ctx, projectId);
    const suites = await ctx.db
      .query("suites")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return suites.sort((a, b) => a.sortOrder - b.sortOrder);
  },
});

export const get = query({
  args: { suiteId: v.id("suites") },
  handler: async (ctx, { suiteId }) => {
    const suite = await ctx.db.get(suiteId);
    if (!suite) return null;
    await requireProjectAccess(ctx, suite.projectId);
    return suite;
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    const name = args.name.trim();
    if (!name) throw new Error("Suite name is required.");

    const existing = await ctx.db
      .query("suites")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const sortOrder =
      existing.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1;
    const now = Date.now();
    return await ctx.db.insert("suites", {
      projectId: args.projectId,
      name,
      description: args.description?.trim() || undefined,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    suiteId: v.id("suites"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const suite = await ctx.db.get(args.suiteId);
    if (!suite) throw new Error("Suite not found.");
    await requireProjectAccess(ctx, suite.projectId);
    const patch: { name?: string; description?: string; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Suite name is required.");
      patch.name = name;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    await ctx.db.patch(args.suiteId, patch);
  },
});

export const remove = mutation({
  args: { suiteId: v.id("suites") },
  handler: async (ctx, { suiteId }) => {
    const suite = await ctx.db.get(suiteId);
    if (!suite) throw new Error("Suite not found.");
    await requireProjectAccess(ctx, suite.projectId);

    const cases = await ctx.db
      .query("testCases")
      .withIndex("by_suite", (q) => q.eq("suiteId", suiteId))
      .collect();
    if (cases.length > 0) {
      throw new Error("Move or delete test cases before deleting this suite.");
    }
    await ctx.db.delete(suiteId);
  },
});
