import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  normalizeEmail,
  requireAllowedUser,
  requireProjectAccess,
  toPublicUser,
} from "./security";

function slugifyKey(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
    if (!user) return [];

    const memberships = await ctx.db
      .query("projectMembers")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const projects = await Promise.all(
      memberships.map(async (m) => {
        const project = await ctx.db.get(m.projectId);
        if (!project || project.archivedAt) return null;
        return project;
      }),
    );
    return projects
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProjectAccess(ctx, projectId);
    return await ctx.db.get(projectId);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    key: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAllowedUser(ctx);
    const name = args.name.trim();
    if (!name) throw new Error("Project name is required.");

    let key = (args.key?.trim() || slugifyKey(name) || "PROJ").toUpperCase();
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      key = `${key}${Math.floor(Math.random() * 90 + 10)}`;
    }

    const now = Date.now();
    const projectId = await ctx.db.insert("projects", {
      name,
      key,
      description: args.description?.trim() || undefined,
      createdById: user._id,
      createdAt: now,
    });
    await ctx.db.insert("projectMembers", {
      projectId,
      userId: user._id,
      createdAt: now,
    });
    return projectId;
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    const patch: { name?: string; description?: string } = {};
    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new Error("Project name is required.");
      patch.name = name;
    }
    if (args.description !== undefined) {
      patch.description = args.description.trim() || undefined;
    }
    await ctx.db.patch(args.projectId, patch);
  },
});

export const archive = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const user = await requireProjectAccess(ctx, projectId);
    const project = await ctx.db.get(projectId);
    if (!project) throw new Error("Project not found.");
    if (project.createdById !== user._id) {
      throw new Error("Only the project creator can archive it.");
    }
    await ctx.db.patch(projectId, { archivedAt: Date.now() });
  },
});

export const listMembers = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProjectAccess(ctx, projectId);
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          membershipId: m._id,
          userId: m.userId,
          createdAt: m.createdAt,
          user: user ? toPublicUser(user) : null,
        };
      }),
    );
  },
});

export const addMemberByEmail = mutation({
  args: {
    projectId: v.id("projects"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    const email = normalizeEmail(args.email);
    if (!email) throw new Error("Email is required.");

    const invitee = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!invitee) {
      throw new Error(
        "No AlphaTest user found with that email. They must sign in once first.",
      );
    }

    const existing = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", invitee._id),
      )
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("projectMembers", {
      projectId: args.projectId,
      userId: invitee._id,
      createdAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: {
    projectId: v.id("projects"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const actor = await requireProjectAccess(ctx, args.projectId);
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found.");
    if (args.userId === project.createdById) {
      throw new Error("Cannot remove the project creator.");
    }
    if (actor._id !== project.createdById && actor._id !== args.userId) {
      throw new Error("Only the creator can remove other members.");
    }
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_and_user", (q) =>
        q.eq("projectId", args.projectId).eq("userId", args.userId),
      )
      .first();
    if (membership) {
      await ctx.db.delete(membership._id);
    }
  },
});
