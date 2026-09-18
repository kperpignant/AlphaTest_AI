import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireAllowedUser,
  requireProjectAccess,
  toPublicUser,
  upsertUserFromIdentity,
} from "./security";

/** Used by actions: returns the signed-in user's id. */
export const assertAllowedForAction = internalQuery({
  args: {},
  handler: async (ctx): Promise<Id<"users">> => {
    const user = await requireAllowedUser(ctx);
    return user._id;
  },
});

/** Load AI keys for scheduled agent/embedding runs. Internal only. */
export const getAiKeys = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      openRouterApiKey: user.openRouterApiKey ?? null,
      openaiApiKey: user.openaiApiKey ?? null,
    };
  },
});

export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await upsertUserFromIdentity(ctx);
    return toPublicUser(user);
  },
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (!user) {
      return {
        pendingProfile: true as const,
        name: identity.name ?? undefined,
        image: identity.pictureUrl ?? undefined,
        email: identity.email ?? undefined,
        hasOpenRouterApiKey: false,
        hasOpenaiApiKey: false,
      };
    }

    return {
      pendingProfile: false as const,
      ...toPublicUser(user),
    };
  },
});

export const setAiKeys = mutation({
  args: {
    openRouterApiKey: v.optional(v.string()),
    openaiApiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAllowedUser(ctx);
    const patch: {
      openRouterApiKey?: string;
      openaiApiKey?: string;
    } = {};

    if (args.openRouterApiKey !== undefined) {
      const trimmed = args.openRouterApiKey.trim();
      if (trimmed) patch.openRouterApiKey = trimmed;
    }
    if (args.openaiApiKey !== undefined) {
      const trimmed = args.openaiApiKey.trim();
      if (trimmed) patch.openaiApiKey = trimmed;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }
    return { ok: true as const };
  },
});

export const clearAiKeys = mutation({
  args: {
    clearOpenRouter: v.boolean(),
    clearOpenai: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireAllowedUser(ctx);
    if (args.clearOpenRouter) {
      await ctx.db.patch(user._id, { openRouterApiKey: undefined });
    }
    if (args.clearOpenai) {
      await ctx.db.patch(user._id, { openaiApiKey: undefined });
    }
    return { ok: true as const };
  },
});

export const listForProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    await requireProjectAccess(ctx, args.projectId);
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    const users = await Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return user ? toPublicUser(user) : null;
      }),
    );
    return users.filter((u): u is NonNullable<typeof u> => u !== null);
  },
});

export const findByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.trim().toLowerCase()))
      .first();
  },
});
