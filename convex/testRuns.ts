import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { requireProjectAccess } from "./security";

const resultStatus = v.union(
  v.literal("not_started"),
  v.literal("passed"),
  v.literal("failed"),
  v.literal("blocked"),
  v.literal("skipped"),
);

function rollupRunStatus(
  results: Array<{ status: string }>,
): "not_started" | "in_progress" | "completed" {
  if (results.length === 0) return "not_started";
  const allPending = results.every((r) => r.status === "not_started");
  if (allPending) return "not_started";
  const allDone = results.every((r) => r.status !== "not_started");
  if (allDone) return "completed";
  return "in_progress";
}

function caseStatusFromResult(
  status: "not_started" | "passed" | "failed" | "blocked" | "skipped",
): "not_started" | "in_progress" | "passed" | "failed" | "blocked" | null {
  if (status === "not_started" || status === "skipped") return null;
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  if (status === "blocked") return "blocked";
  return null;
}

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    await requireProjectAccess(ctx, projectId);
    const runs = await ctx.db
      .query("testRuns")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return runs.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { testRunId: v.id("testRuns") },
  handler: async (ctx, { testRunId }) => {
    const run = await ctx.db.get(testRunId);
    if (!run) return null;
    await requireProjectAccess(ctx, run.projectId);
    return run;
  },
});

export const getWithResults = query({
  args: { testRunId: v.id("testRuns") },
  handler: async (ctx, { testRunId }) => {
    const run = await ctx.db.get(testRunId);
    if (!run) return null;
    await requireProjectAccess(ctx, run.projectId);

    const results = await ctx.db
      .query("testRunResults")
      .withIndex("by_run", (q) => q.eq("testRunId", testRunId))
      .collect();
    results.sort((a, b) => a.sortOrder - b.sortOrder);

    const enriched = await Promise.all(
      results.map(async (result) => {
        const testCase = await ctx.db.get(result.testCaseId);
        return { ...result, testCase };
      }),
    );

    return { run, results: enriched };
  },
});

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
    description: v.optional(v.string()),
    suiteId: v.optional(v.id("suites")),
    testCaseIds: v.optional(v.array(v.id("testCases"))),
  },
  handler: async (ctx, args) => {
    const user = await requireProjectAccess(ctx, args.projectId);
    const name = args.name.trim();
    if (!name) throw new Error("Run name is required.");

    let caseIds = args.testCaseIds ?? [];
    if (args.suiteId) {
      const suite = await ctx.db.get(args.suiteId);
      if (!suite || suite.projectId !== args.projectId) {
        throw new Error("Suite not found in this project.");
      }
      if (caseIds.length === 0) {
        const suiteCases = await ctx.db
          .query("testCases")
          .withIndex("by_suite", (q) => q.eq("suiteId", args.suiteId!))
          .collect();
        caseIds = suiteCases.map((c) => c._id);
      }
    }

    if (caseIds.length === 0) {
      throw new Error("Select at least one test case for the run.");
    }

    for (const id of caseIds) {
      const tc = await ctx.db.get(id);
      if (!tc || tc.projectId !== args.projectId) {
        throw new Error("All test cases must belong to this project.");
      }
    }

    const now = Date.now();
    const testRunId = await ctx.db.insert("testRuns", {
      projectId: args.projectId,
      suiteId: args.suiteId,
      name,
      description: args.description?.trim() || undefined,
      status: "not_started",
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });

    let sortOrder = 0;
    for (const testCaseId of caseIds) {
      await ctx.db.insert("testRunResults", {
        testRunId,
        testCaseId,
        projectId: args.projectId,
        status: "not_started",
        sortOrder: sortOrder++,
      });
    }

    return testRunId;
  },
});

export const setResultStatus = mutation({
  args: {
    resultId: v.id("testRunResults"),
    status: resultStatus,
    notes: v.optional(v.string()),
    actualResult: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.db.get(args.resultId);
    if (!result) throw new Error("Result not found.");
    const user = await requireProjectAccess(ctx, result.projectId);

    const now = Date.now();
    await ctx.db.patch(args.resultId, {
      status: args.status,
      notes: args.notes?.trim() || undefined,
      actualResult: args.actualResult?.trim() || undefined,
      executedById: user._id,
      executedAt: now,
    });

    const mapped = caseStatusFromResult(args.status);
    if (mapped) {
      await ctx.db.patch(result.testCaseId, {
        status: mapped,
        updatedAt: now,
      });
    }

    const allResults = await ctx.db
      .query("testRunResults")
      .withIndex("by_run", (q) => q.eq("testRunId", result.testRunId))
      .collect();
    const runStatus = rollupRunStatus(allResults);
    await ctx.db.patch(result.testRunId, {
      status: runStatus,
      updatedAt: now,
      completedAt: runStatus === "completed" ? now : undefined,
    });

    if (args.status === "failed") {
      const keys = await ctx.db.get(user._id);
      if (keys?.openRouterApiKey) {
        await ctx.scheduler.runAfter(0, internal.aiFailureAssist.generate, {
          resultId: args.resultId,
          triggeredByUserId: user._id,
        });
      }
    }
  },
});

export const getResultInternal = internalQuery({
  args: { resultId: v.id("testRunResults") },
  handler: async (ctx, { resultId }) => {
    const result = await ctx.db.get(resultId);
    if (!result) return null;
    const testCase = await ctx.db.get(result.testCaseId);
    return { result, testCase };
  },
});

export const patchAiFailure = internalMutation({
  args: {
    resultId: v.id("testRunResults"),
    aiFailureAssist: v.object({
      status: v.union(
        v.literal("pending"),
        v.literal("generating"),
        v.literal("complete"),
        v.literal("failed"),
      ),
      likelyCauses: v.optional(v.array(v.string())),
      nextChecks: v.optional(v.array(v.string())),
      bugReportDraft: v.optional(v.string()),
      errorMessage: v.optional(v.string()),
      model: v.optional(v.string()),
      generatedAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, { resultId, aiFailureAssist }) => {
    const result = await ctx.db.get(resultId);
    if (!result) return;
    await ctx.db.patch(resultId, { aiFailureAssist });
  },
});
