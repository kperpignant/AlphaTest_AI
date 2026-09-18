import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireProjectAccess } from "./security";

const caseType = v.union(
  v.literal("functional"),
  v.literal("regression"),
  v.literal("smoke"),
  v.literal("sanity"),
  v.literal("exploratory"),
  v.literal("other"),
);

const casePriority = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("critical"),
);

const caseStatus = v.union(
  v.literal("not_started"),
  v.literal("in_progress"),
  v.literal("passed"),
  v.literal("failed"),
  v.literal("blocked"),
);

export const listBySuite = query({
  args: {
    suiteId: v.id("suites"),
    type: v.optional(caseType),
    priority: v.optional(casePriority),
    status: v.optional(caseStatus),
    assigneeId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const suite = await ctx.db.get(args.suiteId);
    if (!suite) return [];
    await requireProjectAccess(ctx, suite.projectId);

    let cases = await ctx.db
      .query("testCases")
      .withIndex("by_suite", (q) => q.eq("suiteId", args.suiteId))
      .collect();

    if (args.type) cases = cases.filter((c) => c.type === args.type);
    if (args.priority)
      cases = cases.filter((c) => c.priority === args.priority);
    if (args.status) cases = cases.filter((c) => c.status === args.status);
    if (args.assigneeId)
      cases = cases.filter((c) => c.assigneeId === args.assigneeId);

    return cases.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProjectAccess(ctx, projectId);
    const cases = await ctx.db
      .query("testCases")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return cases.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const get = query({
  args: { testCaseId: v.id("testCases") },
  handler: async (ctx, { testCaseId }) => {
    const testCase = await ctx.db.get(testCaseId);
    if (!testCase) return null;
    await requireProjectAccess(ctx, testCase.projectId);
    return testCase;
  },
});

export const getInternal = internalQuery({
  args: { testCaseId: v.id("testCases") },
  handler: async (ctx, { testCaseId }) => {
    return await ctx.db.get(testCaseId);
  },
});

export const assertProjectAccess = internalQuery({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProjectAccess(ctx, projectId);
    return true;
  },
});

export const create = mutation({
  args: {
    suiteId: v.id("suites"),
    title: v.string(),
    description: v.optional(v.string()),
    steps: v.string(),
    expectedResult: v.string(),
    preconditions: v.optional(v.string()),
    estimate: v.optional(v.string()),
    type: caseType,
    priority: casePriority,
    labels: v.optional(v.array(v.string())),
    assigneeId: v.optional(v.id("users")),
    pageUrl: v.optional(v.string()),
    browserNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const suite = await ctx.db.get(args.suiteId);
    if (!suite) throw new Error("Suite not found.");
    const user = await requireProjectAccess(ctx, suite.projectId);

    const title = args.title.trim();
    if (!title) throw new Error("Title is required.");
    const steps = args.steps.trim();
    if (!steps) throw new Error("Steps are required.");
    const expectedResult = args.expectedResult.trim();
    if (!expectedResult) throw new Error("Expected result is required.");

    const now = Date.now();
    const testCaseId = await ctx.db.insert("testCases", {
      projectId: suite.projectId,
      suiteId: args.suiteId,
      title,
      description: args.description?.trim() || undefined,
      steps,
      expectedResult,
      preconditions: args.preconditions?.trim() || undefined,
      estimate: args.estimate?.trim() || undefined,
      type: args.type,
      priority: args.priority,
      labels: args.labels?.map((l) => l.trim()).filter(Boolean),
      assigneeId: args.assigneeId,
      status: "not_started",
      pageUrl: args.pageUrl?.trim() || undefined,
      browserNotes: args.browserNotes?.trim() || undefined,
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.embeddings.embedTestCase, {
      testCaseId,
      userId: user._id,
    });

    return testCaseId;
  },
});

export const update = mutation({
  args: {
    testCaseId: v.id("testCases"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    steps: v.optional(v.string()),
    expectedResult: v.optional(v.string()),
    preconditions: v.optional(v.string()),
    estimate: v.optional(v.string()),
    type: v.optional(caseType),
    priority: v.optional(casePriority),
    status: v.optional(caseStatus),
    labels: v.optional(v.array(v.string())),
    assigneeId: v.optional(v.union(v.id("users"), v.null())),
    pageUrl: v.optional(v.string()),
    browserNotes: v.optional(v.string()),
    suiteId: v.optional(v.id("suites")),
  },
  handler: async (ctx, args) => {
    const testCase = await ctx.db.get(args.testCaseId);
    if (!testCase) throw new Error("Test case not found.");
    const user = await requireProjectAccess(ctx, testCase.projectId);

    if (args.suiteId) {
      const suite = await ctx.db.get(args.suiteId);
      if (!suite || suite.projectId !== testCase.projectId) {
        throw new Error("Suite must belong to the same project.");
      }
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) {
      const title = args.title.trim();
      if (!title) throw new Error("Title is required.");
      patch.title = title;
    }
    if (args.description !== undefined)
      patch.description = args.description.trim() || undefined;
    if (args.steps !== undefined) {
      const steps = args.steps.trim();
      if (!steps) throw new Error("Steps are required.");
      patch.steps = steps;
    }
    if (args.expectedResult !== undefined) {
      const expectedResult = args.expectedResult.trim();
      if (!expectedResult) throw new Error("Expected result is required.");
      patch.expectedResult = expectedResult;
    }
    if (args.preconditions !== undefined)
      patch.preconditions = args.preconditions.trim() || undefined;
    if (args.estimate !== undefined)
      patch.estimate = args.estimate.trim() || undefined;
    if (args.type !== undefined) patch.type = args.type;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.status !== undefined) patch.status = args.status;
    if (args.labels !== undefined)
      patch.labels = args.labels.map((l) => l.trim()).filter(Boolean);
    if (args.assigneeId !== undefined)
      patch.assigneeId = args.assigneeId ?? undefined;
    if (args.pageUrl !== undefined)
      patch.pageUrl = args.pageUrl.trim() || undefined;
    if (args.browserNotes !== undefined)
      patch.browserNotes = args.browserNotes.trim() || undefined;
    if (args.suiteId !== undefined) patch.suiteId = args.suiteId;

    await ctx.db.patch(args.testCaseId, patch);

    const contentChanged =
      args.title !== undefined ||
      args.steps !== undefined ||
      args.expectedResult !== undefined ||
      args.description !== undefined;
    if (contentChanged) {
      await ctx.scheduler.runAfter(0, internal.embeddings.embedTestCase, {
        testCaseId: args.testCaseId,
        userId: user._id,
      });
    }
  },
});

export const remove = mutation({
  args: { testCaseId: v.id("testCases") },
  handler: async (ctx, { testCaseId }) => {
    const testCase = await ctx.db.get(testCaseId);
    if (!testCase) throw new Error("Test case not found.");
    await requireProjectAccess(ctx, testCase.projectId);

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_case", (q) => q.eq("testCaseId", testCaseId))
      .collect();
    for (const att of attachments) {
      await ctx.storage.delete(att.storageId);
      await ctx.db.delete(att._id);
    }
    await ctx.db.delete(testCaseId);
  },
});

export const patchStatus = internalMutation({
  args: {
    testCaseId: v.id("testCases"),
    status: caseStatus,
  },
  handler: async (ctx, { testCaseId, status }) => {
    const testCase = await ctx.db.get(testCaseId);
    if (!testCase) return;
    await ctx.db.patch(testCaseId, { status, updatedAt: Date.now() });
  },
});
