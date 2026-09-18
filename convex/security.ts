import type { UserIdentity } from "convex/server";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

type DbCtx = QueryCtx | MutationCtx;

export function normalizeEmail(email: string | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : null;
}

export async function findUserByToken(
  ctx: DbCtx,
  tokenIdentifier: string,
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
}

/** Upsert the Convex user row from the Clerk JWT identity. */
export async function upsertUserFromIdentity(
  ctx: MutationCtx,
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Sign in is required to access AlphaTest.");
  }

  const email = identity.email ?? undefined;
  const userData = {
    tokenIdentifier: identity.tokenIdentifier,
    name: identity.name ?? undefined,
    image: identity.pictureUrl ?? undefined,
    email,
    emailVerificationTime: email ? Date.now() : undefined,
  };

  const existing = await findUserByToken(ctx, identity.tokenIdentifier);
  if (existing) {
    await ctx.db.patch(existing._id, {
      name: userData.name,
      image: userData.image,
      email: userData.email,
      emailVerificationTime: userData.emailVerificationTime,
    });
    const updated = await ctx.db.get(existing._id);
    if (!updated) throw new Error("Signed-in user could not be found.");
    return updated;
  }

  if (email) {
    const byEmail = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (byEmail) {
      await ctx.db.patch(byEmail._id, userData);
      const updated = await ctx.db.get(byEmail._id);
      if (!updated) throw new Error("Signed-in user could not be found.");
      return updated;
    }
  }

  const id = await ctx.db.insert("users", userData);
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Signed-in user could not be found.");
  return created;
}

export async function requireAllowedUser(ctx: DbCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Sign in is required to access AlphaTest.");
  }

  const user = await findUserByToken(ctx, identity.tokenIdentifier);
  if (!user) {
    throw new Error("Signed-in user could not be found. Refresh and try again.");
  }
  return user;
}

export async function requireAllowedActionUser(
  ctx: ActionCtx,
): Promise<Id<"users">> {
  return await ctx.runQuery(internal.users.assertAllowedForAction, {});
}

export async function userHasProjectAccess(
  ctx: DbCtx,
  user: Doc<"users">,
  projectId: Id<"projects">,
): Promise<boolean> {
  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_and_user", (q) =>
      q.eq("projectId", projectId).eq("userId", user._id),
    )
    .first();
  return membership !== null;
}

export async function requireProjectAccess(
  ctx: DbCtx,
  projectId: Id<"projects">,
): Promise<Doc<"users">> {
  const user = await requireAllowedUser(ctx);
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }
  if (!(await userHasProjectAccess(ctx, user, projectId))) {
    throw new Error("You do not have access to this project.");
  }
  return user;
}

/** Strip secrets before returning user docs to the client. */
export function toPublicUser(user: Doc<"users">) {
  const { openRouterApiKey: _or, openaiApiKey: _oa, ...rest } = user;
  return {
    ...rest,
    hasOpenRouterApiKey: Boolean(user.openRouterApiKey),
    hasOpenaiApiKey: Boolean(user.openaiApiKey),
  };
}

export function identityDisplayName(identity: UserIdentity): string {
  return identity.name ?? identity.email ?? "User";
}
